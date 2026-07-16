/**
 * Admin user management — Firebase Auth + Firestore billing + Stripe actions.
 * All routes must verify admin session before calling these functions.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { getStripe, getStripeTest } from "./stripeCore.js";
import { parsePaystackPlanId, type PaystackPlanId } from "../shared/planCatalog.js";
import { resolvePlanIdFromStripeSubscription } from "./stripePlanResolve.js";
import { normalizePhoneToE164 } from "./phoneE164.js";
import { syncSubscriptionToFirestore } from "./stripeBilling.js";

export type AdminUserSummary = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  providerIds: string[];
  planId: PaystackPlanId | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  planTestMode: boolean;
  usageThisMonth: number | null;
};

export type AdminUserDetail = AdminUserSummary & {
  photoUrl: string | null;
  phoneNumber: string | null;
  stripeInvoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    /** Display amount in cents: paid if > 0, else total, else amount due. */
    amountPaid: number;
    amountDue: number;
    total: number;
    currency: string;
    created: string;
    periodStart: string | null;
    periodEnd: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    paymentIntentId: string | null;
  }>;
  stripeSubscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    startDate: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    couponId: string | null;
    discountPercentOff: number | null;
    discountAmountOff: number | null;
  } | null;
  /** Latest paid invoice / charge timestamp from Stripe (null if none). */
  lastPaymentAt: string | null;
  /** True when status is past_due/unpaid or an open invoice is overdue. */
  paymentLate: boolean;
  /** Stripe customer found by email but not yet written to Firestore. */
  stripeCustomerMatchPending: boolean;
};

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function usageForCurrentMonth(usage: Record<string, number> | undefined): number | null {
  if (!usage || typeof usage !== "object") return null;
  const key = new Date().toISOString().slice(0, 7);
  const val = usage[key];
  return typeof val === "number" ? val : 0;
}

async function loadFirestoreBilling(uid: string): Promise<Record<string, unknown> | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

function summaryFromAuthAndBilling(
  record: import("firebase-admin/auth").UserRecord,
  billing: Record<string, unknown> | null
): AdminUserSummary {
  const usage = billing?.usage as Record<string, number> | undefined;
  return {
    uid: record.uid,
    email: record.email ?? null,
    displayName: record.displayName ?? null,
    disabled: record.disabled,
    emailVerified: record.emailVerified,
    createdAt: record.metadata.creationTime ?? null,
    lastSignInAt: record.metadata.lastSignInTime ?? null,
    providerIds: record.providerData.map((p) => p.providerId),
    planId: parsePaystackPlanId(billing?.planId as string) ?? null,
    subscriptionStatus: typeof billing?.subscriptionStatus === "string" ? billing.subscriptionStatus : null,
    stripeCustomerId: typeof billing?.stripeCustomerId === "string" ? billing.stripeCustomerId : null,
    subscriptionId: typeof billing?.subscriptionId === "string" ? billing.subscriptionId : null,
    trialEndsAt: tsToIso(billing?.trialEndsAt),
    currentPeriodEnd: tsToIso(billing?.currentPeriodEnd),
    planTestMode: billing?.planTestMode === true,
    usageThisMonth: usageForCurrentMonth(usage),
  };
}

