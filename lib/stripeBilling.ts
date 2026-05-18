/**
 * Shared Stripe + Firebase Admin billing logic for Express (`server/stripe.ts`)
 * and Vercel Serverless (`api/stripe/*`).
 */
import Stripe from "stripe";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  isSelfServePlan,
  parsePaystackPlanId,
  type PaystackPlanId,
} from "../shared/planCatalog.js";

import {
  getStripe,
  getStripeTest,
  type HeaderMap,
  isAllowedBrowserOrigin,
  publicAppOriginFromHeaders,
  stripeCheckoutLineItemForPlan,
  trialDays,
} from "./stripeCore.js";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { resolvePlanIdFromStripeSubscription } from "./stripePlanResolve.js";
import {
  buildBillingPatchFromSubscription,
  signBillingLinkToken,
} from "./subscriptionLinkSign.js";
import { verifyFirebaseUser } from "./verifyFirebaseIdToken.js";

export type { HeaderMap } from "./stripeCore.js";
export { getStripe, getStripeTest, publicAppOriginFromHeaders, trialDays } from "./stripeCore.js";
export { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
export { resolvePlanIdFromStripeSubscription } from "./stripePlanResolve.js";

async function syncSubscriptionToFirestore(
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
  if (!hasFirebaseAdminCredentials()) return;
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

async function handleStripeSubscription(subscription: Stripe.Subscription, useTestPrices: boolean): Promise<void> {
  const uid = subscription.metadata?.firebaseUid;
  if (!uid) {
    console.warn("[stripe] subscription without firebaseUid metadata:", subscription.id);
    return;
  }
  if (subscription.status === "canceled") {
    await markSubscriptionCanceled(uid);
    return;
  }
  await syncSubscriptionToFirestore(uid, subscription, useTestPrices);
}

/** When Admin SDK is unavailable, keep plan on Stripe subscription for client link. */
async function markGuestCheckoutOnStripe(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  subscriptionId: string
): Promise<void> {
  const planFromSession = parsePaystackPlanId(session.metadata?.planId) || "starter";
  const safePlan = isSelfServePlan(planFromSession) ? planFromSession : "starter";
  try {
    await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        planId: safePlan,
        pendingFirebaseLink: "1",
      },
    });
  } catch (e) {
    console.warn("[stripe] could not update subscription metadata for guest checkout:", e);
  }
}

/** Guest checkout (card before Firebase): record pending link until user signs up with same email. */
async function persistPendingGuestCheckout(
  session: Stripe.Checkout.Session,
  subscriptionId: string,
  stripe: Stripe
): Promise<void> {
  if (!hasFirebaseAdminCredentials()) {
    await markGuestCheckoutOnStripe(stripe, session, subscriptionId);
    return;
  }
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

export async function dispatchStripeEvent(
  event: Stripe.Event,
  stripe: Stripe,
  useTestPrices: boolean
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      let fullSub = await stripe.subscriptions.retrieve(subId);
      const uid =
        session.metadata?.firebaseUid || session.client_reference_id || fullSub.metadata?.firebaseUid;
      if (!uid) {
        await persistPendingGuestCheckout(session, subId, stripe);
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
      await handleStripeSubscription(fullSub, useTestPrices);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await handleStripeSubscription(sub, useTestPrices);
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

/**
 * Stripe issues a different signing secret (`whsec_...`) per webhook endpoint URL. If both
 * `https://paystack.ch/...` and `https://www.paystack.ch/...` are registered in the Dashboard,
 * list both secrets here (comma-separated in one var and/or `STRIPE_WEBHOOK_SECRET_ALT`).
 */
function collectWebhookSecrets(useTestStripe: boolean): string[] {
  const primary = useTestStripe ? process.env.STRIPE_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
  const alt = useTestStripe ? process.env.STRIPE_TEST_WEBHOOK_SECRET_ALT : process.env.STRIPE_WEBHOOK_SECRET_ALT;
  const out: string[] = [];
  for (const envVal of [primary, alt]) {
    if (!envVal?.trim()) continue;
    for (const piece of envVal.split(",")) {
      const s = piece.trim();
      if (s) out.push(s);
    }
  }
  return Array.from(new Set(out));
}

/** Verify signature and run webhook logic. `rawBody` must be the exact request bytes. */
export async function runStripeWebhook(
  rawBody: Buffer,
  stripeSignature: string | undefined,
  useTestStripe = false
): Promise<{ status: number; json?: unknown; text?: string }> {
  const stripe = useTestStripe ? getStripeTest() : getStripe();
  const secrets = collectWebhookSecrets(useTestStripe);
  if (!stripe || secrets.length === 0) {
    return {
      status: 503,
      json: {
        error: useTestStripe
          ? "Stripe test webhook not configured (STRIPE_TEST_SECRET_KEY / STRIPE_TEST_WEBHOOK_SECRET)."
          : "Stripe webhook not configured",
      },
    };
  }
  if (typeof stripeSignature !== "string") {
    return { status: 400, json: { error: "Missing stripe-signature" } };
  }
  let event: Stripe.Event | null = null;
  let lastSigErr: unknown;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, stripeSignature, secret);
      break;
    } catch (err) {
      lastSigErr = err;
    }
  }
  if (!event) {
    console.error(`[stripe] webhook signature error (tried ${secrets.length} secret(s)):`, lastSigErr);
    return {
      status: 400,
      json: {
        error: "Webhook signature verification failed",
        hint:
          "Each Stripe webhook URL has its own signing secret. If you use both paystack.ch and www.paystack.ch endpoints, set STRIPE_WEBHOOK_SECRET to both whsec_ values (comma-separated) or add STRIPE_WEBHOOK_SECRET_ALT.",
      },
    };
  }
  if (!hasFirebaseAdminCredentials()) {
    console.info(
      "[stripe] webhook: Firebase Admin not configured — Stripe metadata only; client link writes billing to Firestore."
    );
  }
  try {
    await dispatchStripeEvent(event, stripe, useTestStripe);
    return { status: 200, json: { received: true } };
  } catch (e) {
    console.error("[stripe] webhook handler error:", e);
    return { status: 500, json: { error: "Webhook handler failed" } };
  }
}

