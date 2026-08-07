import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addPersonalTransaction,
  computePersonalMonthTotals,
  deletePersonalTransaction,
  listPersonalImports,
  listPersonalTransactions,
  PERSONAL_BUDGET_CHANGED,
  updatePersonalTransaction,
  type PersonalBudgetTx,
  type PersonalImportRecord,
  type PersonalStatementCommitResult,
  commitPersonalStatementDrafts,
} from "../lib/personalBudgetStore";
import {
  addPersonalTransactionFs,
  deletePersonalTransactionFs,
  listPersonalImportsFs,
  listPersonalTransactionsFs,
  mirrorPersonalStatementCommitFs,
  updatePersonalTransactionFs,
} from "../lib/personalLedgerFirestore";
import { personalRowsToLedger } from "../lib/personalLedgerAdapt";
import {
  ensureDefaultPersonalSession,
  getCurrentPersonalSessionId,
  listPersonalSessions,
  PERSONAL_SESSION_CHANGED,
  type PersonalSession,
} from "../lib/personalSessionsStore";
import { auth, db } from "@/cafe/lib/firebase";
import { useWorkspaceOptional } from "@/cafe/context/WorkspaceContext";
import type { PersonalStatementDraft } from "../lib/personalStatementImport";

export { PERSONAL_SESSION_CHANGED };

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of secondary) map.set(row.id, row);
  for (const row of primary) map.set(row.id, row);
  return Array.from(map.values());
}

function notifySessionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERSONAL_SESSION_CHANGED));
  }
}

