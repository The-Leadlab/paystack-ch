/**
 * Shared Stripe + Firebase Admin billing logic for Express (`server/stripe.ts`)
 * and Vercel Serverless (`api/stripe/*`).
 */
import Stripe from "stripe";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  isSelfServePlan,
  parsePaystackPlanId,
  stripePriceIdForPlan,
  type PaystackPlanId,
} from "../shared/planCatalog";

export type HeaderMap = Record<string, string | string[] | undefined>;

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      typescript: true,
      apiVersion: "2026-01-28.clover",
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

function isAllowedBrowserOrigin(headers: HeaderMap): boolean {
  const allow = allowedOrigins();
  if (allow.length === 0) return true;
  const origin = requestOriginFromHeaders(headers);
  // Non-browser calls (no Origin/Referer) are accepted; browser calls must match allowlist.
  if (!origin) return true;
  return allow.includes(origin);
}

export function ensureFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  }
  const cred = JSON.parse(raw) as ServiceAccount;
  initializeApp({ credential: cert(cred) });
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

function firstSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  const p = item?.price;
  if (!p) return null;
  return typeof p === "string" ? p : p.id;
}

/** Resolve plan from subscription metadata or by matching configured Stripe Price IDs. */
export function resolvePlanIdFromStripeSubscription(subscription: Stripe.Subscription): PaystackPlanId {
  const fromMeta = parsePaystackPlanId(subscription.metadata?.planId);
  if (fromMeta) return fromMeta;

  const priceId = firstSubscriptionPriceId(subscription);
  if (priceId) {
    if (priceId === process.env.STRIPE_PRICE_STARTER?.trim()) return "starter";
    if (priceId === process.env.STRIPE_PRICE_BUSINESS?.trim()) return "business";
    if (priceId === process.env.STRIPE_PRICE_UNLIMITED?.trim()) return "unlimited";
    const legacy = process.env.STRIPE_PRICE_ID?.trim();
    if (legacy && priceId === legacy) {
      const def = parsePaystackPlanId(process.env.STRIPE_DEFAULT_PLAN_ID) || "starter";
      return def;
    }
  }
  return "starter";
}

