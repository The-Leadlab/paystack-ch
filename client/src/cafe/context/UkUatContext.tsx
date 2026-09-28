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
import {
  FIRESTORE_ADMIN_UK_DATABASE_ID,
  FIRESTORE_DEFAULT_DATABASE_ID,
  getActiveFirestoreDatabaseId,
  setActiveFirestoreDatabase,
} from "../lib/firebase";

type UkUatContextValue = {
  /** True when the Admin UK UAT sandbox is active. */
  ukUatActive: boolean;
  fiscalLocale: FiscalLocale;
  taxRegion: TaxRegion;
  currency: "CHF" | "GBP";
  currencySuffix: string;
  /** Named Firestore database id (isolated from Swiss production). */
  firestoreDatabaseId: string;
};

const UkUatContext = createContext<UkUatContextValue>({
  ukUatActive: false,
  fiscalLocale: "ch",
  taxRegion: "ch",
  currency: "CHF",
  currencySuffix: " CHF",
  firestoreDatabaseId: FIRESTORE_DEFAULT_DATABASE_ID,
});

/**
 * Wrap the Admin UK dashboard so tax region, currency, Gemini prompts, and
 * Firestore (`admin-uk-uat`) switch to UK for UAT — without changing production /app.
 */
export function UkUatProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  // Sync module locale + Firestore DB immediately so providers under this tree
  // never open listeners on the Swiss (default) database.
  setActiveFiscalLocale(active ? "uk" : "ch");
  setActiveFirestoreDatabase(active ? FIRESTORE_ADMIN_UK_DATABASE_ID : FIRESTORE_DEFAULT_DATABASE_ID);

  useEffect(() => {
    setActiveFiscalLocale(active ? "uk" : "ch");
    setActiveFirestoreDatabase(active ? FIRESTORE_ADMIN_UK_DATABASE_ID : FIRESTORE_DEFAULT_DATABASE_ID);
    return () => {
      setActiveFiscalLocale("ch");
      setActiveFirestoreDatabase(FIRESTORE_DEFAULT_DATABASE_ID);
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
      firestoreDatabaseId: active
        ? FIRESTORE_ADMIN_UK_DATABASE_ID
        : getActiveFirestoreDatabaseId(),
    };
  }, [active]);

  // Touch config so rates are warm for InvoiceMaker / VAT UI
  void getTaxRegionConfig(value.taxRegion);

  return <UkUatContext.Provider value={value}>{children}</UkUatContext.Provider>;
}

export function useUkUat(): UkUatContextValue {
  return useContext(UkUatContext);
}
