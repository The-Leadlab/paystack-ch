import {
  getTaxRegionConfig,
  type TaxRegion,
} from "@shared/taxRegions";
import { useUkUat } from "../context/UkUatContext";

/** Live tax region from UkUatProvider (onSnapshot / sandbox force). */
export function useTaxRegion(): { taxRegion: TaxRegion; loading: boolean } {
  const { taxRegion, regionReady } = useUkUat();
  return { taxRegion, loading: !regionReady };
}

export function useTaxRegionConfig() {
  const { taxRegion, loading } = useTaxRegion();
  return { taxRegion, taxConfig: getTaxRegionConfig(taxRegion), loading };
}
