import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  getTaxRegionConfig,
  parseTaxRegion,
  type TaxRegion,
} from "@shared/taxRegions";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";

export function useTaxRegion(): { taxRegion: TaxRegion; loading: boolean } {
  const { user } = useAuth();
  const [taxRegion, setTaxRegion] = useState<TaxRegion>("ch");
  const [loading, setLoading] = useState(Boolean(user?.uid));

  useEffect(() => {
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
          setTaxRegion(parseTaxRegion(snapshot.data()?.taxRegion));
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
  }, [user?.uid]);

  return { taxRegion, loading };
}

export function useTaxRegionConfig() {
  const { taxRegion, loading } = useTaxRegion();
  return { taxRegion, taxConfig: getTaxRegionConfig(taxRegion), loading };
}
