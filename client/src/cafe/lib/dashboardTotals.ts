import type { Expense, Income } from "../types";
import { isNetPayrollCategory } from "../services/swissPayrollService";
import { filterBusinessExpenses } from "./personalBleedFilter";

export type DashboardTotals = {
  totalIncome: number;
  totalExpenses: number;
  totalPayroll: number;
  balance: number;
  vatReceived: number;
  vatPaid: number;
  vatBalance: number;
};

/**
 * Single source of truth for Dashboard resume KPIs.
 * Balance = income − operating expenses − net payroll (UAT-9).
 */
export function computeDashboardTotals(
  income: Array<Pick<Income, "amount" | "vat_amount">>,
  expenses: Array<Pick<Expense, "amount" | "vat_amount" | "category" | "description">>
): DashboardTotals {
  const businessExpenses = filterBusinessExpenses(expenses as Expense[]);
  const totalIncome = income.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalExpenses = businessExpenses
    .filter((e) => !isNetPayrollCategory(String(e.category || "")))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalPayroll = businessExpenses
    .filter((e) => isNetPayrollCategory(String(e.category || "")))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const vatReceived = income.reduce((sum, i) => sum + (Number(i.vat_amount) || 0), 0);
  const vatPaid = businessExpenses.reduce((sum, e) => sum + (Number(e.vat_amount) || 0), 0);
  return {
    totalIncome,
    totalExpenses,
    totalPayroll,
    balance: totalIncome - totalExpenses - totalPayroll,
    vatReceived,
    vatPaid,
    vatBalance: vatReceived - vatPaid,
  };
}

/**
 * Detect classic multi-invoice binder inflation: N linked rows each ≈ full binder total
 * (sum ≈ N × binder) instead of summing to the binder once.
 */
export function isInflatedMultiInvoiceLedger(opts: {
  binderTotal: number;
  subCount: number;
  linkedExpenseSum: number;
  linkedExpenseCount: number;
}): boolean {
  const { binderTotal, subCount, linkedExpenseSum, linkedExpenseCount } = opts;
  if (!(binderTotal > 0) || subCount < 2) return false;
  if (linkedExpenseCount < 2) return false;
  const inflated = binderTotal * subCount;
  // Linked sum matches N× binder (within 2%) and is far above the true binder
  if (linkedExpenseSum + 0.02 < binderTotal * 1.5) return false;
  return Math.abs(linkedExpenseSum - inflated) <= Math.max(1, inflated * 0.02);
}
