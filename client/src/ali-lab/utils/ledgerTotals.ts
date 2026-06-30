import type { Expense, Income } from "@/cafe/types";
import { isNetPayrollCategory } from "@/cafe/services/swissPayrollService";

export type LedgerTotals = {
  totalIncome: number;
  totalExpenses: number;
  totalPayroll: number;
  balance: number;
  vatReceived: number;
  vatPaid: number;
  vatBalance: number;
  incomeCount: number;
  expenseCount: number;
};

export function filterLedgerBySession(
  income: Income[],
  expenses: Expense[],
  opts: {
    sessionId: string | undefined;
    allSessions: boolean;
    existingSessionIds: string[];
  }
): { income: Income[]; expenses: Expense[] } {
  const { sessionId, allSessions, existingSessionIds } = opts;
  if (allSessions) {
    return {
      income: income.filter((i) => existingSessionIds.includes(i.session_id)),
      expenses: expenses.filter((e) => existingSessionIds.includes(e.session_id)),
    };
  }
  if (!sessionId) {
    return { income: [], expenses: [] };
  }
  return {
    income: income.filter((i) => i.session_id === sessionId),
    expenses: expenses.filter((e) => e.session_id === sessionId),
  };
}

export function filterLedgerByMonth(income: Income[], expenses: Expense[], month: string) {
  return {
    income: income.filter((i) => i.date.startsWith(month)),
    expenses: expenses.filter((e) => e.date.startsWith(month)),
  };
}

/** Same rules as production RestaurantDashboard totals. */
export function computeLedgerTotals(income: Income[], expenses: Expense[]): LedgerTotals {
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses
    .filter((e) => !isNetPayrollCategory(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
  const totalPayroll = expenses
    .filter((e) => isNetPayrollCategory(e.category))
    .reduce((sum, e) => sum + e.amount, 0);
  const vatReceived = income.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
  const vatPaid = expenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
  return {
    totalIncome,
    totalExpenses,
    totalPayroll,
    balance: totalIncome - totalExpenses - totalPayroll,
    vatReceived,
    vatPaid,
    vatBalance: vatReceived - vatPaid,
    incomeCount: income.length,
    expenseCount: expenses.length,
  };
}

export type HouseholdLedgerTotals = {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  balance: number;
  savingsRatePct: number;
  incomeCount: number;
  expenseCount: number;
};

/** Household view: all expenses count (no payroll/VAT split). */
export function computeHouseholdLedgerTotals(income: Income[], expenses: Expense[]): HouseholdLedgerTotals {
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const savings = totalIncome - totalExpenses;
  const savingsRatePct = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
  return {
    totalIncome,
    totalExpenses,
    savings,
    balance: savings,
    savingsRatePct,
    incomeCount: income.length,
    expenseCount: expenses.length,
  };
}

export function formatChf(n: number): string {
  /** Swiss German number format — locale `de-CH`, not Dutch (`nl-NL`). */
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