export async function runCreateCheckoutSession(
  authorization: string | undefined,
  body: { planId?: string },
  headers: HeaderMap,
  useTestStripe = false
): Promise<{ status: number; json: Record<string, unknown> }> {
  const stripe = useTestStripe ? getStripeTest() : getStripe();
  if (!stripe) {
    return {
      status: 503,
      json: {
        error: useTestStripe
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
    lineItem = stripeCheckoutLineItemForPlan(checkoutPlanId, useTestStripe);
  } catch (e) {
    return { status: 503, json: { error: e instanceof Error ? e.message : "Invalid Stripe price configuration" } };
  }
  if (!lineItem) {
    return {
      status: 503,
      json: {
        error: useTestStripe
          ? "Stripe test checkout is not configured. Set STRIPE_TEST_PRICE_STARTER / STRIPE_TEST_PRICE_BUSINESS / STRIPE_TEST_PRICE_UNLIMITED or STRIPE_TEST_PRICE_ID."
          : "Stripe checkout is not configured. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_BUSINESS / STRIPE_PRICE_UNLIMITED or STRIPE_PRICE_ID.",
      },
    };
  }

  const m = (authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { status: 401, json: { error: "Missing Authorization Bearer token" } };
  }
  try {
    const { uid, email: verifiedEmail } = await verifyFirebaseUser(m[1]);
    const email = verifiedEmail || undefined;
    const origin = publicAppOriginFromHeaders(headers);
    const appPath = "/app";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: uid,
      customer_email: email,
      line_items: [lineItem],
      subscription_data: {
        trial_period_days: trialDays(),
        metadata: { firebaseUid: uid, planId: checkoutPlanId },
      },
      metadata: { firebaseUid: uid, planId: checkoutPlanId },
      success_url: `${origin}${appPath}?subscription=success`,
      cancel_url: `${origin}${appPath}?subscription=cancel`,
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
  body: { stripeCustomerId?: string },
  headers: HeaderMap,
  useTestStripe = false
): Promise<{ status: number; json: Record<string, unknown> }> {
  const stripe = useTestStripe ? getStripeTest() : getStripe();
  if (!stripe) {
    return {
      status: 503,
      json: { error: useTestStripe ? "Stripe test mode not configured" : "Stripe not configured" },
    };
  }
  if (!isAllowedBrowserOrigin(headers)) {
    return { status: 403, json: { error: "Origin not allowed" } };
  }

  const m = (authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return { status: 401, json: { error: "Missing Authorization Bearer token" } };
  }
  try {
    const { uid } = await verifyFirebaseUser(m[1]);
    let customerId = String(body?.stripeCustomerId || "").trim();

    if (!customerId && hasFirebaseAdminCredentials()) {
      ensureFirebaseAdmin();
      const snap = await getFirestore().collection("users").doc(uid).get();
      customerId = (snap.get("stripeCustomerId") as string | undefined)?.trim() || "";
    }

    if (!customerId) {
      return {
        status: 400,
        json: { error: "No Stripe customer on file. Complete checkout and link your subscription first." },
      };
    }

    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return { status: 400, json: { error: "Stripe customer no longer exists." } };
    }
    const ownerUid = (customer as Stripe.Customer).metadata?.firebaseUid;
    if (ownerUid && ownerUid !== uid) {
      return { status: 403, json: { error: "Stripe customer does not belong to this account." } };
    }

    const origin = publicAppOriginFromHeaders(headers);
    const appPath = "/app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}${appPath}`,
    });
    return { status: 200, json: { url: portal.url } };
  } catch (e) {
    console.error("[stripe] create-portal-session:", e);
    const msg = e instanceof Error ? e.message : "Portal session failed";
    const status = (e as { status?: number }).status;
    return {
      status: typeof status === "number" ? status : 500,
      json: { error: msg },
    };
  }
}

