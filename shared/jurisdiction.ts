import { parseTaxRegion, type TaxRegion } from "./taxRegions";
import type { DisplayCurrency } from "./displayCurrency";

export const JURISDICTION_COUNTRIES = ["ch", "gb", "fr"] as const;

export type JurisdictionCountry = (typeof JURISDICTION_COUNTRIES)[number];

export type JurisdictionConfig = {
  country: JurisdictionCountry;
  ready: boolean;
  taxRegion: TaxRegion;
  currency: DisplayCurrency;
};

const CONFIG: Record<JurisdictionCountry, JurisdictionConfig> = {
  ch: { country: "ch", ready: true, taxRegion: "ch", currency: "CHF" },
  gb: { country: "gb", ready: true, taxRegion: "uk", currency: "GBP" },
  fr: { country: "fr", ready: false, taxRegion: "off", currency: "EUR" },
};

export function parseJurisdictionCountry(
  raw: unknown,
  fallback: JurisdictionCountry = "ch"
): JurisdictionCountry {
  return typeof raw === "string" && JURISDICTION_COUNTRIES.includes(raw as JurisdictionCountry)
    ? (raw as JurisdictionCountry)
    : fallback;
}

export function getJurisdictionConfig(country: JurisdictionCountry): JurisdictionConfig {
  return CONFIG[country];
}

export function taxRegionFromIncorporation(country: JurisdictionCountry | string | null | undefined): TaxRegion {
  return getJurisdictionConfig(parseJurisdictionCountry(country)).taxRegion;
}

export function currencyFromIncorporation(
  country: JurisdictionCountry | string | null | undefined
): DisplayCurrency {
  return getJurisdictionConfig(parseJurisdictionCountry(country)).currency;
}

export function isJurisdictionReady(country: JurisdictionCountry): boolean {
  return CONFIG[country].ready;
}

/** Prefer explicit tax region; otherwise derive from incorporation country. */
export function resolveTaxRegion(opts: {
  taxRegion?: unknown;
  incorporationCountry?: unknown;
}): TaxRegion {
  if (typeof opts.taxRegion === "string" && opts.taxRegion.trim()) {
    return parseTaxRegion(opts.taxRegion);
  }
  return taxRegionFromIncorporation(opts.incorporationCountry);
}
