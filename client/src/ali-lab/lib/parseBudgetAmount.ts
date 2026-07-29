/** Parse budget/amount text accepting Swiss/EU formats (12,50 / 1'200 / 1200.50). */

export function parseBudgetAmount(raw: string): number {
  if (!raw?.trim()) return 0;
  let t = raw.trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[^\d.,\-']/g, "").replace(/'/g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (t.includes(",") && !t.includes(".")) {
    t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}
