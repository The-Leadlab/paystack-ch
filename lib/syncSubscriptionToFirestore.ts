/**
 * Write Stripe subscription fields onto the Firestore user doc.
 * Split from `stripeBilling.ts` so admin user APIs do not load checkout/Gemini.
 */
import type Stripe from "stripe";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  entitlementsForPlan,
  parseBillingInterval,
  productLineForPlan,
  type BillingInterval,
} from "../shared/planCatalog.js";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { personalAddonsFromSubscription } from "./personalAddons.js";
import { resolvePlanIdFromStripeSubscription } from "./stripePlanResolve.js";

export async function syncSubscriptionToFirestore(
  uid: string,
  subscription: Stripe.Subscription,
  useTestPrices: boolean
): Promise<void> {
  if (!hasFirebaseAdminCredentials()) return;
  ensureFirebaseAdmin();
  const db = getFirestore();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  const planId = resolvePlanIdFromStripeSubscription(subscription, useTestPrices);
  const basePersonalDocs = entitlementsForPlan(planId).maxPersonalDocumentsPerMonth;
  const addons = personalAddonsFromSubscription(subscription, basePersonalDocs);
  const recurringInterval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  const billingInterval: BillingInterval =
    recurringInterval === "year" ? "year" : parseBillingInterval(subscription.metadata?.billingInterval);
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        stripeCustomerId: customerId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        planId,
        productLine: productLineForPlan(planId),
        personalAddonSeats: addons.personalAddonSeats,
        personalDocPack: addons.personalDocPack,
        trialEndsAt:
          subscription.trial_end != null ? Timestamp.fromMillis(subscription.trial_end * 1000) : null,
        currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
        billingInterval,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
