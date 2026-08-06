/**
 * Paystack pricing tiers and entitlements (mirrors public pricing page).
 * Live Stripe Price IDs: STRIPE_PRICE_STARTER, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_UNLIMITED, STRIPE_PRICE_PERSONAL.
 * Test Price IDs: STRIPE_TEST_PRICE_* (+ PERSONAL_SEAT / PERSONAL_DOC_PACK add-ons).
 *
 * Product lines:
 * - Restaurant: starter / business / unlimited / enterprise → `/app`
 * - Personal: personal → `/app/personal` (see docs/PERSONAL_PRODUCT_SUPER_PROMPT.md)
 *
 * Unit economics (CHF/mo, indicative — verify against Google Cloud + Firebase bills):
 * Model: gemini-2.5-flash via server proxy; ~CHF 0.08–0.15/doc (simple), CHF 0.20–0.40+ (multi-page PDF / 2nd pass).
 *
 * | Plan      | Retail | Docs/mo | Est. AI @ 100% cap | Stripe ~3% | Rough margin @ cap |
 * |-----------|--------|---------|------------------|------------|-------------------|
 * | Personal  | 20     | 35*     | 3–6              | ~1         | ~70–85%           |
 * | Starter   | 29     | 35      | 3–6              | ~1         | ~70–85%           |
 * | Business  | 59     | 120     | 10–20            | ~2         | ~60–80%           |
 * | Unlimited | 499    | ∞       | unbounded risk   | ~15        | depends on usage  |
 *
 * *Personal docs; CHF 8/mo pack → 100. First invite free (2 seats); extra seat CHF 5/mo.
 * Business at 500 docs/mo ≈ CHF 40–75+ AI alone → loss at CHF 59. Cap lowered to 120.
 */

export const SELECTED_PLAN_STORAGE_KEY = "paystack_selected_plan_id";
export const SELECTED_PRODUCT_LINE_STORAGE_KEY = "paystack_selected_product_line";

export type PaystackPlanId = "personal" | "starter" | "business" | "unlimited" | "enterprise";

/** Which product surface a plan belongs to. */
export type PaystackProductLine = "personal" | "restaurant";

/** Public list prices (CHF/month) — keep in sync with landing copy and STRIPE_PRICE_* env. */
export const PLAN_MONTHLY_PRICE_CHF: Record<Exclude<PaystackPlanId, "enterprise">, number> = {
  personal: 20,
  starter: 29,
  business: 59,
  unlimited: 499,
};

/** Personal: owner + 1 free invite. */
export const PERSONAL_INCLUDED_SEATS = 2;
/** Each seat beyond included (CHF / month). */
export const PERSONAL_EXTRA_SEAT_CHF = 5;
/** Monthly doc pack list price (CHF). */
export const PERSONAL_DOC_PACK_CHF = 8;
/** Docs/month when personal doc pack is active. */
export const PERSONAL_DOC_PACK_LIMIT = 100;
/** Base personal docs/month without pack. */
export const PERSONAL_BASE_DOC_LIMIT = 35;

