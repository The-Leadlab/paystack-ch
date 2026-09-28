/**
 * Active fiscal locale for document AI + VAT review.
 * Set by UkUatProvider: forced UK on /admin-uk, or from the user's taxRegion on /app.
 */
import { getTaxRegionConfig } from "@shared/taxRegions";

export type FiscalLocale = "ch" | "uk";

let activeFiscalLocale: FiscalLocale = "ch";

export function setActiveFiscalLocale(locale: FiscalLocale): void {
  activeFiscalLocale = locale;
}

export function getActiveFiscalLocale(): FiscalLocale {
  return activeFiscalLocale;
}

export function reportingCurrencyForLocale(locale: FiscalLocale = activeFiscalLocale): "CHF" | "GBP" {
  return locale === "uk" ? "GBP" : "CHF";
}

export function currencySymbolForLocale(locale: FiscalLocale = activeFiscalLocale): string {
  return locale === "uk" ? "£" : "CHF";
}

export function moneyLocaleForFiscal(locale: FiscalLocale = activeFiscalLocale, _uiLang?: "en" | "fr"): string {
  if (locale === "uk") return "en-GB";
  return "de-CH";
}

export function defaultVatRatePercent(locale: FiscalLocale = activeFiscalLocale): number {
  return getTaxRegionConfig(locale === "uk" ? "uk" : "ch").defaultRate;
}

export function vatRatePresets(locale: FiscalLocale = activeFiscalLocale): number[] {
  return [...getTaxRegionConfig(locale === "uk" ? "uk" : "ch").rates];
}

/** Seed rows for the multi-rate VAT editor (CH 0/2.6/8.1 · UK 0/5/20). */
export function defaultVatBreakdownLines(locale: FiscalLocale = activeFiscalLocale): Array<{
  ratePercent: number;
  baseExclusive: number;
  vatAmount: number;
}> {
  return vatRatePresets(locale).map((ratePercent) => ({
    ratePercent,
    baseExclusive: 0,
    vatAmount: 0,
  }));
}

export function formatReportingMoney(
  amount: number,
  locale: FiscalLocale = activeFiscalLocale
): string {
  const cur = reportingCurrencyForLocale(locale);
  return `${amount.toLocaleString(moneyLocaleForFiscal(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${cur}`;
}
