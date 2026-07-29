/**
 * Detect legacy personal-ledger rows that were incorrectly written into the
 * business Firestore expenses collection (pre-IndexedDB isolation).
 */

const PERSONAL_PREFIXES = [
  'groceries',
  'going out',
  'going out:',
  'bills:',
  'rent:',
  'shopping',
  'shopping:',
  'savings & invest',
  'savings & invest:',
  'salary:',
  'asset revenue',
  'contributions:',
];

export function isLikelyPersonalExpenseDescription(description?: string | null): boolean {
  const d = (description || '').trim().toLowerCase();
  if (!d) return false;
  return PERSONAL_PREFIXES.some((p) => d === p || d.startsWith(`${p}:`) || d.startsWith(`${p} `) || d.startsWith(p));
}

export function filterBusinessExpenses<T extends { description?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !isLikelyPersonalExpenseDescription(r.description));
}
