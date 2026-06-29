/** Swiss CHF display for personal plan UI (de-CH apostrophe separator). */
export function formatChfDisplay(n: number, opts?: { decimals?: boolean; prefix?: boolean }): string {
  const decimals = opts?.decimals ?? false;
  const formatted = n.toLocaleString("de-CH", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  const prefix = opts?.prefix !== false;
  return prefix ? `CHF ${formatted}` : formatted;
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