async function syncSubscriptionToFirestore(uid: string, subscription: Stripe.Subscription): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  const planId = resolvePlanIdFromStripeSubscription(subscription);
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        stripeCustomerId: customerId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        planId,
        trialEndsAt:
          subscription.trial_end != null
            ? Timestamp.fromMillis(subscription.trial_end * 1000)
            : null,
        currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function markSubscriptionCanceled(uid: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        subscriptionStatus: "canceled",
        subscriptionId: null,
        planId: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function handleStripeSubscription(subscription: Stripe.Subscription): Promise<void> {
  const uid = subscription.metadata?.firebaseUid;
  if (!uid) {
    console.warn("[stripe] subscription without firebaseUid metadata:", subscription.id);
    return;
  }
  if (subscription.status === "canceled") {
    await markSubscriptionCanceled(uid);
    return;
  }
  await syncSubscriptionToFirestore(uid, subscription);
}

/** Guest checkout (card before Firebase): record pending link until user signs up with same email. */
async function persistPendingGuestCheckout(session: Stripe.Checkout.Session, subscriptionId: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const details = session.customer_details as { email?: string } | undefined;
  const email = (details?.email || session.customer_email || "").trim().toLowerCase();
  if (!email) {
    console.warn("[stripe] guest checkout completed but no email on session", session.id);
    return;
  }
  const planFromSession = parsePaystackPlanId(session.metadata?.planId) || "starter";
  const cust = session.customer;
  const stripeCustomerId = typeof cust === "string" ? cust : cust && typeof cust === "object" ? cust.id : null;
  await db
    .collection("pendingStripeCheckouts")
    .doc(session.id)
    .set(
      {
        email,
        stripeCustomerId,
        subscriptionId,
        planId: planFromSession,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function dispatchStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      let fullSub = await stripe.subscriptions.retrieve(subId);
      const uid =
        session.metadata?.firebaseUid || session.client_reference_id || fullSub.metadata?.firebaseUid;
      if (!uid) {
        await persistPendingGuestCheckout(session, subId);
        break;
      }
      const planFromSession = parsePaystackPlanId(session.metadata?.planId);
      const needsUid = !fullSub.metadata?.firebaseUid;
      const needsPlan =
        Boolean(planFromSession && isSelfServePlan(planFromSession)) &&
        parsePaystackPlanId(fullSub.metadata?.planId) !== planFromSession;
      if (needsUid || needsPlan) {
        await stripe.subscriptions.update(subId, {
          metadata: {
            ...(fullSub.metadata ?? {}),
            firebaseUid: uid,
            ...(planFromSession && isSelfServePlan(planFromSession) ? { planId: planFromSession } : {}),
          },
        });
        fullSub = await stripe.subscriptions.retrieve(subId);
      }
      await handleStripeSubscription(fullSub);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await handleStripeSubscription(sub);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.firebaseUid;
      if (uid) await markSubscriptionCanceled(uid);
      break;
    }
    default:
      break;
  }
}

/** Verify signature and run webhook logic. `rawBody` must be the exact request bytes. */
export async function runStripeWebhook(
  rawBody: Buffer,
  stripeSignature: string | undefined
): Promise<{ status: number; json?: unknown; text?: string }> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return { status: 503, json: { error: "Stripe webhook not configured" } };
  }
  if (typeof stripeSignature !== "string") {
    return { status: 400, text: "Missing stripe-signature" };
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, stripeSignature, secret);
  } catch (err) {
    console.error("[stripe] webhook signature error:", err);
    return { status: 400, text: "Webhook signature verification failed" };
  }
  try {
    ensureFirebaseAdmin();
  } catch (e) {
    console.error("[stripe] Firebase Admin not configured:", e);
    return { status: 503, json: { error: "Server storage not configured" } };
  }
  try {
    await dispatchStripeEvent(event, stripe);
    return { status: 200, json: { received: true } };
  } catch (e) {
    console.error("[stripe] webhook handler error:", e);
    return { status: 500, json: { error: "Webhook handler failed" } };
  }
}

export async function runCreateCheckoutSession(
  authorization: string | undefined,
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
          "Stripe checkout is not configured. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_BUSINESS / STRIPE_PRICE_UNLIMITED or STRIPE_PRICE_ID.",
      },
    };
  }

  const m = (authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { status: 401, json: { error: "Missing Authorization Bearer token" } };
  }
  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(m[1]);
    const uid = decoded.uid;
    const email = decoded.email || undefined;
    const origin = publicAppOriginFromHeaders(headers);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: uid,
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays(),
        metadata: { firebaseUid: uid, planId: checkoutPlanId },
      },
      metadata: { firebaseUid: uid, planId: checkoutPlanId },
      success_url: `${origin}/app?subscription=success`,
      cancel_url: `${origin}/app?subscription=cancel`,
      allow_promotion_codes: true,
    });
    if (!session.url) {
      return { status: 500, json: { error: "Checkout session missing URL" } };
    }
    return { status: 200, json: { url: session.url } };
  } catch (e) {
    console.error("[stripe] create-checkout-session:", e);
    return {
      status: 500,
      json: { error: "Checkout failed" },
    };
  }
}

