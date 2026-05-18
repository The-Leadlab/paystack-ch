/**
 * Paystack pricing tiers and entitlements (mirrors public pricing page).
 * Live Stripe Price IDs: STRIPE_PRICE_STARTER, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_UNLIMITED.
 * Test Price IDs: STRIPE_TEST_PRICE_STARTER, STRIPE_TEST_PRICE_BUSINESS, STRIPE_TEST_PRICE_UNLIMITED (guest body `stripeTest`).
 *
 * Unit economics (CHF/mo, indicative — verify against Google Cloud + Firebase bills):
 * Model: gemini-2.5-flash via server proxy; ~CHF 0.08–0.15/doc (simple), CHF 0.20–0.40+ (multi-page PDF / 2nd pass).
 *
 * | Plan      | Retail | Docs/mo | Est. AI @ 100% cap | Stripe ~3% | Rough margin @ cap |
 * |-----------|--------|---------|------------------|------------|-------------------|
 * | Starter   | 29     | 50      | 4–8              | ~1         | ~65–85%           |
 * | Business  | 59     | 120     | 10–20            | ~2         | ~60–80%           |
 * | Unlimited | 499    | ∞       | unbounded risk   | ~15        | depends on usage  |
 *
 * Business at 500 docs/mo ≈ CHF 40–75+ AI alone → loss at CHF 59. Cap lowered to 120.
 */

export const SELECTED_PLAN_STORAGE_KEY = "paystack_selected_plan_id";

export type PaystackPlanId = "starter" | "business" | "unlimited" | "enterprise";

/** Public list prices (CHF/month) — keep in sync with landing copy and STRIPE_PRICE_* env. */
export const PLAN_MONTHLY_PRICE_CHF: Record<Exclude<PaystackPlanId, "enterprise">, number> = {
  starter: 29,
  business: 59,
  unlimited: 499,
};

export type PlanEntitlements = {
  maxDocumentsPerMonth: number | null;
  maxEmployeeSlots: number | null;
  maxSessions: number | null;
  basicReportsAndExports: boolean;
  advancedAnalyticsAndReports: boolean;
  allCoreModules: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  whiteLabelOption: boolean;
  customIntegration: boolean;
  dedicatedAccountManager: boolean;
  slaUptime: boolean;
  onPremiseDeployment: boolean;
};

/** Full access when billing enforcement is off (dev / internal). */
export const UNRESTRICTED_ENTITLEMENTS: PlanEntitlements = {
  maxDocumentsPerMonth: null,
  maxEmployeeSlots: null,
  maxSessions: null,
  basicReportsAndExports: true,
  advancedAnalyticsAndReports: true,
  allCoreModules: true,
  apiAccess: true,
  prioritySupport: true,
  whiteLabelOption: true,
  customIntegration: true,
  dedicatedAccountManager: true,
  slaUptime: true,
  onPremiseDeployment: true,
};

export const PLAN_ENTITLEMENTS: Record<PaystackPlanId, PlanEntitlements> = {
  starter: {
    maxDocumentsPerMonth: 50,
    maxEmployeeSlots: 1,
    maxSessions: 2,
    basicReportsAndExports: true,
    advancedAnalyticsAndReports: false,
    allCoreModules: false,
    apiAccess: false,
    prioritySupport: false,
    whiteLabelOption: false,
    customIntegration: false,
    dedicatedAccountManager: false,
    slaUptime: false,
    onPremiseDeployment: false,
  },
  business: {
    maxDocumentsPerMonth: 120,
    maxEmployeeSlots: 10,
    maxSessions: null,
    basicReportsAndExports: true,
    advancedAnalyticsAndReports: true,
    allCoreModules: true,
    apiAccess: true,
    prioritySupport: true,
    whiteLabelOption: false,
    customIntegration: false,
    dedicatedAccountManager: false,
    slaUptime: false,
    onPremiseDeployment: false,
  },
  unlimited: {
    maxDocumentsPerMonth: null,
    maxEmployeeSlots: null,
    maxSessions: null,
    basicReportsAndExports: true,
    advancedAnalyticsAndReports: true,
    allCoreModules: true,
    apiAccess: true,
    prioritySupport: true,
    whiteLabelOption: false,
    customIntegration: false,
    dedicatedAccountManager: false,
    slaUptime: false,
    onPremiseDeployment: false,
  },
  enterprise: {
    maxDocumentsPerMonth: null,
    maxEmployeeSlots: null,
    maxSessions: null,
    basicReportsAndExports: true,
    advancedAnalyticsAndReports: true,
    allCoreModules: true,
    apiAccess: true,
    prioritySupport: true,
    whiteLabelOption: true,
    customIntegration: true,
    dedicatedAccountManager: true,
    slaUptime: true,
    onPremiseDeployment: true,
  },
};

export function parsePaystackPlanId(raw: unknown): PaystackPlanId | null {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "starter" || s === "stater") return "starter";
  if (s === "business") return "business";
  if (s === "unlimited") return "unlimited";
  if (s === "enterprise") return "enterprise";
  return null;
}

/** Self-serve Stripe plans (enterprise is sales-led). */
export function isSelfServePlan(id: PaystackPlanId): boolean {
  return id !== "enterprise";
}

export function entitlementsForPlan(planId: PaystackPlanId | null | undefined): PlanEntitlements {
  if (!planId) return PLAN_ENTITLEMENTS.starter;
  return PLAN_ENTITLEMENTS[planId] ?? PLAN_ENTITLEMENTS.starter;
}

/** Resolve Stripe recurring Price id from plan (server env). */
export function stripePriceIdForPlan(planId: PaystackPlanId, useTestPrices = false): string | null {
  if (useTestPrices) {
    const env =
      planId === "starter"
        ? process.env.STRIPE_TEST_PRICE_STARTER
        : planId === "business"
          ? process.env.STRIPE_TEST_PRICE_BUSINESS
          : planId === "unlimited"
            ? process.env.STRIPE_TEST_PRICE_UNLIMITED
            : null;
    const v = env?.trim();
    return v || null;
  }
  const env =
    planId === "starter"
      ? process.env.STRIPE_PRICE_STARTER
      : planId === "business"
        ? process.env.STRIPE_PRICE_BUSINESS
        : planId === "unlimited"
          ? process.env.STRIPE_PRICE_UNLIMITED
          : null;
  const v = env?.trim();
  return v || null;
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Count completed documents whose created_at falls in the current calendar month (YYYY-MM prefix). */
export function countCompletedDocumentsThisMonth(
  documents: { status?: string; created_at?: string }[],
  monthKey = currentMonthKey()
): number {
  return documents.filter(
    (doc) =>
      doc.status === "completed" &&
      typeof doc.created_at === "string" &&
      doc.created_at.slice(0, 7) === monthKey
  ).length;
}
