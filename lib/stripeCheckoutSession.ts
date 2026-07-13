/**
 * Shared Stripe Checkout session params for subscription trials (guest + authenticated).
 */
import type Stripe from "stripe";
import { parseTruthyEnv } from "../shared/stripeMode.js";
import { isProductionPaystackHost } from "../shared/paystackHosts.js";
import type { PaystackPlanId } from "../shared/planCatalog.js";
import { trialDays } from "./stripeCore.js";

export type StripeCheckoutMode = "live" | "test";

export function stripeSecretKeyForMode(useTest: boolean): string | null {
  const key = (useTest ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY)?.trim();
  return key || null;
}

export function stripeKeyMode(key: string): StripeCheckoutMode | null {
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return null;
}

export function isProductionPaystackOrigin(origin: string): boolean {
  try {
    return isProductionPaystackHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Ensures checkout mode, API key prefix, and optional production host policy align.
 * Real cards always fail in test Checkout — this is the #1 cause of “declined” with no bank SMS.
 */
export function assertStripeCheckoutConfig(
  useTest: boolean,
  origin: string,
  options?: { sandboxSource?: "build" | "query" | "server" }
): { mode: StripeCheckoutMode; key: string } {
  const key = stripeSecretKeyForMode(useTest);
  if (!key) {
    throw Object.assign(
      new Error(
        useTest
          ? "Stripe test checkout is not configured (STRIPE_TEST_SECRET_KEY)."
          : "Stripe checkout is not configured (STRIPE_SECRET_KEY)."
      ),
      { status: 503 }
    );
  }

  const keyMode = stripeKeyMode(key);
  if (!keyMode) {
    throw Object.assign(new Error("Stripe secret key must start with sk_live_ or sk_test_."), { status: 503 });
  }

  const expectedMode: StripeCheckoutMode = useTest ? "test" : "live";
  if (keyMode !== expectedMode) {
    throw Object.assign(
      new Error(
        `Stripe key mismatch: checkout is ${expectedMode} but STRIPE_${useTest ? "TEST_" : ""}SECRET_KEY is ${keyMode}. ` +
          `Fix Vercel env (unset VITE_STRIPE_USE_TEST / STRIPE_USE_TEST_MODE on production) and use matching Price IDs.`
      ),
      { status: 503 }
    );
  }

  const prodHost = isProductionPaystackOrigin(origin);
  const allowTestOnProd = parseTruthyEnv(process.env.STRIPE_ALLOW_TEST_ON_PRODUCTION);
  const blockedSandboxOnProd =
    prodHost &&
    useTest &&
    !allowTestOnProd &&
    (options?.sandboxSource === "build" || options?.sandboxSource === "server");
  if (blockedSandboxOnProd) {
    throw Object.assign(
      new Error(
        "Stripe sandbox is active on paystack.ch — real cards are declined without contacting your bank. " +
          "Unset VITE_STRIPE_USE_TEST and STRIPE_USE_TEST_MODE in Vercel, redeploy, or use ?stripe_test=1 only for intentional sandbox QA."
      ),
      { status: 503, code: "stripe_test_on_production" }
    );
  }

  return { mode: keyMode, key };
}

/** Validate Dashboard price_ IDs before creating a subscription Checkout session. */
export async function assertRecurringChfPrice(
  stripe: Stripe,
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem
): Promise<void> {
  const priceId = lineItem.price;
  if (typeof priceId !== "string" || !priceId.startsWith("price_")) return;

  const price = await stripe.prices.retrieve(priceId);
  if (!price.active) {
    throw Object.assign(new Error(`Stripe price ${priceId} is archived. Activate it or update STRIPE_PRICE_* env.`), {
      status: 503,
    });
  }
  if (!price.recurring) {
    throw Object.assign(
      new Error(`Stripe price ${priceId} is not recurring — subscription checkout requires a monthly/yearly price.`),
      { status: 503 }
    );
  }
  if (price.currency !== "chf") {
    throw Object.assign(
      new Error(`Stripe price ${priceId} is ${price.currency.toUpperCase()}, not CHF. Create CHF prices in Stripe Dashboard.`),
      { status: 503 }
    );
  }
}

export type BuildSubscriptionCheckoutInput = {
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  planId: PaystackPlanId;
  origin: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  clientReferenceId?: string;
  customerEmail?: string;
};

/** Subscription trial Checkout — collects card via SetupIntent (CHF 0.00 today). */
export function buildSubscriptionCheckoutParams(
  input: BuildSubscriptionCheckoutInput
): Stripe.Checkout.SessionCreateParams {
  const days = trialDays();
  return {
    mode: "subscription",
    ...(input.clientReferenceId ? { client_reference_id: input.clientReferenceId } : {}),
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    line_items: [input.lineItem],
    subscription_data: {
      trial_period_days: days,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      metadata: input.metadata,
    },
    metadata: input.metadata,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    payment_method_collection: "always",
    billing_address_collection: "auto",
    payment_method_options: {
      card: {
        // Swiss/EU cards often need explicit SCA during $0 trial setup — avoids silent issuer declines.
        request_three_d_secure: "any",
      },
    },
  };
}
