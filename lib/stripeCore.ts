/**
 * Stripe client + browser CORS + guest checkout only.
 * Kept separate from `stripeBilling.ts` so Vercel guest checkout does not load `firebase-admin`.
 *
 * Vercel entry for guest trial: `api/stripe/guest-trial-checkout.ts` (monolithic, no `../../lib`).
 * Keep that file in sync with `runCreateCheckoutSessionGuest` below when changing guest flow.
 */
import Stripe from "stripe";
import {
  isSelfServePlan,
  parsePaystackPlanId,
  stripePriceIdForPlan,
  type PaystackPlanId,
} from "../shared/planCatalog";

export type HeaderMap = Record<string, string | string[] | undefined>;

/** Must match `stripe` package `LatestApiVersion` (see node_modules/stripe/types/lib.d.ts). */
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-02-24.acacia";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      typescript: true,
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return stripeSingleton;
}

function normalizeOrigin(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function allowedOrigins(): string[] {
  const cors = (process.env.STRIPE_CORS_ORIGIN || "")
    .split(",")
    .map((s) => normalizeOrigin(s.trim()))
    .filter((s): s is string => Boolean(s));
  const publicOrigin = normalizeOrigin(process.env.PUBLIC_APP_URL);
  const merged = [...cors, ...(publicOrigin ? [publicOrigin] : [])];
  return Array.from(new Set(merged));
}

function requestOriginFromHeaders(headers: HeaderMap): string | null {
  const originRaw = headers.origin;
  const origin = normalizeOrigin(Array.isArray(originRaw) ? originRaw[0] : originRaw);
  if (origin) return origin;
  const refRaw = headers.referer;
  const ref = normalizeOrigin(Array.isArray(refRaw) ? refRaw[0] : refRaw);
  return ref;
}

export function isAllowedBrowserOrigin(headers: HeaderMap): boolean {
  const allow = allowedOrigins();
  if (allow.length === 0) return true;
  const origin = requestOriginFromHeaders(headers);
  if (!origin) return true;
  return allow.includes(origin);
}

export function publicAppOriginFromHeaders(headers: HeaderMap): string {
  const fromEnv = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const xfHost = headers["x-forwarded-host"];
  const host = (Array.isArray(xfHost) ? xfHost[0] : xfHost) || (Array.isArray(headers.host) ? headers.host[0] : headers.host);
  const xfProto = headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(xfProto) ? xfProto[0] : xfProto)?.split(",")[0]?.trim() || "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export function trialDays(): number {
  const n = parseInt(process.env.STRIPE_TRIAL_DAYS || "7", 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 730) : 7;
}

/** Pre-login checkout: 7-day trial + card on Stripe, then user creates account and links session. */
export async function runCreateCheckoutSessionGuest(
  body: { planId?: string },
  headers: HeaderMap
): Promise<{ status: number; json: Record<string, unknown> }> {
  const stripe = getStripe();
  if (!stripe) {
    return { status: 503, json: { error: "Stripe checkout is not configured (STRIPE_SECRET_KEY)." } };
  }
  if (!isAllowedBrowserOrigin(headers)) {
    return { status: 403, json: { error: "Origin not allowed" } };
  }

  const requestedPlan = parsePaystackPlanId(body?.planId);
  if (requestedPlan === "enterprise") {
    return { status: 400, json: { error: "Enterprise plans are sold via sales — contact us instead of checkout." } };
  }

  const checkoutPlanId: PaystackPlanId = requestedPlan && isSelfServePlan(requestedPlan) ? requestedPlan : "starter";
  const priceId = stripePriceIdForPlan(checkoutPlanId) || process.env.STRIPE_PRICE_ID?.trim() || null;
  if (!priceId) {
    return {
      status: 503,
      json: {
        error:
          "Stripe checkout is not configured. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_BUSINESS / STRIPE_PRICE_UNLIMITED (Stripe Price IDs, e.g. price_xxx) or STRIPE_PRICE_ID.",
      },
    };
  }

  try {
    const origin = publicAppOriginFromHeaders(headers);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays(),
        metadata: { planId: checkoutPlanId, pendingFirebaseLink: "1" },
      },
      metadata: { planId: checkoutPlanId, pendingFirebaseLink: "1" },
      success_url: `${origin}/sign-up?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/start-trial?plan=${checkoutPlanId}`,
      allow_promotion_codes: true,
    });
    if (!session.url) {
      return { status: 500, json: { error: "Checkout session missing URL" } };
    }
    return { status: 200, json: { url: session.url } };
  } catch (e) {
    console.error("[stripe] create-checkout-session-guest:", e);
    const msg = e instanceof Error ? e.message : "Checkout failed";
    return { status: 500, json: { error: msg } };
  }
}
