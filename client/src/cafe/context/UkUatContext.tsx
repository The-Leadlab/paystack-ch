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

const TAX_REGION_CACHE_PREFIX = "paystack:taxRegion:";

function readCachedTaxRegion(uid: string | undefined): TaxRegion | null {
  if (!uid || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${TAX_REGION_CACHE_PREFIX}${uid}`);
    if (raw === "ch" || raw === "uk" || raw === "off") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedTaxRegion(uid: string | undefined, region: TaxRegion): void {
  if (!uid || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${TAX_REGION_CACHE_PREFIX}${uid}`, region);
  } catch {
    /* ignore */
  }
}

type UkUatContextValue = {
  /** True when the Admin UK UAT sandbox is active. */
  ukUatActive: boolean;
  /** False until profile tax region has resolved (or sandbox forced UK). */
  regionReady: boolean;
  fiscalLocale: FiscalLocale;
  taxRegion: TaxRegion;
  currency: "CHF" | "GBP";
  currencySuffix: string;
  /** Named Firestore database id (isolated from Swiss production when UAT). */
  firestoreDatabaseId: string;
};

const UkUatContext = createContext<UkUatContextValue>({
  ukUatActive: false,
  regionReady: true,
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
  const cached = readCachedTaxRegion(user?.uid);
  const [profileTaxRegion, setProfileTaxRegion] = useState<TaxRegion>(
    active ? "uk" : cached ?? "ch"
  );
  const [regionReady, setRegionReady] = useState(active || !user?.uid);

  // Sync module locale + Firestore DB immediately so providers under this tree
  // never open listeners on the wrong database.
  const forcedLocale: FiscalLocale = active ? "uk" : localeFromTaxRegion(profileTaxRegion);
  setActiveFiscalLocale(forcedLocale);
  setActiveFirestoreDatabase(active ? FIRESTORE_ADMIN_UK_DATABASE_ID : FIRESTORE_DEFAULT_DATABASE_ID);

  useEffect(() => {
    if (active) {
      setActiveFiscalLocale("uk");
      setActiveFirestoreDatabase(FIRESTORE_ADMIN_UK_DATABASE_ID);
      setRegionReady(true);
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
      if (active) {
        setProfileTaxRegion("uk");
        setRegionReady(true);
      } else if (!user?.uid) {
        setRegionReady(true);
      }
      return;
    }

    setRegionReady(false);
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const data = snapshot.data();
        const next = resolveTaxRegion({
          taxRegion: data?.taxRegion,
          incorporationCountry: data?.incorporationCountry,
        });
        setProfileTaxRegion(next);
        writeCachedTaxRegion(user.uid, next);
        setRegionReady(true);
      },
      (error) => {
        console.warn("UkUatProvider: could not watch tax region", error);
        setProfileTaxRegion(cached ?? "ch");
        setRegionReady(true);
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
      regionReady: active ? true : regionReady,
      fiscalLocale,
      taxRegion,
      currency,
      currencySuffix: ` ${currency}`,
      firestoreDatabaseId: active
        ? FIRESTORE_ADMIN_UK_DATABASE_ID
        : getActiveFirestoreDatabaseId(),
    };
  }, [active, profileTaxRegion, regionReady]);

  // Touch config so rates are warm for Invoice Maker / VAT UI
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
