/** Money display for personal plan UI — uses shared currency detection (default CHF). */
import { detectDisplayCurrency, formatMoney } from "@shared/displayCurrency";

export function formatChfDisplay(n: number, opts?: { decimals?: boolean; prefix?: boolean }): string {
  const decimals = opts?.decimals !== false;
  const currency = detectDisplayCurrency();
  if (opts?.prefix === false) {
    return n.toLocaleString(currency === "CHF" ? "de-CH" : undefined, {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
  }
  const formatted = formatMoney(n, currency);
  if (decimals) return formatted;
  // Strip cents when explicitly requested
  return formatMoney(Math.round(n), currency).replace(/[.,]00$/, "");
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
