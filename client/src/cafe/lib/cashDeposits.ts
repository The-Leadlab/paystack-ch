/** Persist cash drawer deposits for Revenue insights / till advice. */

const STORAGE_KEY = 'paystack.revenue.cashDeposits';
const MAX_ROWS = 100;

export type CashDeposit = {
  id: string;
  date: string;
  amount: number;
  note?: string;
  createdAt: string;
};

function readAll(): CashDeposit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CashDeposit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: CashDeposit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_ROWS)));
}

export function loadCashDeposits(): CashDeposit[] {
  return readAll().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function addCashDeposit(input: { date: string; amount: number; note?: string }): CashDeposit {
  const row: CashDeposit = {
    id: `dep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    date: input.date,
    amount: input.amount,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  writeAll([row, ...readAll()]);
  return row;
}

export function sumDepositsInRange(start: string, end: string): number {
  return readAll().reduce((s, d) => (d.date >= start && d.date <= end ? s + d.amount : s), 0);
}

/** Suggest till float ≈ 1.5–2 days of average daily cash turnover (capped). */
export function suggestTillFloat(avgDailyCashTurnover: number): number {
  if (!Number.isFinite(avgDailyCashTurnover) || avgDailyCashTurnover <= 0) return 300;
  const raw = avgDailyCashTurnover * 1.75;
  return Math.round(Math.min(5000, Math.max(200, raw)) / 50) * 50;
}
