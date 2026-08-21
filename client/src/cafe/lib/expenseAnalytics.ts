/** Expense hub analytics — trend, category mix, budget, insights (no UI). */

import {
  addDaysIso,
  buildProfitability,
  monthBounds,
  priorPeriodBounds,
  resolveRevenueInterval,
  sumExpensesInRange,
  trendForRange,
  type ExpenseRow,
  type IncomeRow,
  type Profitability,
  type RevenueIntervalId,
  type TrendPoint,
} from './revenueAnalytics';

export type { ExpenseRow, Profitability, RevenueIntervalId, TrendPoint };
export {
  addDaysIso,
  monthBounds,
  priorPeriodBounds,
  REVENUE_INTERVALS,
  toIsoDate,
  trendAxisTickDates,
} from './revenueAnalytics';
export { sumExpensesInRange, buildProfitability };

const LEDGER_CATS = ['BILLS', 'SUPPLIERS', 'PAYROLL', 'PAYROLL_TAXES', 'OTHER'] as const;
export type LedgerExpenseCategory = (typeof LEDGER_CATS)[number];

export const EXPENSE_CATEGORY_FILTERS: { id: LedgerExpenseCategory | 'ALL'; labelKey: string }[] = [
  { id: 'ALL', labelKey: 'ehCatAll' },
  { id: 'BILLS', labelKey: 'BILLS' },
  { id: 'SUPPLIERS', labelKey: 'SUPPLIERS' },
  { id: 'PAYROLL', labelKey: 'PAYROLL' },
  { id: 'PAYROLL_TAXES', labelKey: 'PAYROLL_TAXES' },
  { id: 'OTHER', labelKey: 'OTHER' },
];

export type CategoryMixItem = {
  category: string;
  amount: number;
  pct: number;
};

export type TopVendor = {
  description: string;
  amount: number;
  count: number;
};

export type ExpenseInsight = {
  id: string;
  tone: 'info' | 'warn' | 'positive';
  /** i18n key — resolve with t() in the UI */
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string>;
  action?: 'categories' | 'documents' | 'add_expense';
};

/** Trailing 3-month average spend (expense budget target). */
export function monthlyExpenseBudgetTarget(expenses: ExpenseRow[], anchorIso: string): number {
  const totals: number[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const d = addDaysIso(anchorIso, -i * 28);
    const { start, end } = monthBounds(d);
    totals.push(sumExpensesInRange(expenses, start, end));
  }
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  if (avg > 0) return avg;
  const { start, end } = monthBounds(anchorIso);
  return sumExpensesInRange(expenses, start, end);
}

export function resolveExpenseInterval(
  interval: RevenueIntervalId,
  today: string,
  expenses: ExpenseRow[],
  customRange?: { start: string; end: string } | null
) {
  return resolveRevenueInterval(interval, today, expenses as IncomeRow[], customRange);
}

export function trendExpensesForRange(
  expenses: ExpenseRow[],
  start: string,
  end: string,
  locale: string
): TrendPoint[] {
  return trendForRange(expenses as IncomeRow[], start, end, locale);
}

export function filterExpensesByCategory(
  expenses: ExpenseRow[],
  category: LedgerExpenseCategory | 'ALL'
): ExpenseRow[] {
  if (category === 'ALL') return expenses;
  return expenses.filter((e) => (e.category || 'OTHER').toUpperCase() === category);
}

export function buildCategoryMix(
  expenses: ExpenseRow[],
  start: string,
  end: string
): CategoryMixItem[] {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const row of expenses) {
    if (row.date < start || row.date > end) continue;
    const cat = (row.category || 'OTHER').toUpperCase();
    totals.set(cat, (totals.get(cat) || 0) + row.amount);
    grand += row.amount;
  }
  const ordered = LEDGER_CATS.filter((c) => (totals.get(c) || 0) > 0);
  for (const cat of Array.from(totals.keys())) {
    if (!ordered.includes(cat as LedgerExpenseCategory)) ordered.push(cat as LedgerExpenseCategory);
  }
  return ordered.map((category) => {
    const amount = totals.get(category) || 0;
    return {
      category,
      amount,
      pct: grand > 0 ? (amount / grand) * 100 : 0,
    };
  });
}

