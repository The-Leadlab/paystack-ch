import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  assertStripeCheckoutConfig,
  buildSubscriptionCheckoutParams,
  isProductionPaystackOrigin,
  stripeKeyMode,
} from "../lib/stripeCheckoutSession.js";

describe("stripeCheckoutSession", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("detects production paystack hosts", () => {
    expect(isProductionPaystackOrigin("https://paystack.ch")).toBe(true);
    expect(isProductionPaystackOrigin("https://www.paystack.ch/start-trial")).toBe(true);
    expect(isProductionPaystackOrigin("http://localhost:3000")).toBe(false);
  });

  it("reads stripe key mode from prefix", () => {
    expect(stripeKeyMode("sk_test_abc")).toBe("test");
    expect(stripeKeyMode("sk_live_abc")).toBe("live");
    expect(stripeKeyMode("rk_live_abc")).toBe(null);
  });

  it("blocks build-time sandbox on production paystack.ch", () => {
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_123";
    expect(() =>
      assertStripeCheckoutConfig(true, "https://www.paystack.ch", { sandboxSource: "build" })
    ).toThrow(/sandbox is active on paystack.ch/i);
  });

  it("allows query sandbox on production when using test key", () => {
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_123";
    const result = assertStripeCheckoutConfig(true, "https://www.paystack.ch", { sandboxSource: "query" });
    expect(result.mode).toBe("test");
  });

  it("rejects live checkout with test secret key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_wrong";
    expect(() => assertStripeCheckoutConfig(false, "https://paystack.ch")).toThrow(/key mismatch/i);
  });

  it("builds subscription checkout with trial and 3DS", () => {
    process.env.STRIPE_TRIAL_DAYS = "7";
    const params = buildSubscriptionCheckoutParams({
      lineItem: { price: "price_test", quantity: 1 },
      planId: "starter",
      origin: "https://paystack.ch",
      successUrl: "https://paystack.ch/ok",
      cancelUrl: "https://paystack.ch/cancel",
      metadata: { planId: "starter", pendingFirebaseLink: "1" },
    });
    expect(params.mode).toBe("subscription");
    expect(params.payment_method_collection).toBe("always");
    expect(params.payment_method_options?.card?.request_three_d_secure).toBe("any");
    expect(params.subscription_data?.trial_period_days).toBe(7);
    expect(params.subscription_data?.trial_settings?.end_behavior?.missing_payment_method).toBe("cancel");
  });
});
