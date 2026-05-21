import type { Expense, Income } from "@/cafe/types";

export type ForecastPoint = { date: string; balanceChf: number; income: number; expense: number };

function isoWeekKey(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * 90-day cash projection from trailing weekly net flows (income − expenses).
 */
export function buildCashForecast(
  income: Income[],
  expenses: Expense[],
  startBalanceChf = 0
): ForecastPoint[] {
  const byWeek = new Map<string, { in: number; out: number }>();

  income.forEach((i) => {
    const key = isoWeekKey(i.date);
    const cur = byWeek.get(key) || { in: 0, out: 0 };
    cur.in += i.amount;
    byWeek.set(key, cur);
  });
  expenses.forEach((e) => {
    const key = isoWeekKey(e.date);
    const cur = byWeek.get(key) || { in: 0, out: 0 };
    cur.out += e.amount;
    byWeek.set(key, cur);
  });

  const weeks = [...byWeek.values()];
  const avgWeeklyIn = weeks.length ? weeks.reduce((s, w) => s + w.in, 0) / weeks.length : 0;
  const avgWeeklyOut = weeks.length ? weeks.reduce((s, w) => s + w.out, 0) / weeks.length : 0;
  const weeklyNet = avgWeeklyIn - avgWeeklyOut;
  const dailyNet = weeklyNet / 7;

  const now = new Date();
  const points: ForecastPoint[] = [];
  let balance = startBalanceChf;

  for (let d = 0; d < 90; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const iso = date.toISOString().slice(0, 10);
    balance += dailyNet;
    points.push({
      date: iso,
      balanceChf: Math.round(balance * 100) / 100,
      income: Math.round((avgWeeklyIn / 7) * 100) / 100,
      expense: Math.round((avgWeeklyOut / 7) * 100) / 100,
    });
  }
  return points;
}

/** Suggested opening balance = current ledger net (same formula as /app balance). */
export function suggestedOpeningBalance(
  income: Income[],
  expenses: Expense[],
  computeBalance: (inc: Income[], exp: Expense[]) => number
): number {
  return Math.round(computeBalance(income, expenses) * 100) / 100;
}