/** Personal money ledger for all /personal and /ali personal-plan tabs. */
export function usePersonalBudgetLedger(month?: string) {
  const workspace = useWorkspaceOptional();
  const ownerUid = workspace?.dataOwnerUid ?? null;
  const canWrite = workspace?.canWrite !== false;
  const authUid = auth?.currentUser?.uid ?? null;
  /** Only the signed-in owner merges device IndexedDB; invitees read owner cloud only. */
  const mergeLocal = Boolean(!ownerUid || !authUid || authUid === ownerUid);
  const useCloud = Boolean(ownerUid && db);

  const [allRows, setAllRows] = useState<PersonalBudgetTx[]>([]);
  const [allImports, setAllImports] = useState<PersonalImportRecord[]>([]);
  const [sessions, setSessions] = useState<PersonalSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isAllSessionsView, setIsAllSessionsView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refreshSessions = useCallback(async () => {
    try {
      const cur = await ensureDefaultPersonalSession();
      const all = await listPersonalSessions();
      setSessions(all);
      setCurrentSessionId(cur.id);
    } catch {
      const id = await getCurrentPersonalSessionId();
      setCurrentSessionId(id);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let cloudTx: PersonalBudgetTx[] = [];
      let cloudImp: PersonalImportRecord[] = [];
      let cloudErr: string | null = null;

      if (useCloud && ownerUid && db) {
        try {
          [cloudTx, cloudImp] = await Promise.all([
            listPersonalTransactionsFs(db, ownerUid),
            listPersonalImportsFs(db, ownerUid),
          ]);
        } catch (e) {
          cloudErr = e instanceof Error ? e.message : String(e);
        }
      }

      if (mergeLocal) {
        const [localTx, localImp] = await Promise.all([
          listPersonalTransactions(),
          listPersonalImports(),
        ]);
        setAllRows(mergeById(cloudTx, localTx).sort((a, b) => b.date.localeCompare(a.date)));
        setAllImports(
          mergeById(cloudImp, localImp).sort((a, b) => b.importedAt.localeCompare(a.importedAt))
        );
      } else {
        setAllRows(cloudTx);
        setAllImports(cloudImp);
      }

      if (cloudErr && !mergeLocal) setError(cloudErr);
      else if (cloudErr && mergeLocal && cloudTx.length === 0) {
        /* Local data still shown; soft-note permissions without wiping UI. */
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [useCloud, ownerUid, mergeLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions, tick]);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener(PERSONAL_BUDGET_CHANGED, onChange);
    window.addEventListener(PERSONAL_SESSION_CHANGED, onChange);
    return () => {
      window.removeEventListener(PERSONAL_BUDGET_CHANGED, onChange);
      window.removeEventListener(PERSONAL_SESSION_CHANGED, onChange);
    };
  }, []);

  const bump = useCallback(() => setTick((n) => n + 1), []);

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) || null,
    [sessions, currentSessionId]
  );

  const rows = useMemo(() => {
    if (isAllSessionsView || !currentSessionId) return allRows;
    return allRows.filter((r) => !r.sessionId || r.sessionId === currentSessionId);
  }, [allRows, currentSessionId, isAllSessionsView]);

  const imports = useMemo(() => {
    if (isAllSessionsView || !currentSessionId) return allImports;
    return allImports.filter((r) => !r.sessionId || r.sessionId === currentSessionId);
  }, [allImports, currentSessionId, isAllSessionsView]);

  const add = useCallback(
    async (input: Omit<PersonalBudgetTx, "id" | "createdAt"> & { id?: string }) => {
      if (!canWrite) throw new Error("Read-only access");
      const withSession = {
        ...input,
        sessionId: input.sessionId ?? currentSessionId ?? undefined,
      };
      if (useCloud && ownerUid && db) {
        try {
          const row = await addPersonalTransactionFs(db, ownerUid, withSession);
          if (mergeLocal) await addPersonalTransaction(row);
          bump();
          return row;
        } catch {
          if (mergeLocal) {
            const row = await addPersonalTransaction(withSession);
            bump();
            return row;
          }
          throw new Error("Cloud write failed");
        }
      }
      const row = await addPersonalTransaction(withSession);
      return row;
    },
    [canWrite, useCloud, ownerUid, bump, currentSessionId, mergeLocal]
  );

  const update = useCallback(
    async (
      id: string,
      patch: Partial<Pick<PersonalBudgetTx, "amount" | "description" | "date" | "kind" | "expenseCat" | "incomeCat">>
    ) => {
      if (!canWrite) throw new Error("Read-only access");
      if (useCloud && ownerUid && db) {
        try {
          await updatePersonalTransactionFs(db, ownerUid, id, patch);
        } catch {
          /* fall through to local */
        }
      }
      if (mergeLocal) await updatePersonalTransaction(id, patch);
      bump();
    },
    [canWrite, useCloud, ownerUid, bump, mergeLocal]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!canWrite) throw new Error("Read-only access");
      if (useCloud && ownerUid && db) {
        try {
          await deletePersonalTransactionFs(db, id);
        } catch {
          /* fall through */
        }
      }
      if (mergeLocal) await deletePersonalTransaction(id);
      bump();
    },
    [canWrite, useCloud, ownerUid, bump, mergeLocal]
  );

  /** Always IndexedDB first (owner device), then mirror to Firestore for household. */
  const commitStatement = useCallback(
    async (
      drafts: PersonalStatementDraft[],
      meta: { fileName: string; source: "csv" | "pdf" | "image"; sessionId?: string }
    ): Promise<PersonalStatementCommitResult> => {
      if (!canWrite) throw new Error("Read-only access");
      const sessionMeta = {
        ...meta,
        sessionId: meta.sessionId ?? currentSessionId ?? undefined,
      };
      const built = await commitPersonalStatementDrafts(drafts, sessionMeta);
      if (useCloud && ownerUid && db) {
        try {
          await mirrorPersonalStatementCommitFs(db, ownerUid, built);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/missing or insufficient permissions|permission-denied/i.test(msg)) {
            /* Local persist already done — invitees need rules deploy for cloud. */
          } else {
            console.warn("[personal] cloud mirror failed", msg);
          }
        }
      }
      bump();
      return built;
    },
    [canWrite, useCloud, ownerUid, currentSessionId, bump]
  );

  const allTotals = useMemo(() => {
    const income = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
    const expenses = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
    const savings = income - expenses;
    return {
      totalIncome: income,
      totalExpenses: expenses,
      savings,
      balance: savings,
      savingsRatePct: income > 0 ? Math.round((savings / income) * 100) : 0,
      incomeCount: rows.filter((r) => r.kind === "income").length,
      expenseCount: rows.filter((r) => r.kind === "expense").length,
    };
  }, [rows]);

  const monthKey = month || "";
  const { rows: monthRows, totals: monthTotals } = useMemo(() => {
    if (!monthKey) {
      return { rows, totals: allTotals };
    }
    return computePersonalMonthTotals(rows, monthKey);
  }, [rows, monthKey, allTotals]);

  const { income: filteredIncome, expenses: filteredExpenses } = useMemo(
    () => personalRowsToLedger(rows),
    [rows]
  );
  const { income: monthIncome, expenses: monthExpenses } = useMemo(
    () => personalRowsToLedger(monthRows),
    [monthRows]
  );

  return {
    rows,
    allRows,
    monthRows,
    imports,
    allImports,
    /** Month totals when `month` passed; else all-time personal totals. */
    totals: month ? monthTotals : allTotals,
    household: allTotals,
    householdMonth: month ? monthTotals : allTotals,
    filteredIncome,
    filteredExpenses,
    monthIncome,
    monthExpenses,
    loading,
    error,
    refresh: async () => {
      await refresh();
      await refreshSessions();
    },
    refreshFinances: async () => {
      await refresh();
    },
    bump,
    add,
    update,
    remove,
    commitStatement,
    /** @deprecated use commitStatement — dual-writes local + cloud */
    commitStatementCloud: useCloud && ownerUid && db ? commitStatement : null,
    useCloud,
    canWrite,
    hasData: rows.length > 0,
    hasFirebaseData: rows.length > 0,
    sessionReady: true,
    sessionLabel: currentSession?.name || "Personal budget",
    currentSession: currentSession || { id: currentSessionId || "personal", name: "Personal budget" },
    isAllSessionsView,
    sessions,
    setCurrentSession: (s: { id: string; name: string } | null) => {
      if (s) {
        setCurrentSessionId(s.id);
        setIsAllSessionsView(false);
        notifySessionChanged();
      }
    },
    setAllSessionsView: (v: boolean) => {
      setIsAllSessionsView(v);
      notifySessionChanged();
    },
    totalImportCount: allImports.length,
  };
}
