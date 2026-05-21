import type { Expense, Income } from "@/cafe/types";

export type ForecastPoint = { date: string; balanceChf: number; income: number; expense: number };

/**
 * Simple 90-day cash projection from trailing weekly averages.
 */
export function buildCashForecast(
  income: Income[],
  expenses: Expense[],
  startBalanceChf = 0
): ForecastPoint[] {
  const now = new Date();
  const byWeek = new Map<string, { in: number; out: number }>();

  const add = (isoDate: string, inc: number, exp: number) => {
    const d = new Date(isoDate);
    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 6) / 7)}`;
    const cur = byWeek.get(weekKey) || { in: 0, out: 0 };
    cur.in += inc;
    cur.out += exp;
    byWeek.set(weekKey, cur);
  };

  income.forEach((i) => add(i.date, i.amount, 0));
  expenses.forEach((e) => add(e.date, 0, e.amount));

  const weeks = [...byWeek.values()];
  const avgIn = weeks.length ? weeks.reduce((s, w) => s + w.in, 0) / weeks.length : 0;
  const avgOut = weeks.length ? weeks.reduce((s, w) => s + w.out, 0) / weeks.length : 0;
  const weeklyNet = (avgIn - avgOut) / Math.max(1, weeks.length);

  const points: ForecastPoint[] = [];
  let balance = startBalanceChf;
  for (let d = 0; d < 90; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const iso = date.toISOString().slice(0, 10);
    const dayIncome = d % 7 === 0 ? avgIn / 4 : 0;
    const dayExpense = d % 7 === 3 ? avgOut / 4 : 0;
    balance += dayIncome - dayExpense + (d > 0 ? weeklyNet / 90 : 0);
    points.push({
      date: iso,
      balanceChf: Math.round(balance * 100) / 100,
      income: Math.round(dayIncome * 100) / 100,
      expense: Math.round(dayExpense * 100) / 100,
    });
  }
  return points;
}
