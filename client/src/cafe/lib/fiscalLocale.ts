/**
 * Active fiscal locale for document AI + VAT review.
 * Set by UkUatProvider when the password-gated /admin-uk sandbox is open.
 */
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

export function moneyLocaleForFiscal(locale: FiscalLocale, uiLang: "en" | "fr"): string {
  if (locale === "uk") return uiLang === "fr" ? "en-GB" : "en-GB";
  return uiLang === "fr" ? "fr-CH" : "en-CH";
}
