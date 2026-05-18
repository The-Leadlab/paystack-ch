import { parseTruthyEnv } from "../shared/stripeMode.js";

/**
 * When `STRIPE_USE_TEST_MODE=true`, server billing uses Stripe test keys (`sk_test_...`)
 * and test price IDs even if the client omits `stripeTest` in the body.
 */
export function serverStripeUseTestMode(): boolean {
  return parseTruthyEnv(process.env.STRIPE_USE_TEST_MODE);
}
