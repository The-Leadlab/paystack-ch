import type { Expense, Income } from "@/cafe/types";
import {
  classifyPersonalExpense,
  classifyPersonalIncome,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../personalCategories";

const DEFAULT_LOOKBACK_MONTHS = 3;

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The `lookback` calendar months strictly before `currentMonth` (excludes the in-progress month). */
function priorMonths(currentMonth: string, lookback: number): string[] {
  return Array.from({ length: lookback }, (_, i) => shiftMonth(currentMonth, -(i + 1)));
}

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Average per-category spend/income over the trailing `lookback` months, divided by however many
 * of those months actually have ledger activity (so 1 month of history isn't diluted by /3).
 */
function averageByCategory<T extends { date: string }, C extends string>(
  rows: T[],
  months: string[],
  classify: (row: T) => C
): Partial<Record<C, number>> {
  const monthSet = new Set(months);
  const activeMonths = new Set<string>();
  const sums = new Map<C, number>();

  for (const row of rows) {
    const rowMonth = row.date.slice(0, 7);
    if (!monthSet.has(rowMonth)) continue;
    activeMonths.add(rowMonth);
    const cat = classify(row);
    sums.set(cat, (sums.get(cat) ?? 0) + (row as unknown as { amount: number }).amount);
  }

  if (activeMonths.size === 0) return {};

  const result: Partial<Record<C, number>> = {};
  for (const [cat, total] of sums) {
    result[cat] = roundToNearest5(total / activeMonths.size);
  }
  return result;
}

export function suggestExpenseBudgets(
  expenses: Expense[],
  currentMonth: string,
  lookback = DEFAULT_LOOKBACK_MONTHS
): Partial<Record<PersonalExpenseCategory, number>> {
  return averageByCategory(expenses, priorMonths(currentMonth, lookback), classifyPersonalExpense);
}

export function suggestIncomeBudgets(
  income: Income[],
  currentMonth: string,
  lookback = DEFAULT_LOOKBACK_MONTHS
): Partial<Record<PersonalIncomeCategory, number>> {
  return averageByCategory(income, priorMonths(currentMonth, lookback), classifyPersonalIncome);
}
