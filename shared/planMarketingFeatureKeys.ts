import type { PaystackPlanId } from "./planCatalog";

/**
 * Translation keys under `LanguageContext` — must match `PricingSection` / landing copy per tier.
 */
export const PLAN_MARKETING_FEATURE_KEYS: Record<PaystackPlanId, readonly string[]> = {
  starter: [
    "planStarterFeature1",
    "planStarterFeature2",
    "planStarterFeature3",
    "planStarterFeature4",
    "planStarterFeature5",
    "planStarterFeature6",
  ],
  business: [
    "planBusinessFeature1",
    "planBusinessFeature2",
    "planBusinessFeature3",
    "planBusinessFeature4",
    "planBusinessFeature5",
    "planBusinessFeature6",
    "planBusinessFeature7",
  ],
  unlimited: [
    "planUnlimitedFeature1",
    "planUnlimitedFeature2",
    "planUnlimitedFeature3",
    "planUnlimitedFeature4",
    "planUnlimitedFeature5",
    "planUnlimitedFeature6",
  ],
  enterprise: [
    "planEnterpriseFeature1",
    "planEnterpriseFeature2",
    "planEnterpriseFeature3",
    "planEnterpriseFeature4",
    "planEnterpriseFeature5",
    "planEnterpriseFeature6",
    "planEnterpriseFeature7",
    "planEnterpriseFeature8",
  ],
};

export function planMarketingFeatureKeys(planId: PaystackPlanId | null | undefined): readonly string[] {
  if (!planId) return PLAN_MARKETING_FEATURE_KEYS.starter;
  return PLAN_MARKETING_FEATURE_KEYS[planId] ?? PLAN_MARKETING_FEATURE_KEYS.starter;
}
