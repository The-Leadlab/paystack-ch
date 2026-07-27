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
} from "../lib/personalBudgetStore";
import { personalRowsToLedger } from "../lib/personalLedgerAdapt";

/** Personal money ledger for all /app/personal and /ali personal-plan tabs. */
export function usePersonalBudgetLedger(month?: string) {
  const [rows, setRows] = useState<PersonalBudgetTx[]>([]);
  const [imports, setImports] = useState<PersonalImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tx, imp] = await Promise.all([listPersonalTransactions(), listPersonalImports()]);
      setRows(tx);
      setImports(imp);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener(PERSONAL_BUDGET_CHANGED, onChange);
    return () => window.removeEventListener(PERSONAL_BUDGET_CHANGED, onChange);
  }, []);

  const bump = useCallback(() => setTick((n) => n + 1), []);

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
    monthRows,
    imports,
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
    },
    /** Alias for panels that previously called LinkedLedger.refreshFinances */
    refreshFinances: async () => {
      await refresh();
    },
    bump,
    add: addPersonalTransaction,
    update: updatePersonalTransaction,
    remove: deletePersonalTransaction,
    hasData: rows.length > 0,
    hasFirebaseData: rows.length > 0,
    sessionReady: true,
    sessionLabel: "Personal budget",
    currentSession: { id: "personal", name: "Personal budget" } as { id: string; name: string },
    isAllSessionsView: true,
    sessions: [] as { id: string; name: string }[],
    setCurrentSession: (_s: { id: string; name: string } | null) => {},
    setAllSessionsView: (_v: boolean) => {},
  };
}
