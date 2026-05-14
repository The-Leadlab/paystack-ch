/**
 * Pre-login Stripe Checkout (trial). **Vercel path:** `/api/stripe/guest-trial-checkout`
 *
 * **Single Vercel entry for live + test guest checkout.** Send `{ stripeTest: true }` in the JSON
 * body for Stripe test mode (`sk_test_...`). Do not use `/api/stripe-test/guest-trial-checkout`
 * (removed) — one lambda avoids broken multi-function bundles on Vercel.
 *
 * **Keep in sync with** `lib/stripeCore.ts` `runCreateCheckoutSessionGuest` behaviour.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import type { PaystackPlanId } from "../../shared/planCatalog";
import { isSelfServePlan, parsePaystackPlanId, stripePriceIdForPlan } from "../../shared/planCatalog";

console.info("[api/stripe/guest-trial-checkout] loaded (unified guest v4: body.stripeTest for test mode)");

function normalizeCorsOrigin(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function allowedCorsOrigins(): string[] {
  const fromEnv = (process.env.STRIPE_CORS_ORIGIN || "")
    .split(",")
    .map((s) => normalizeCorsOrigin(s.trim()))
    .filter((s): s is string => Boolean(s));
  const publicOrigin = normalizeCorsOrigin(process.env.PUBLIC_APP_URL);
  const defaults = ["https://paystack.ch", "https://www.paystack.ch"];
  return Array.from(new Set([...fromEnv, ...(publicOrigin ? [publicOrigin] : []), ...defaults]));
}

function requestCorsOrigin(req: VercelRequest): string | null {
  const raw = req.headers.origin;
  return normalizeCorsOrigin(Array.isArray(raw) ? raw[0] : raw);
}

function applyCorsForRequest(req: VercelRequest, res: VercelResponse): void {
  const origin = requestCorsOrigin(req);
  if (!origin || !allowedCorsOrigins().includes(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
}

function stripeCorsPreflight(req: VercelRequest, res: VercelResponse): boolean {
  applyCorsForRequest(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function stripeCorsApplyHeaders(req: VercelRequest, res: VercelResponse): void {
  applyCorsForRequest(req, res);
}

export type HeaderMap = Record<string, string | string[] | undefined>;

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-02-24.acacia";

let stripeSingleton: Stripe | null = null;
let stripeTestSingleton: Stripe | null = null;

function getStripe(): Stripe | null {
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

function getStripeTest(): Stripe | null {
  const key = process.env.STRIPE_TEST_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeTestSingleton) {
    stripeTestSingleton = new Stripe(key, {
      typescript: true,
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return stripeTestSingleton;
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
  const defaults = ["https://paystack.ch", "https://www.paystack.ch"];
  const merged = [...cors, ...(publicOrigin ? [publicOrigin] : []), ...defaults];
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

function isAllowedBrowserOrigin(headers: HeaderMap): boolean {
  const allow = allowedOrigins();
  if (allow.length === 0) return true;
  const origin = requestOriginFromHeaders(headers);
  if (!origin) return true;
  return allow.includes(origin);
}

function publicAppOriginFromHeaders(headers: HeaderMap): string {
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

function trialDays(): number {
  const n = parseInt(process.env.STRIPE_TRIAL_DAYS || "7", 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 730) : 7;
}

function planDisplayName(planId: PaystackPlanId): string {
  if (planId === "business") return "Paystack Business";
  if (planId === "unlimited") return "Paystack Unlimited";
  if (planId === "enterprise") return "Paystack Enterprise";
  return "Paystack Starter";
}

function parseChfAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/^CHF\s*/i, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function stripeCheckoutLineItemForPlan(
  planId: PaystackPlanId,
  useTestPrices: boolean
): Stripe.Checkout.SessionCreateParams.LineItem | null {
  const fromPlan = stripePriceIdForPlan(planId, useTestPrices);
  const raw =
    fromPlan ||
    (useTestPrices ? process.env.STRIPE_TEST_PRICE_ID?.trim() : process.env.STRIPE_PRICE_ID?.trim()) ||
    null;
  if (!raw) return null;

  if (raw.startsWith("price_")) {
    return { price: raw, quantity: 1 };
  }

  const unitAmount = parseChfAmount(raw);
  if (unitAmount === null) {
    throw new Error(
      `Invalid Stripe price configuration for ${planId}. Use a Stripe Price ID (price_...) or a CHF amount like 29.`
    );
  }

  return {
    quantity: 1,
    price_data: {
      currency: "chf",
      unit_amount: unitAmount,
      recurring: { interval: "month" },
      product_data: { name: planDisplayName(planId) },
    },
  };
}

