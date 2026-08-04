/** Expenses tab activity log. */

export type ExpenseActivityType = 'expense_add' | 'demo_load' | 'demo_refresh' | 'category_filter';

export type ExpenseActivity = {
  id: string;
  at: string;
  type: ExpenseActivityType;
  label: string;
  detail?: string;
  amountChf?: number;
};

const STORAGE_KEY = 'paystack.expenses.activityHistory';
const MAX = 100;

export function loadExpenseActivity(): ExpenseActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpenseActivity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushExpenseActivity(
  entry: Omit<ExpenseActivity, 'id' | 'at'> & { at?: string }
): ExpenseActivity[] {
  const next: ExpenseActivity = {
    id: `eact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at || new Date().toISOString(),
    type: entry.type,
    label: entry.label,
    detail: entry.detail,
    amountChf: entry.amountChf,
  };
  const list = [next, ...loadExpenseActivity()].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}
