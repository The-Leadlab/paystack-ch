/** Money display for personal plan UI — always CHF (Swiss personal product). */
import { formatMoney } from "@shared/displayCurrency";

export function formatChfDisplay(n: number, opts?: { decimals?: boolean; prefix?: boolean }): string {
  const decimals = opts?.decimals !== false;
  if (opts?.prefix === false) {
    return n.toLocaleString("de-CH", {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
  }
  const formatted = formatMoney(n, "CHF");
  if (decimals) return formatted;
  // Strip cents when explicitly requested
  return formatMoney(Math.round(n), "CHF").replace(/[.,]00$/, "");
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
