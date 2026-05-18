import { createHmac, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";
import type { BillingLinkFirestorePatch } from "../shared/billingLink.js";
import { isSelfServePlan, parsePaystackPlanId, type PaystackPlanId } from "../shared/planCatalog.js";
import { resolvePlanIdFromStripeSubscription } from "./stripePlanResolve.js";

const LINK_TTL_MS = 10 * 60 * 1000;

function signingSecret(): string {
  const s = process.env.SUBSCRIPTION_LINK_SIGNING_SECRET?.trim();
  if (!s || s.length < 16) {
    throw Object.assign(
      new Error(
        "SUBSCRIPTION_LINK_SIGNING_SECRET is not configured (min 16 characters). Add it in Vercel Environment Variables and redeploy."
      ),
      { status: 503 }
    );
  }
  return s;
}

export function buildBillingPatchFromSubscription(
  subscription: Stripe.Subscription,
  useTestPrices: boolean
): BillingLinkFirestorePatch {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  const planFromMeta = parsePaystackPlanId(subscription.metadata?.planId);
  const resolved = resolvePlanIdFromStripeSubscription(subscription, useTestPrices);
  const planId: PaystackPlanId =
    planFromMeta && isSelfServePlan(planFromMeta) ? planFromMeta : resolved;

  return {
    stripeCustomerId: customerId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    planId,
    trialEndsAt:
      subscription.trial_end != null ? new Date(subscription.trial_end * 1000).toISOString() : null,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    billingLinkedAt: new Date().toISOString(),
  };
}

/** HMAC over canonical JSON so the client cannot forge billing fields without the server secret. */
export function signBillingLinkToken(
  uid: string,
  sessionId: string,
  billing: BillingLinkFirestorePatch
): { linkToken: string; expiresAt: number } {
  const expiresAt = Date.now() + LINK_TTL_MS;
  const payload = JSON.stringify({ uid, sessionId, billing, expiresAt });
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const linkToken = Buffer.from(JSON.stringify({ payload, sig }), "utf8").toString("base64url");
  return { linkToken, expiresAt };
}

export function verifyBillingLinkToken(
  linkToken: string,
  uid: string,
  sessionId: string,
  billing: BillingLinkFirestorePatch
): boolean {
  try {
    const parsed = JSON.parse(Buffer.from(linkToken, "base64url").toString("utf8")) as {
      payload?: string;
      sig?: string;
    };
    if (!parsed.payload || !parsed.sig) return false;
    const inner = JSON.parse(parsed.payload) as {
      uid?: string;
      sessionId?: string;
      billing?: BillingLinkFirestorePatch;
      expiresAt?: number;
    };
    if (inner.uid !== uid || inner.sessionId !== sessionId) return false;
    if (typeof inner.expiresAt !== "number" || inner.expiresAt < Date.now()) return false;
    if (JSON.stringify(inner.billing) !== JSON.stringify(billing)) return false;

    const expected = createHmac("sha256", signingSecret()).update(parsed.payload).digest("base64url");
    const a = Buffer.from(parsed.sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
