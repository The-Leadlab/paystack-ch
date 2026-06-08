import { useMemo } from "react";
import { useFinance } from "@/cafe/context/FinanceContext";
import { useSession } from "@/cafe/context/SessionContext";
import {
  computeHouseholdLedgerTotals,
  computeLedgerTotals,
  filterLedgerBySession,
} from "../utils/ledgerTotals";

export function useAliLabLedger() {
  const { income, expenses, loading, error, refreshFinances } = useFinance();
  const { sessions, currentSession, isAllSessionsView, setCurrentSession, setAllSessionsView } =
    useSession();

  const existingSessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);

  const filtered = useMemo(
    () =>
      filterLedgerBySession(income, expenses, {
        sessionId: currentSession?.id,
        allSessions: isAllSessionsView,
        existingSessionIds,
      }),
    [income, expenses, currentSession?.id, isAllSessionsView, existingSessionIds]
  );

  const totals = useMemo(
    () => computeLedgerTotals(filtered.income, filtered.expenses),
    [filtered.income, filtered.expenses]
  );

  const household = useMemo(
    () => computeHouseholdLedgerTotals(filtered.income, filtered.expenses),
    [filtered.income, filtered.expenses]
  );

  const sessionLabel = isAllSessionsView
    ? "All sessions"
    : currentSession?.name || "No session selected";

  return {
    ...totals,
    household,
    filteredIncome: filtered.income,
    filteredExpenses: filtered.expenses,
    loading,
    error,
    refreshFinances,
    sessions,
    currentSession,
    isAllSessionsView,
    setCurrentSession,
    setAllSessionsView,
    sessionLabel,
    hasFirebaseData: income.length > 0 || expenses.length > 0,
  };
}