export function buildTopVendors(
  expenses: ExpenseRow[],
  start: string,
  end: string,
  limit = 8
): TopVendor[] {
  const byDesc = new Map<string, { amount: number; count: number }>();
  for (const row of expenses) {
    if (row.date < start || row.date > end) continue;
    const key = (row.description || '').trim() || '—';
    const prev = byDesc.get(key) || { amount: 0, count: 0 };
    prev.amount += row.amount;
    prev.count += 1;
    byDesc.set(key, prev);
  }
  return Array.from(byDesc.entries())
    .map(([description, v]) => ({ description, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function buildExpenseInsights(opts: {
  spendPeriod: number;
  spendPrior: number;
  spendMonth: number;
  budgetMonth: number;
  expenseCount: number;
  docsLinked: number;
  topCategory?: string;
  topCategoryPct?: number;
}): ExpenseInsight[] {
  const out: ExpenseInsight[] = [];

  if (opts.expenseCount === 0) {
    out.push({
      id: 'empty',
      tone: 'info',
      titleKey: 'ehInsightEmptyTitle',
      bodyKey: 'ehInsightEmptyBody',
      action: 'add_expense',
    });
    return out;
  }

  const growth =
    opts.spendPrior > 0
      ? ((opts.spendPeriod - opts.spendPrior) / opts.spendPrior) * 100
      : opts.spendPeriod > 0
        ? 100
        : 0;

  if (growth >= 10) {
    out.push({
      id: 'spend-up',
      tone: 'warn',
      titleKey: 'ehInsightSpendUpTitle',
      bodyKey: 'ehInsightSpendUpBody',
      params: { pct: growth.toFixed(1) },
      action: 'categories',
    });
  } else if (growth <= -10 && opts.spendPeriod > 0) {
    out.push({
      id: 'spend-down',
      tone: 'positive',
      titleKey: 'ehInsightSpendDownTitle',
      bodyKey: 'ehInsightSpendDownBody',
      params: { pct: Math.abs(growth).toFixed(1) },
    });
  }

  if (opts.budgetMonth > 0 && opts.spendMonth > 0) {
    const pct = (opts.spendMonth / opts.budgetMonth) * 100;
    if (pct > 110) {
      out.push({
        id: 'over-budget',
        tone: 'warn',
        titleKey: 'ehInsightOverPaceTitle',
        bodyKey: 'ehInsightPaceBody',
        params: { pct: pct.toFixed(0) },
        action: 'categories',
      });
    } else if (pct <= 90) {
      out.push({
        id: 'under-budget',
        tone: 'positive',
        titleKey: 'ehInsightUnderPaceTitle',
        bodyKey: 'ehInsightPaceBody',
        params: { pct: pct.toFixed(0) },
      });
    }
  }

  if (opts.topCategory && (opts.topCategoryPct ?? 0) >= 45) {
    out.push({
      id: 'cat-heavy',
      tone: 'info',
      titleKey: 'ehInsightCatHeavyTitle',
      bodyKey: 'ehInsightCatHeavyBody',
      params: {
        cat: opts.topCategory,
        pct: (opts.topCategoryPct ?? 0).toFixed(0),
      },
      action: 'categories',
    });
  }

  if (opts.expenseCount > 0 && opts.docsLinked === 0) {
    out.push({
      id: 'no-docs',
      tone: 'info',
      titleKey: 'ehInsightNoDocsTitle',
      bodyKey: 'ehInsightNoDocsBody',
      action: 'documents',
    });
  } else if (opts.expenseCount > 3 && opts.docsLinked / opts.expenseCount < 0.3) {
    out.push({
      id: 'few-docs',
      tone: 'warn',
      titleKey: 'ehInsightFewDocsTitle',
      bodyKey: 'ehInsightFewDocsBody',
      params: {
        linked: String(opts.docsLinked),
        total: String(opts.expenseCount),
      },
      action: 'documents',
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'ok',
      tone: 'info',
      titleKey: 'ehInsightActiveTitle',
      bodyKey: 'ehInsightActiveBody',
    });
  }

  return out.slice(0, 5);
}

export type DemoExpenseSeed = {
  date: string;
  amount: number;
  category: LedgerExpenseCategory;
  description: string;
};

const DEMO_TAG = '[DEMO]';

/** ~30 days of mixed ledger expenses for the Expenses hub demo. */
export function buildExpenseDemoSeeds(anchorIso: string): DemoExpenseSeed[] {
  const seeds: DemoExpenseSeed[] = [];
  const lines: { cat: LedgerExpenseCategory; label: string; base: number }[] = [
    { cat: 'SUPPLIERS', label: 'Aligro produce', base: 420 },
    { cat: 'SUPPLIERS', label: 'Butcher delivery', base: 280 },
    { cat: 'BILLS', label: 'Electricity invoice', base: 190 },
    { cat: 'BILLS', label: 'Rent premises', base: 3500 },
    { cat: 'PAYROLL', label: 'Staff net payroll', base: 4200 },
    { cat: 'PAYROLL_TAXES', label: 'AVS / social charges', base: 980 },
    { cat: 'OTHER', label: 'Office supplies', base: 85 },
    { cat: 'OTHER', label: 'Cleaning service', base: 160 },
  ];

  for (let i = 29; i >= 0; i -= 1) {
    const date = addDaysIso(anchorIso, -i);
    const dow = new Date(date + 'T12:00:00').getDay();
    for (let li = 0; li < lines.length; li += 1) {
      const line = lines[li];
      // Rent / payroll once per ~month; suppliers more often
      if (line.cat === 'BILLS' && line.label.includes('Rent') && i % 28 !== 0) continue;
      if (line.cat === 'PAYROLL' && i % 14 !== 0) continue;
      if (line.cat === 'PAYROLL_TAXES' && i % 14 !== 0) continue;
      if (line.cat === 'BILLS' && line.label.includes('Electricity') && i % 10 !== 0) continue;
      if ((line.cat === 'SUPPLIERS' || line.cat === 'OTHER') && (i + li) % 3 !== 0) continue;
      const weekend = dow === 0 || dow === 6;
      const jitter = 0.85 + ((i * 13 + li * 7) % 25) / 100;
      const amount =
        Math.round(line.base * jitter * (weekend && line.cat === 'SUPPLIERS' ? 0.7 : 1) * 100) / 100;
      seeds.push({
        date,
        amount,
        category: line.cat,
        description: `${DEMO_TAG} ${line.label}`,
      });
    }
  }
  return seeds;
}

export function isExpenseDemoDescription(description?: string): boolean {
  return Boolean(description?.includes(DEMO_TAG));
}
