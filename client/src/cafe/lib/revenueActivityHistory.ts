/** Revenue tab activity log — Import history (not Z-reading cards). */

export type RevenueActivityType =
  | 'z_reading'
  | 'csv_import'
  | 'demo_load'
  | 'demo_refresh'
  | 'sector_change';

export type RevenueActivity = {
  id: string;
  at: string;
  type: RevenueActivityType;
  label: string;
  detail?: string;
  amountChf?: number;
};

const STORAGE_KEY = 'paystack.revenue.activityHistory';
const MAX = 100;

export function loadRevenueActivity(): RevenueActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RevenueActivity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRevenueActivity(
  entry: Omit<RevenueActivity, 'id' | 'at'> & { at?: string }
): RevenueActivity[] {
  const next: RevenueActivity = {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at || new Date().toISOString(),
    type: entry.type,
    label: entry.label,
    detail: entry.detail,
    amountChf: entry.amountChf,
  };
  const list = [next, ...loadRevenueActivity()].slice(0, MAX);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}