export type PlanEntitlements = {
  maxDocumentsPerMonth: number | null;
  /** Personal statement / finance document uploads per calendar month. */
  maxPersonalDocumentsPerMonth: number | null;
  maxEmployeeSlots: number | null;
  /** Auth seats including the owner (Personal 2 = owner + 1 free invite). */
  maxTeamSeats: number | null;
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
  maxPersonalDocumentsPerMonth: null,
  maxEmployeeSlots: null,
  maxTeamSeats: null,
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
  personal: {
    maxDocumentsPerMonth: 0,
    maxPersonalDocumentsPerMonth: PERSONAL_BASE_DOC_LIMIT,
    maxEmployeeSlots: 0,
    maxTeamSeats: PERSONAL_INCLUDED_SEATS,
    maxSessions: null,
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
  starter: {
    maxDocumentsPerMonth: 35,
    maxPersonalDocumentsPerMonth: 35,
    maxEmployeeSlots: 1,
    maxTeamSeats: 1,
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
    maxPersonalDocumentsPerMonth: 35,
    maxEmployeeSlots: 10,
    maxTeamSeats: 10,
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
    maxPersonalDocumentsPerMonth: 35,
    maxEmployeeSlots: null,
    maxTeamSeats: null,
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
    maxPersonalDocumentsPerMonth: null,
    maxEmployeeSlots: null,
    maxTeamSeats: null,
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
  if (s === "personal") return "personal";
  if (s === "starter" || s === "stater") return "starter";
  if (s === "business") return "business";
  if (s === "unlimited") return "unlimited";
  if (s === "enterprise") return "enterprise";
  return null;
}

export function parsePaystackProductLine(raw: unknown): PaystackProductLine | null {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "personal") return "personal";
  if (s === "restaurant" || s === "business" || s === "platform") return "restaurant";
  return null;
}

export function productLineForPlan(planId: PaystackPlanId | null | undefined): PaystackProductLine {
  return planId === "personal" ? "personal" : "restaurant";
}

export function isPersonalPlan(planId: PaystackPlanId | null | undefined): boolean {
  return planId === "personal";
}

export function isRestaurantPlan(planId: PaystackPlanId | null | undefined): boolean {
  return planId != null && planId !== "personal";
}

/** Unlimited (and enterprise) restaurant may open Personal without a second subscription. */
export function restaurantPlanIncludesPersonalBridge(planId: PaystackPlanId | null | undefined): boolean {
  return planId === "unlimited" || planId === "enterprise";
}

/** Self-serve Stripe plans (enterprise is sales-led). */
export function isSelfServePlan(id: PaystackPlanId): boolean {
  return id !== "enterprise";
}

export function entitlementsForPlan(planId: PaystackPlanId | null | undefined): PlanEntitlements {
  if (!planId) return PLAN_ENTITLEMENTS.starter;
  return PLAN_ENTITLEMENTS[planId] ?? PLAN_ENTITLEMENTS.starter;
}

/** Effective personal doc cap when optional CHF 8 pack is active. */
export function personalDocumentsLimit(opts?: { docPackActive?: boolean; planId?: PaystackPlanId | null }): number | null {
  if (opts?.docPackActive) return PERSONAL_DOC_PACK_LIMIT;
  const planId = opts?.planId;
  if (planId) return entitlementsForPlan(planId).maxPersonalDocumentsPerMonth;
  return PERSONAL_BASE_DOC_LIMIT;
}

/**
 * Max team seats for personal: included (2) + paid addon seats.
 * Restaurant plans ignore addonSeats and use plan entitlements.
 */
export function effectiveTeamSeats(
  planId: PaystackPlanId | null | undefined,
  paidAddonSeats = 0
): number | null {
  const base = entitlementsForPlan(planId).maxTeamSeats;
  if (base === null) return null;
  if (planId === "personal") {
    const extra = Math.max(0, Math.floor(paidAddonSeats));
    return base + extra;
  }
  return base;
}

/** Resolve Stripe recurring Price id from plan (server env). */
export function stripePriceIdForPlan(planId: PaystackPlanId, useTestPrices = false): string | null {
  if (useTestPrices) {
    const env =
      planId === "personal"
        ? process.env.STRIPE_TEST_PRICE_PERSONAL
        : planId === "starter"
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
    planId === "personal"
      ? process.env.STRIPE_PRICE_PERSONAL
      : planId === "starter"
        ? process.env.STRIPE_PRICE_STARTER
        : planId === "business"
          ? process.env.STRIPE_PRICE_BUSINESS
          : planId === "unlimited"
            ? process.env.STRIPE_PRICE_UNLIMITED
            : null;
  const v = env?.trim();
  return v || null;
}

/** Extra personal seat price (CHF 5) — Stripe Price ID or numeric amount string. */
export function stripePriceIdForPersonalSeat(useTestPrices = false): string | null {
  const env = useTestPrices
    ? process.env.STRIPE_TEST_PRICE_PERSONAL_SEAT
    : process.env.STRIPE_PRICE_PERSONAL_SEAT;
  const v = env?.trim();
  return v || String(PERSONAL_EXTRA_SEAT_CHF);
}

/** Personal doc pack price (CHF 8 → 100 docs). */
export function stripePriceIdForPersonalDocPack(useTestPrices = false): string | null {
  const env = useTestPrices
    ? process.env.STRIPE_TEST_PRICE_PERSONAL_DOC_PACK
    : process.env.STRIPE_PRICE_PERSONAL_DOC_PACK;
  const v = env?.trim();
  return v || String(PERSONAL_DOC_PACK_CHF);
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