export async function runCreatePortalSession(
  authorization: string | undefined,
  headers: HeaderMap
): Promise<{ status: number; json: Record<string, unknown> }> {
  const stripe = getStripe();
  if (!stripe) {
    return { status: 503, json: { error: "Stripe not configured" } };
  }
  if (!isAllowedBrowserOrigin(headers)) {
    return { status: 403, json: { error: "Origin not allowed" } };
  }

  const m = (authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { status: 401, json: { error: "Missing Authorization Bearer token" } };
  }
  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(m[1]);
    const uid = decoded.uid;
    const snap = await getFirestore().collection("users").doc(uid).get();
    const customerId = snap.get("stripeCustomerId") as string | undefined;
    if (!customerId) {
      return {
        status: 400,
        json: { error: "No Stripe customer on file. Complete checkout first." },
      };
    }
    const origin = publicAppOriginFromHeaders(headers);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app`,
    });
    return { status: 200, json: { url: portal.url } };
  } catch (e) {
    console.error("[stripe] create-portal-session:", e);
    return {
      status: 500,
      json: { error: "Portal session failed" },
    };
  }
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
          "Stripe checkout is not configured. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_BUSINESS / STRIPE_PRICE_UNLIMITED or STRIPE_PRICE_ID.",
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
    return { status: 500, json: { error: "Checkout failed" } };
  }
}

/** After Firebase sign-up/sign-in, attach Stripe subscription to uid (same email as Checkout). */
export async function runLinkCheckoutSession(
  authorization: string | undefined,
  body: { sessionId?: string },
  headers: HeaderMap
): Promise<{ status: number; json: Record<string, unknown> }> {
  const stripe = getStripe();
  if (!stripe) {
    return { status: 503, json: { error: "Stripe not configured" } };
  }
  if (!isAllowedBrowserOrigin(headers)) {
    return { status: 403, json: { error: "Origin not allowed" } };
  }

  const sessionId = String(body?.sessionId || "").trim();
  if (!sessionId) {
    return { status: 400, json: { error: "Missing sessionId" } };
  }

  const m = (authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { status: 401, json: { error: "Missing Authorization Bearer token" } };
  }

  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(m[1]);
    const uid = decoded.uid;
    const userEmail = (decoded.email || "").trim().toLowerCase();
    if (!userEmail) {
      return { status: 400, json: { error: "Account has no email; cannot link checkout." } };
    }

    const db = getFirestore();
    const pendingSnap = await db.collection("pendingStripeCheckouts").doc(sessionId).get();
    const pending = pendingSnap.exists ? (pendingSnap.data() as { email?: string }) : null;
    if (pending?.email && pending.email.toLowerCase() !== userEmail) {
      return { status: 403, json: { error: "Checkout email does not match this account." } };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const stripeEmail = (
      (session.customer_details as { email?: string } | undefined)?.email ||
      session.customer_email ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!stripeEmail || stripeEmail !== userEmail) {
      return { status: 403, json: { error: "Checkout email does not match this account." } };
    }

    const subRef = session.subscription;
    const subId =
      typeof subRef === "string"
        ? subRef
        : subRef && typeof subRef === "object" && "id" in subRef
          ? (subRef as Stripe.Subscription).id
          : null;
    if (!subId) {
      return { status: 400, json: { error: "No subscription on checkout session." } };
    }

    let fullSub = await stripe.subscriptions.retrieve(subId);
    const existingUid = fullSub.metadata?.firebaseUid;
    if (existingUid && existingUid !== uid) {
      return { status: 409, json: { error: "This subscription is already linked to another account." } };
    }

    const planFromMeta =
      parsePaystackPlanId(session.metadata?.planId) ||
      parsePaystackPlanId(fullSub.metadata?.planId) ||
      "starter";
    const safePlanId = isSelfServePlan(planFromMeta) ? planFromMeta : "starter";

    await stripe.subscriptions.update(subId, {
      metadata: {
        ...(fullSub.metadata ?? {}),
        firebaseUid: uid,
        planId: safePlanId,
        pendingFirebaseLink: "",
      },
    });
    fullSub = await stripe.subscriptions.retrieve(subId);
    await syncSubscriptionToFirestore(uid, fullSub);
    await db.collection("pendingStripeCheckouts").doc(sessionId).delete().catch(() => undefined);

    return { status: 200, json: { ok: true } };
  } catch (e) {
    console.error("[stripe] link-checkout-session:", e);
    return { status: 500, json: { error: "Link failed" } };
  }
}
