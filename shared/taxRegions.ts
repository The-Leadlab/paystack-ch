export const TAX_REGIONS = ["ch", "uk", "off"] as const;

export type TaxRegion = (typeof TAX_REGIONS)[number];

export type TaxRegionConfig = {
  region: TaxRegion;
  rates: readonly number[];
  defaultRate: number;
};

const TAX_REGION_CONFIGS: Record<TaxRegion, TaxRegionConfig> = {
  ch: { region: "ch", rates: [0, 2.6, 8.1], defaultRate: 8.1 },
  uk: { region: "uk", rates: [0, 5, 20], defaultRate: 20 },
  off: { region: "off", rates: [0], defaultRate: 0 },
};

export function parseTaxRegion(raw: unknown): TaxRegion {
  return typeof raw === "string" && TAX_REGIONS.includes(raw as TaxRegion)
    ? (raw as TaxRegion)
    : "ch";
}

export function getTaxRegionConfig(
  region: TaxRegion | string | null | undefined
): TaxRegionConfig {
  return TAX_REGION_CONFIGS[parseTaxRegion(region)];
}