export async function runCreateCheckoutSessionGuest(
  body: { planId?: string },
  headers: HeaderMap,
  options?: { useTestStripe?: boolean }
): Promise<{ status: number; json: Record<string, unknown> }> {
  const useTest = Boolean(options?.useTestStripe);
  const stripe = useTest ? getStripeTest() : getStripe();
  if (!stripe) {
    return {
      status: 503,
      json: {
        error: useTest
          ? "Stripe test checkout is not configured (STRIPE_TEST_SECRET_KEY)."
          : "Stripe checkout is not configured (STRIPE_SECRET_KEY).",
      },
    };
  }
  if (!isAllowedBrowserOrigin(headers)) {
    return { status: 403, json: { error: "Origin not allowed" } };
  }

  const requestedPlan = parsePaystackPlanId(body?.planId);
  if (requestedPlan === "enterprise") {
    return { status: 400, json: { error: "Enterprise plans are sold via sales — contact us instead of checkout." } };
  }

  const checkoutPlanId: PaystackPlanId = requestedPlan && isSelfServePlan(requestedPlan) ? requestedPlan : "starter";
  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem | null = null;
  try {
    lineItem = stripeCheckoutLineItemForPlan(checkoutPlanId, useTest);
  } catch (e) {
    return { status: 503, json: { error: e instanceof Error ? e.message : "Invalid Stripe price configuration" } };
  }
  if (!lineItem) {
    return {
      status: 503,
      json: {
        error: useTest
          ? "Stripe test checkout is not configured. Set STRIPE_TEST_PRICE_STARTER / STRIPE_TEST_PRICE_BUSINESS / STRIPE_TEST_PRICE_UNLIMITED or STRIPE_TEST_PRICE_ID."
          : "Stripe checkout is not configured. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_BUSINESS / STRIPE_PRICE_UNLIMITED (Stripe Price IDs, e.g. price_xxx) or STRIPE_PRICE_ID.",
      },
    };
  }

  try {
    const origin = publicAppOriginFromHeaders(headers);
    const testQs = useTest ? "&stripe_test=1" : "";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      subscription_data: {
        trial_period_days: trialDays(),
        metadata: { planId: checkoutPlanId, pendingFirebaseLink: "1" },
      },
      metadata: { planId: checkoutPlanId, pendingFirebaseLink: "1" },
      success_url: `${origin}/sign-up?checkout=success&session_id={CHECKOUT_SESSION_ID}${testQs}`,
      cancel_url: useTest
        ? `${origin}/start-trial?plan=${checkoutPlanId}&stripe_test=1`
        : `${origin}/start-trial?plan=${checkoutPlanId}`,
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let raw: { planId?: string; stripeTest?: boolean } = {};
    if (typeof req.body === "string") {
      try {
        raw = JSON.parse(req.body) as { planId?: string; stripeTest?: boolean };
      } catch {
        raw = {};
      }
    } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
      raw = req.body as { planId?: string; stripeTest?: boolean };
    }
    const useTestStripe =
      raw.stripeTest === true ||
      (typeof raw.stripeTest === "string" && raw.stripeTest.toLowerCase() === "true");
    const out = await runCreateCheckoutSessionGuest({ planId: raw.planId }, req.headers, { useTestStripe });
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[api] guest-trial-checkout:", e);
    if (!res.headersSent) {
      try {
        stripeCorsApplyHeaders(req, res);
      } catch {
        /* ignore */
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