export async function listAdminUsers(options?: {
  search?: string;
  maxResults?: number;
}): Promise<{ users: AdminUserSummary[]; total: number }> {
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Firebase Admin credentials are not configured."), { status: 503 });
  }
  ensureFirebaseAdmin();
  const auth = getAuth();
  const db = getFirestore();
  const search = options?.search?.trim().toLowerCase() ?? "";
  const maxResults = Math.min(Math.max(options?.maxResults ?? 200, 1), 1000);

  const summaries: AdminUserSummary[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(100, pageToken);
    const billingSnaps = await Promise.all(
      page.users.map((u) => db.collection("users").doc(u.uid).get())
    );
    for (let i = 0; i < page.users.length; i++) {
      const billing = billingSnaps[i].exists ? (billingSnaps[i].data() as Record<string, unknown>) : null;
      const summary = summaryFromAuthAndBilling(page.users[i], billing);
      if (search) {
        const hay = `${summary.email ?? ""} ${summary.displayName ?? ""} ${summary.uid}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }
      summaries.push(summary);
      if (summaries.length >= maxResults) break;
    }
    if (summaries.length >= maxResults) break;
    pageToken = page.pageToken;
  } while (pageToken);

  return { users: summaries, total: summaries.length };
}

async function resolveStripeForSubscription(
  subscriptionId: string
): Promise<{ stripe: Stripe; useTest: boolean } | null> {
  const live = getStripe();
  const test = getStripeTest();
  if (live) {
    try {
      await live.subscriptions.retrieve(subscriptionId);
      return { stripe: live, useTest: false };
    } catch {
      /* try test */
    }
  }
  if (test) {
    try {
      await test.subscriptions.retrieve(subscriptionId);
      return { stripe: test, useTest: true };
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveStripeForCustomer(
  customerId: string
): Promise<{ stripe: Stripe; useTest: boolean } | null> {
  const live = getStripe();
  const test = getStripeTest();
  if (live) {
    try {
      await live.customers.retrieve(customerId);
      return { stripe: live, useTest: false };
    } catch {
      /* try test */
    }
  }
  if (test) {
    try {
      await test.customers.retrieve(customerId);
      return { stripe: test, useTest: true };
    } catch {
      return null;
    }
  }
  return null;
}

async function findStripeCustomerByEmail(
  email: string
): Promise<{ stripe: Stripe; customerId: string; useTest: boolean } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  for (const useTest of [false, true] as const) {
    const stripe = useTest ? getStripeTest() : getStripe();
    if (!stripe) continue;
    try {
      const list = await stripe.customers.list({ email: normalized, limit: 5 });
      const active = list.data.find((c) => !c.deleted);
      if (active) return { stripe, customerId: active.id, useTest };
    } catch {
      /* try next mode */
    }
  }
  return null;
}

async function loadLatestSubscriptionForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  if (subs.data.length === 0) return null;
  const preferred =
    subs.data.find((s) => s.status === "active" || s.status === "trialing") ||
    subs.data.find((s) => s.status === "past_due") ||
    subs.data[0];
  return preferred ?? null;
}

function mapStripeSubscription(
  sub: Stripe.Subscription
): NonNullable<AdminUserDetail["stripeSubscription"]> {
  const coupon = sub.discount?.coupon;
  return {
    id: sub.id,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    startDate: sub.start_date
      ? new Date(sub.start_date * 1000).toISOString()
      : sub.created
        ? new Date(sub.created * 1000).toISOString()
        : null,
    currentPeriodStart: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    trialEndsAt: sub.trial_end != null ? new Date(sub.trial_end * 1000).toISOString() : null,
    couponId: coupon?.id ?? null,
    discountPercentOff: coupon?.percent_off ?? null,
    discountAmountOff: coupon?.amount_off ?? null,
  };
}

function derivePaymentLate(
  subscriptionStatus: string | null | undefined,
  invoices: AdminUserDetail["stripeInvoices"]
): boolean {
  const st = subscriptionStatus ?? "";
  if (st === "past_due" || st === "unpaid") return true;
  const now = Date.now();
  return invoices.some((inv) => {
    if (inv.status !== "open" && inv.status !== "uncollectible") return false;
    const created = new Date(inv.created).getTime();
    return Number.isFinite(created) && now - created > 3 * 24 * 60 * 60 * 1000;
  });
}

export async function getAdminUserDetail(uid: string): Promise<AdminUserDetail> {
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Firebase Admin credentials are not configured."), { status: 503 });
  }
  ensureFirebaseAdmin();
  const auth = getAuth();
  const record = await auth.getUser(uid);
  const billing = await loadFirestoreBilling(uid);
  const summary = summaryFromAuthAndBilling(record, billing);

  let stripeInvoices: AdminUserDetail["stripeInvoices"] = [];
  let stripeSubscription: AdminUserDetail["stripeSubscription"] = null;
  let lastPaymentAt: string | null = null;
  let stripeCustomerMatchPending = false;
  let customerId = summary.stripeCustomerId;
  let resolvedStripe: Stripe | null = null;
  let resolvedUseTest = false;

  if (customerId) {
    const resolved = await resolveStripeForCustomer(customerId);
    if (resolved) {
      resolvedStripe = resolved.stripe;
      resolvedUseTest = resolved.useTest;
    }
  } else if (summary.email) {
    const found = await findStripeCustomerByEmail(summary.email);
    if (found) {
      customerId = found.customerId;
      resolvedStripe = found.stripe;
      resolvedUseTest = found.useTest;
      stripeCustomerMatchPending = true;
      summary.stripeCustomerId = found.customerId;
    }
  }

  if (customerId && resolvedStripe) {
    const invoices = await resolvedStripe.invoices.list({
      customer: customerId,
      limit: 24,
    });
    stripeInvoices = invoices.data.map((inv) => {
      const amountPaid = inv.amount_paid ?? 0;
      const amountDue = inv.amount_due ?? 0;
      const total = inv.total ?? 0;
      const displayAmount = amountPaid > 0 ? amountPaid : total > 0 ? total : amountDue;
      return {
        id: inv.id,
        number: inv.number ?? null,
        status: inv.status,
        amountPaid: displayAmount,
        amountDue,
        total,
        currency: inv.currency || "chf",
        created: new Date(inv.created * 1000).toISOString(),
        periodStart: inv.period_start
          ? new Date(inv.period_start * 1000).toISOString()
          : null,
        periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        invoicePdf: inv.invoice_pdf ?? null,
        paymentIntentId:
          typeof inv.payment_intent === "string"
            ? inv.payment_intent
            : inv.payment_intent?.id ?? null,
      };
    });
    const paid = invoices.data.find((inv) => inv.status === "paid" && (inv.amount_paid ?? 0) > 0);
    if (paid) {
      lastPaymentAt = new Date((paid.status_transitions?.paid_at ?? paid.created) * 1000).toISOString();
    }
  }

  let subId = summary.subscriptionId;
  if (!subId && customerId && resolvedStripe) {
    const latest = await loadLatestSubscriptionForCustomer(resolvedStripe, customerId);
    if (latest) {
      subId = latest.id;
      summary.subscriptionId = latest.id;
      summary.subscriptionStatus = latest.status;
      if (!summary.planId) {
        summary.planId = resolvePlanIdFromStripeSubscription(latest, resolvedUseTest);
      }
    }
  }

  if (subId) {
    const resolved = await resolveStripeForSubscription(subId);
    if (resolved) {
      const { stripe, useTest } = resolved;
      const sub = await stripe.subscriptions.retrieve(subId, {
        expand: ["discount", "discount.coupon"],
      });
      stripeSubscription = mapStripeSubscription(sub);
      if (!summary.planId) {
        summary.planId = resolvePlanIdFromStripeSubscription(sub, useTest);
      }
      if (!summary.subscriptionStatus) {
        summary.subscriptionStatus = sub.status;
      }
      if (!summary.currentPeriodEnd) {
        summary.currentPeriodEnd = stripeSubscription.currentPeriodEnd;
      }
      if (!summary.trialEndsAt && stripeSubscription.trialEndsAt) {
        summary.trialEndsAt = stripeSubscription.trialEndsAt;
      }
    }
  }

  const paymentLate = derivePaymentLate(summary.subscriptionStatus ?? stripeSubscription?.status, stripeInvoices);

  return {
    ...summary,
    photoUrl: record.photoURL ?? null,
    phoneNumber: record.phoneNumber ?? null,
    stripeInvoices,
    stripeSubscription,
    lastPaymentAt,
    paymentLate,
    stripeCustomerMatchPending,
  };
}

export type AdminUserAction =
  | { action: "cancel_subscription"; atPeriodEnd?: boolean }
  | { action: "reactivate_subscription" }
  | { action: "refund_last_payment"; amountCents?: number; reason?: string }
  | { action: "apply_coupon"; couponId: string }
  | { action: "remove_coupon" }
  | { action: "send_password_reset" }
  | { action: "set_password"; password: string }
  | { action: "disable_user" }
  | { action: "enable_user" }
  | { action: "delete_user" }
  | { action: "set_plan"; planId: PaystackPlanId | null; planTestMode?: boolean }
  | { action: "resend_verification" }
  | { action: "link_stripe_by_email" }
  | {
      action: "update_user";
      displayName?: string;
      email?: string;
      password?: string;
      phoneNumber?: string;
      emailVerified?: boolean;
      disabled?: boolean;
    };

export type CreateAdminUserInput = {
  email: string;
  password: string;
  displayName?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  planId?: PaystackPlanId | null;
  planTestMode?: boolean;
};

export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<{ ok: true; uid: string; email: string; message: string }> {
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Firebase Admin credentials are not configured."), { status: 503 });
  }
  ensureFirebaseAdmin();
  const auth = getAuth();
  const db = getFirestore();

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email) throw Object.assign(new Error("Email is required."), { status: 400 });
  if (!password || password.length < 6) {
    throw Object.assign(new Error("Password must be at least 6 characters."), { status: 400 });
  }

  const created = await auth.createUser({
    email,
    password,
    displayName: input.displayName?.trim() || undefined,
    emailVerified: input.emailVerified === true,
    disabled: input.disabled === true,
  });

  await db
    .collection("users")
    .doc(created.uid)
    .set(
      {
        email,
        subscriptionStatus: input.planId ? "active" : "none",
        planId: input.planId ?? null,
        planTestMode: input.planTestMode === true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return {
    ok: true,
    uid: created.uid,
    email,
    message: `User created (${email}).`,
  };
}

export async function runAdminUserAction(
  uid: string,
  body: AdminUserAction
): Promise<{ ok: true; message: string; data?: unknown }> {
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Firebase Admin credentials are not configured."), { status: 503 });
  }
  ensureFirebaseAdmin();
  const auth = getAuth();
  const db = getFirestore();
  const record = await auth.getUser(uid);
  const billing = await loadFirestoreBilling(uid);
  const subscriptionId =
    typeof billing?.subscriptionId === "string" ? billing.subscriptionId : null;
  const stripeCustomerId =
    typeof billing?.stripeCustomerId === "string" ? billing.stripeCustomerId : null;

  switch (body.action) {
    case "cancel_subscription": {
      if (!subscriptionId) throw Object.assign(new Error("User has no active subscription."), { status: 400 });
      const resolved = await resolveStripeForSubscription(subscriptionId);
      if (!resolved) throw Object.assign(new Error("Could not resolve Stripe subscription."), { status: 400 });
      const { stripe } = resolved;
      if (body.atPeriodEnd !== false) {
        await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
        return { ok: true, message: "Subscription will cancel at period end." };
      }
      await stripe.subscriptions.cancel(subscriptionId);
      await db.collection("users").doc(uid).set(
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
      return { ok: true, message: "Subscription canceled immediately." };
    }

    case "reactivate_subscription": {
      if (!subscriptionId) throw Object.assign(new Error("User has no subscription."), { status: 400 });
      const resolved = await resolveStripeForSubscription(subscriptionId);
      if (!resolved) throw Object.assign(new Error("Could not resolve Stripe subscription."), { status: 400 });
      await resolved.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
      return { ok: true, message: "Subscription reactivated (cancel at period end removed)." };
    }

    case "refund_last_payment": {
      if (!stripeCustomerId) throw Object.assign(new Error("User has no Stripe customer."), { status: 400 });
      const resolved = await resolveStripeForCustomer(stripeCustomerId);
      if (!resolved) throw Object.assign(new Error("Could not resolve Stripe customer."), { status: 400 });
      const { stripe } = resolved;
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        status: "paid",
        limit: 1,
      });
      const invoice = invoices.data[0];
      if (!invoice) throw Object.assign(new Error("No paid invoice found."), { status: 400 });
      const paymentIntentId =
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : invoice.payment_intent?.id;
      if (!paymentIntentId) throw Object.assign(new Error("Invoice has no payment intent."), { status: 400 });
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(body.amountCents ? { amount: body.amountCents } : {}),
        reason: "requested_by_customer",
        metadata: { adminRefund: "1", uid, note: body.reason ?? "" },
      });
      return { ok: true, message: `Refund issued (${refund.id}).`, data: { refundId: refund.id } };
    }

    case "apply_coupon": {
      if (!subscriptionId) throw Object.assign(new Error("User has no subscription."), { status: 400 });
      const couponId = body.couponId.trim();
      if (!couponId) throw Object.assign(new Error("Coupon ID is required."), { status: 400 });
      const resolved = await resolveStripeForSubscription(subscriptionId);
      if (!resolved) throw Object.assign(new Error("Could not resolve Stripe subscription."), { status: 400 });
      await resolved.stripe.subscriptions.update(subscriptionId, { coupon: couponId });
      return { ok: true, message: `Coupon "${couponId}" applied to subscription.` };
    }

    case "remove_coupon": {
      if (!subscriptionId) throw Object.assign(new Error("User has no subscription."), { status: 400 });
      const resolved = await resolveStripeForSubscription(subscriptionId);
      if (!resolved) throw Object.assign(new Error("Could not resolve Stripe subscription."), { status: 400 });
      await resolved.stripe.subscriptions.update(subscriptionId, { coupon: "" });
      return { ok: true, message: "Coupon removed from subscription." };
    }

    case "send_password_reset": {
      const email = record.email?.trim();
      if (!email) throw Object.assign(new Error("User has no email address."), { status: 400 });
      const link = await auth.generatePasswordResetLink(email);
      return {
        ok: true,
        message: "Password reset link generated. Copy the link below or configure Firebase email templates to auto-send.",
        data: { resetLink: link },
      };
    }

    case "set_password": {
      const pwd = typeof body.password === "string" ? body.password : "";
      if (!record.email?.trim()) {
        throw Object.assign(new Error("User has no email — cannot set a password."), { status: 400 });
      }
      if (!pwd || pwd.length < 6) {
        throw Object.assign(new Error("Password must be at least 6 characters."), { status: 400 });
      }
      await auth.updateUser(uid, { password: pwd });
      const hadPassword = record.providerData.some((p) => p.providerId === "password");
      return {
        ok: true,
        message: hadPassword
          ? "Password updated."
          : "Password set — user can now sign in with email and password.",
      };
    }

    case "disable_user": {
      await auth.updateUser(uid, { disabled: true });
      return { ok: true, message: "User account disabled." };
    }

    case "enable_user": {
      await auth.updateUser(uid, { disabled: false });
      return { ok: true, message: "User account enabled." };
    }

    case "delete_user": {
      await auth.deleteUser(uid);
      try {
        await db.collection("users").doc(uid).delete();
      } catch {
        /* billing doc may not exist */
      }
      return { ok: true, message: "User deleted from Firebase Auth." };
    }

    case "set_plan": {
      await db.collection("users").doc(uid).set(
        {
          planId: body.planId,
          planTestMode: body.planTestMode === true,
          ...(body.planId
            ? { subscriptionStatus: "active" }
            : { subscriptionStatus: "none", planId: null }),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return {
        ok: true,
        message: body.planId
          ? `Plan set to ${body.planId}${body.planTestMode ? " (test mode)" : ""}.`
          : "Plan cleared.",
      };
    }

    case "resend_verification": {
      const email = record.email?.trim();
      if (!email) throw Object.assign(new Error("User has no email address."), { status: 400 });
      if (record.emailVerified) {
        return { ok: true, message: "Email is already verified." };
      }
      const link = await auth.generateEmailVerificationLink(email);
      return {
        ok: true,
        message: "Verification link generated. Copy the link below or configure Firebase email templates.",
        data: { verificationLink: link },
      };
    }

    case "link_stripe_by_email": {
      const email = record.email?.trim();
      if (!email) throw Object.assign(new Error("User has no email address."), { status: 400 });
      const found = await findStripeCustomerByEmail(email);
      if (!found) {
        throw Object.assign(
          new Error(`No Stripe customer found for ${email} in live or test mode.`),
          { status: 404 }
        );
      }
      const { stripe, customerId, useTest } = found;
      const sub = await loadLatestSubscriptionForCustomer(stripe, customerId);
      if (sub) {
        await stripe.subscriptions.update(sub.id, {
          metadata: {
            ...(sub.metadata ?? {}),
            firebaseUid: uid,
          },
        });
        try {
          await stripe.customers.update(customerId, {
            metadata: { firebaseUid: uid },
          });
        } catch {
          /* non-fatal */
        }
        const refreshed = await stripe.subscriptions.retrieve(sub.id);
        await syncSubscriptionToFirestore(uid, refreshed, useTest);
        return {
          ok: true,
          message: `Linked Stripe customer ${customerId} and subscription ${sub.id} (${useTest ? "test" : "live"}).`,
          data: { stripeCustomerId: customerId, subscriptionId: sub.id },
        };
      }
      await db.collection("users").doc(uid).set(
        {
          stripeCustomerId: customerId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return {
        ok: true,
        message: `Linked Stripe customer ${customerId} (${useTest ? "test" : "live"}) — no subscription on that customer yet.`,
        data: { stripeCustomerId: customerId },
      };
    }

    case "update_user": {
      const updates: Parameters<typeof auth.updateUser>[1] = {};
      if (typeof body.displayName === "string") {
        updates.displayName = body.displayName.trim() || undefined;
      }
      if (typeof body.email === "string") {
        const nextEmail = body.email.trim().toLowerCase();
        if (!nextEmail) throw Object.assign(new Error("Email cannot be empty."), { status: 400 });
        updates.email = nextEmail;
      }
      if (typeof body.password === "string") {
        if (body.password.length > 0 && body.password.length < 6) {
          throw Object.assign(new Error("Password must be at least 6 characters."), { status: 400 });
        }
        if (body.password.length >= 6) {
          if (!record.email?.trim()) {
            throw Object.assign(new Error("User has no email — cannot set a password."), { status: 400 });
          }
          updates.password = body.password;
        }
      }
      if (typeof body.phoneNumber === "string") {
        const raw = body.phoneNumber.trim();
        if (!raw) {
          updates.phoneNumber = null;
        } else {
          updates.phoneNumber = normalizePhoneToE164(raw, "CH");
        }
      }
      if (typeof body.emailVerified === "boolean") updates.emailVerified = body.emailVerified;
      if (typeof body.disabled === "boolean") updates.disabled = body.disabled;

      if (Object.keys(updates).length === 0) {
        throw Object.assign(new Error("No profile fields to update."), { status: 400 });
      }

      await auth.updateUser(uid, updates);

      if (typeof updates.email === "string") {
        await db.collection("users").doc(uid).set(
          { email: updates.email, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      return { ok: true, message: "User profile updated." };
    }

    default:
      throw Object.assign(new Error("Unknown action."), { status: 400 });
  }
}