async function resolveStripeCheckoutEmail(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string> {
  let stripeEmail = (
    (session.customer_details as { email?: string } | undefined)?.email ||
    session.customer_email ||
    ""
  )
    .trim()
    .toLowerCase();

  const custRef = session.customer;
  if (!stripeEmail && custRef && typeof custRef === "object" && "email" in custRef) {
    const em = (custRef as { email?: string | null }).email;
    if (typeof em === "string" && em.trim()) stripeEmail = em.trim().toLowerCase();
  }
  if (!stripeEmail && typeof custRef === "string") {
    try {
      const cust = await stripe.customers.retrieve(custRef);
      if (!("deleted" in cust && cust.deleted) && typeof (cust as { email?: string | null }).email === "string") {
        const em = (cust as { email: string }).email;
        if (em?.trim()) stripeEmail = em.trim().toLowerCase();
      }
    } catch {
      /* ignore */
    }
  }
  return stripeEmail;
}

/** After Firebase sign-up/sign-in, attach Stripe subscription to uid (same email as Checkout). */
export async function runLinkCheckoutSession(
  authorization: string | undefined,
  body: { sessionId?: string },
  headers: HeaderMap,
  useTestStripe = false
): Promise<{ status: number; json: Record<string, unknown> }> {
  const stripe = useTestStripe ? getStripeTest() : getStripe();
  if (!stripe) {
    return {
      status: 503,
      json: { error: useTestStripe ? "Stripe test mode not configured" : "Stripe not configured" },
    };
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
    const { uid, email: verifiedEmail } = await verifyFirebaseUser(m[1]);
    const userEmail = (verifiedEmail || "").trim().toLowerCase();
    if (!userEmail) {
      return {
        status: 400,
        json: {
          error: "Account has no email; cannot link checkout.",
          code: "auth_no_email",
        },
      };
    }

    if (hasFirebaseAdminCredentials()) {
      ensureFirebaseAdmin();
      const db = getFirestore();
      const pendingSnap = await db.collection("pendingStripeCheckouts").doc(sessionId).get();
      const pending = pendingSnap.exists ? (pendingSnap.data() as { email?: string }) : null;
      if (pending?.email && pending.email.toLowerCase() !== userEmail) {
        return {
          status: 403,
          json: {
            error:
              "Checkout email does not match this account. Use the same email you entered at Stripe checkout as your Paystack.ch sign-up email.",
            code: "email_mismatch",
            stripeEmail: pending.email,
          },
        };
      }
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const stripeEmail = await resolveStripeCheckoutEmail(stripe, session);

    if (!stripeEmail || stripeEmail !== userEmail) {
      return {
        status: 403,
        json: {
          error:
            "Checkout email does not match this account. Use the same email you entered at Stripe checkout as your Paystack.ch sign-up email.",
          code: "email_mismatch",
          stripeEmail: stripeEmail || null,
        },
      };
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

    const customerId =
      typeof fullSub.customer === "string" ? fullSub.customer : fullSub.customer?.id ?? null;
    if (customerId) {
      try {
        await stripe.customers.update(customerId, {
          metadata: { firebaseUid: uid },
        });
      } catch {
        /* non-fatal */
      }
    }

    const billing = buildBillingPatchFromSubscription(fullSub, useTestStripe);

    if (hasFirebaseAdminCredentials()) {
      ensureFirebaseAdmin();
      await syncSubscriptionToFirestore(uid, fullSub, useTestStripe);
      const db = getFirestore();
      await db.collection("pendingStripeCheckouts").doc(sessionId).delete().catch(() => undefined);
      return { status: 200, json: { ok: true, billing } };
    }

    const { linkToken, expiresAt } = signBillingLinkToken(uid, sessionId, billing);
    return {
      status: 200,
      json: {
        ok: true,
        billing,
        linkToken,
        expiresAt,
        clientWriteRequired: true,
      },
    };
  } catch (e) {
    console.error("[stripe] link-checkout-session:", e);
    const msg = e instanceof Error ? e.message : "Link failed";
    const safe = msg.length > 220 ? `${msg.slice(0, 217)}…` : msg;
    const status = (e as { status?: number }).status;
    return {
      status: typeof status === "number" ? status : 500,
      json: { error: safe || "Link failed" },
    };
  }
}
