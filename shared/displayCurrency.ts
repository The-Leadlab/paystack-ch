/**
 * Display-currency helpers for Paystack.ch.
 * Stripe charges stay CHF until multi-currency Price IDs exist (see PERSONAL_PRODUCT_SUPER_PROMPT).
 */
import type { TaxRegion } from "./taxRegions";

export type DisplayCurrency = "CHF" | "EUR" | "GBP" | "USD";

const LOCALE_CURRENCY: Array<{ test: RegExp; currency: DisplayCurrency }> = [
  { test: /^de(-|$)/i, currency: "EUR" },
  { test: /^fr(-|$)/i, currency: "EUR" },
  { test: /^it(-|$)/i, currency: "EUR" },
  { test: /^en-GB/i, currency: "GBP" },
  { test: /^en-US/i, currency: "USD" },
  { test: /^en-CA/i, currency: "USD" },
  { test: /(-CH$|_CH$)/i, currency: "CHF" },
];

/** Prefer explicit tax region, then browser locale, then CHF. */
export function detectDisplayCurrency(opts?: {
  taxRegion?: TaxRegion | null;
  locale?: string | null;
}): DisplayCurrency {
  if (opts?.taxRegion === "ch") return "CHF";
  if (opts?.taxRegion === "uk") return "GBP";
  // taxRegion "off" → fall through to locale

  const locale =
    opts?.locale ||
    (typeof navigator !== "undefined" ? navigator.language || navigator.languages?.[0] : null) ||
    "de-CH";

  if (/-CH$/i.test(locale) || locale.toLowerCase() === "ch") return "CHF";
  for (const row of LOCALE_CURRENCY) {
    if (row.test.test(locale)) return row.currency;
  }
  return "CHF";
}

export function formatMoney(
  amount: number,
  currency: DisplayCurrency | string = "CHF",
  locale?: string
): string {
  const loc =
    locale ||
    (currency === "CHF"
      ? "de-CH"
      : currency === "EUR"
        ? "de-DE"
        : currency === "GBP"
          ? "en-GB"
          : "en-US");
  try {
    return new Intl.NumberFormat(loc, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}
