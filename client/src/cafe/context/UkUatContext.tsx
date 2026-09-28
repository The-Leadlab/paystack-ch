import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getTaxRegionConfig, type TaxRegion } from "@shared/taxRegions";
import { resolveTaxRegion } from "@shared/jurisdiction";
import {
  getActiveFiscalLocale,
  reportingCurrencyForLocale,
  setActiveFiscalLocale,
  type FiscalLocale,
} from "../lib/fiscalLocale";
import {
  FIRESTORE_ADMIN_UK_DATABASE_ID,
  FIRESTORE_DEFAULT_DATABASE_ID,
  db,
  getActiveFirestoreDatabaseId,
  setActiveFirestoreDatabase,
} from "../lib/firebase";
import { useAuth } from "./AuthContext";

type UkUatContextValue = {
  /** True when the Admin UK UAT sandbox is active. */
  ukUatActive: boolean;
  fiscalLocale: FiscalLocale;
  taxRegion: TaxRegion;
  currency: "CHF" | "GBP";
  currencySuffix: string;
  /** Named Firestore database id (isolated from Swiss production when UAT). */
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

function localeFromTaxRegion(region: TaxRegion): FiscalLocale {
  return region === "uk" ? "uk" : "ch";
}

/**
 * Wrap the Admin UK dashboard (`active`) or production `/app` (`active={false}`).
 * When active: GBP + UK VAT + isolated Firestore `admin-uk-uat`.
 * When inactive: follow the user's incorporation / taxRegion (CHF or GBP) without
 * switching Firestore databases — production data stays on `(default)`.
 */
export function UkUatProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [profileTaxRegion, setProfileTaxRegion] = useState<TaxRegion>("ch");

  // Sync module locale + Firestore DB immediately so providers under this tree
  // never open listeners on the wrong database.
  const forcedLocale: FiscalLocale = active ? "uk" : localeFromTaxRegion(profileTaxRegion);
  setActiveFiscalLocale(forcedLocale);
  setActiveFirestoreDatabase(active ? FIRESTORE_ADMIN_UK_DATABASE_ID : FIRESTORE_DEFAULT_DATABASE_ID);

  useEffect(() => {
    if (active) {
      setActiveFiscalLocale("uk");
      setActiveFirestoreDatabase(FIRESTORE_ADMIN_UK_DATABASE_ID);
      return () => {
        setActiveFiscalLocale("ch");
        setActiveFirestoreDatabase(FIRESTORE_DEFAULT_DATABASE_ID);
      };
    }

    setActiveFirestoreDatabase(FIRESTORE_DEFAULT_DATABASE_ID);
    setActiveFiscalLocale(localeFromTaxRegion(profileTaxRegion));
    return () => {
      setActiveFiscalLocale("ch");
      setActiveFirestoreDatabase(FIRESTORE_DEFAULT_DATABASE_ID);
    };
  }, [active, profileTaxRegion]);

  useEffect(() => {
    if (active || !user?.uid || !db) {
      if (active) setProfileTaxRegion("uk");
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const data = snapshot.data();
        setProfileTaxRegion(
          resolveTaxRegion({
            taxRegion: data?.taxRegion,
            incorporationCountry: data?.incorporationCountry,
          })
        );
      },
      (error) => {
        console.warn("UkUatProvider: could not watch tax region", error);
        setProfileTaxRegion("ch");
      }
    );
    return () => unsub();
  }, [active, user?.uid]);

  const value = useMemo<UkUatContextValue>(() => {
    const fiscalLocale: FiscalLocale = active
      ? "uk"
      : localeFromTaxRegion(profileTaxRegion);
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
  }, [active, profileTaxRegion]);

  // Touch config so rates are warm for InvoiceMaker / VAT UI
  void getTaxRegionConfig(value.taxRegion);
  // Keep module in sync even if a child reads getActiveFiscalLocale() mid-render
  if (getActiveFiscalLocale() !== value.fiscalLocale) {
    setActiveFiscalLocale(value.fiscalLocale);
  }

  return <UkUatContext.Provider value={value}>{children}</UkUatContext.Provider>;
}

export function useUkUat(): UkUatContextValue {
  return useContext(UkUatContext);
}
