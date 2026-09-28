import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  getTaxRegionConfig,
  type TaxRegion,
} from "@shared/taxRegions";
import { resolveTaxRegion } from "@shared/jurisdiction";
import { useAuth } from "../context/AuthContext";
import { useUkUat } from "../context/UkUatContext";
import { db } from "../lib/firebase";

export function useTaxRegion(): { taxRegion: TaxRegion; loading: boolean } {
  const { user } = useAuth();
  const { ukUatActive, taxRegion: ukTaxRegion } = useUkUat();
  const [taxRegion, setTaxRegion] = useState<TaxRegion>("ch");
  const [loading, setLoading] = useState(Boolean(user?.uid) && !ukUatActive);

  useEffect(() => {
    if (ukUatActive) {
      setTaxRegion(ukTaxRegion);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTaxRegion() {
      if (!user?.uid || !db) {
        if (!cancelled) {
          setTaxRegion("ch");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (!cancelled)
          setTaxRegion(
            resolveTaxRegion({
              taxRegion: snapshot.data()?.taxRegion,
              incorporationCountry: snapshot.data()?.incorporationCountry,
            })
          );
      } catch (error) {
        console.warn("Could not load tax region:", error);
        if (!cancelled) setTaxRegion("ch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTaxRegion();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, ukUatActive, ukTaxRegion]);

  return { taxRegion: ukUatActive ? ukTaxRegion : taxRegion, loading };
}

export function useTaxRegionConfig() {
  const { taxRegion, loading } = useTaxRegion();
  return { taxRegion, taxConfig: getTaxRegionConfig(taxRegion), loading };
}
