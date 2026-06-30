import { useEffect, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useSession } from "../context/SessionContext";
import {
  computeHouseholdLedgerTotals,
  computeLedgerTotals,
  filterLedgerByMonth,
  filterLedgerBySession,
} from "@/ali-lab/utils/ledgerTotals";

/**
 * Single ledger hook for Business (/app) and Personal (/app/personal, /ali).
 * Reads the same Firestore income/expenses + session filter as RestaurantDashboard.
 */
export function useLinkedLedger(month?: string) {
  const { income, expenses, loading, error, refreshFinances } = useFinance();
  const { sessions, currentSession, isAllSessionsView, setCurrentSession, setAllSessionsView } =
    useSession();

  const existingSessionIds = useMemo(() => sessions.map((s) => s.id), [sessions]);

  useEffect(() => {
    if (!isAllSessionsView && !currentSession && sessions.length > 0) {
      setCurrentSession(sessions[0]);
    }
  }, [isAllSessionsView, currentSession, sessions, setCurrentSession]);

  const filtered = useMemo(
    () =>
      filterLedgerBySession(income, expenses, {
        sessionId: currentSession?.id,
        allSessions: isAllSessionsView,
        existingSessionIds,
      }),
    [income, expenses, currentSession?.id, isAllSessionsView, existingSessionIds]
  );

  const monthFiltered = useMemo(() => {
    if (!month) return filtered;
    return filterLedgerByMonth(filtered.income, filtered.expenses, month);
  }, [filtered, month]);

  const totals = useMemo(
    () => computeLedgerTotals(filtered.income, filtered.expenses),
    [filtered.income, filtered.expenses]
  );

  const household = useMemo(
    () => computeHouseholdLedgerTotals(filtered.income, filtered.expenses),
    [filtered.income, filtered.expenses]
  );

  const householdMonth = useMemo(
    () => computeHouseholdLedgerTotals(monthFiltered.income, monthFiltered.expenses),
    [monthFiltered.income, monthFiltered.expenses]
  );

  const sessionLabel = isAllSessionsView
    ? "All sessions"
    : currentSession?.name || (sessions.length === 0 ? "No session — create one in Business" : "No session selected");

  const sessionReady = Boolean(isAllSessionsView || currentSession?.id);

  return {
    ...totals,
    household,
    householdMonth,
    filteredIncome: filtered.income,
    filteredExpenses: filtered.expenses,
    monthIncome: monthFiltered.income,
    monthExpenses: monthFiltered.expenses,
    loading,
    error,
    refreshFinances,
    sessions,
    currentSession,
    isAllSessionsView,
    setCurrentSession,
    setAllSessionsView,
    sessionLabel,
    sessionReady,
    hasFirebaseData: income.length > 0 || expenses.length > 0,
  };
}
