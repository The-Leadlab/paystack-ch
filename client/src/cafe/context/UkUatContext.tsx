import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { getTaxRegionConfig, type TaxRegion } from "@shared/taxRegions";
import {
  getActiveFiscalLocale,
  reportingCurrencyForLocale,
  setActiveFiscalLocale,
  type FiscalLocale,
} from "../lib/fiscalLocale";

type UkUatContextValue = {
  /** True when the Admin UK UAT sandbox is active. */
  ukUatActive: boolean;
  fiscalLocale: FiscalLocale;
  taxRegion: TaxRegion;
  currency: "CHF" | "GBP";
  currencySuffix: string;
};

const UkUatContext = createContext<UkUatContextValue>({
  ukUatActive: false,
  fiscalLocale: "ch",
  taxRegion: "ch",
  currency: "CHF",
  currencySuffix: " CHF",
});

/**
 * Wrap the Admin UK dashboard so tax region, currency, and Gemini prompts
 * switch to UK (GBP, VAT 0/5/20%) for UAT — without changing production /app.
 */
export function UkUatProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  // Sync module locale immediately so Gemini / vatReview see UK on first paint
  // (useEffect alone would leave a CH window before the effect runs).
  setActiveFiscalLocale(active ? "uk" : "ch");

  useEffect(() => {
    setActiveFiscalLocale(active ? "uk" : "ch");
    return () => {
      setActiveFiscalLocale("ch");
    };
  }, [active]);

  const value = useMemo<UkUatContextValue>(() => {
    const fiscalLocale: FiscalLocale = active ? "uk" : getActiveFiscalLocale();
    const taxRegion: TaxRegion = fiscalLocale === "uk" ? "uk" : "ch";
    const currency = reportingCurrencyForLocale(fiscalLocale);
    return {
      ukUatActive: active,
      fiscalLocale,
      taxRegion,
      currency,
      currencySuffix: ` ${currency}`,
    };
  }, [active]);

  // Touch config so rates are warm for InvoiceMaker / VAT UI
  void getTaxRegionConfig(value.taxRegion);

  return <UkUatContext.Provider value={value}>{children}</UkUatContext.Provider>;
}

export function useUkUat(): UkUatContextValue {
  return useContext(UkUatContext);
}
