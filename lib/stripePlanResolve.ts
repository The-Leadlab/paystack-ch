import type Stripe from "stripe";
import { parsePaystackPlanId, type PaystackPlanId } from "../shared/planCatalog.js";

function firstSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  const p = item?.price;
  if (!p) return null;
  return typeof p === "string" ? p : p.id;
}

/** Resolve plan from subscription metadata or by matching configured Stripe Price IDs. */
export function resolvePlanIdFromStripeSubscription(
  subscription: Stripe.Subscription,
  useTestPrices = false
): PaystackPlanId {
  const fromMeta = parsePaystackPlanId(subscription.metadata?.planId);
  if (fromMeta) return fromMeta;

  const priceId = firstSubscriptionPriceId(subscription);
  if (priceId) {
    if (useTestPrices) {
      if (priceId === process.env.STRIPE_TEST_PRICE_STARTER?.trim()) return "starter";
      if (priceId === process.env.STRIPE_TEST_PRICE_BUSINESS?.trim()) return "business";
      if (priceId === process.env.STRIPE_TEST_PRICE_UNLIMITED?.trim()) return "unlimited";
      const legacyTest = process.env.STRIPE_TEST_PRICE_ID?.trim();
      if (legacyTest && priceId === legacyTest) {
        return parsePaystackPlanId(process.env.STRIPE_DEFAULT_PLAN_ID) || "starter";
      }
    } else {
      if (priceId === process.env.STRIPE_PRICE_STARTER?.trim()) return "starter";
      if (priceId === process.env.STRIPE_PRICE_BUSINESS?.trim()) return "business";
      if (priceId === process.env.STRIPE_PRICE_UNLIMITED?.trim()) return "unlimited";
      const legacy = process.env.STRIPE_PRICE_ID?.trim();
      if (legacy && priceId === legacy) {
        return parsePaystackPlanId(process.env.STRIPE_DEFAULT_PLAN_ID) || "starter";
      }
    }
  }
  return "starter";
}
