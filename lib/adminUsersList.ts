/**
 * Admin user list + create — Firebase Auth + Firestore only.
 * Kept off `stripeBilling` so GET /api/admin/users can boot on Vercel.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { parsePaystackPlanId, type PaystackPlanId } from "../shared/planCatalog.js";
import { parseLoginMode, type LoginMode } from "../shared/loginMode.js";
import {
  aggregateUserAnalytics,
  googleDriveConnectedFromBilling,
  type UserAnalyticsRollup,
} from "./userAnalytics.js";

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
  /** Platform admin: in-app /admin shortcut + ops privileges. */
  appAdmin: boolean;
  /** Force deep multi-page / multi-invoice PDF extraction. */
  deepPdfInvoiceBeta: boolean;
  /** Operator beta cohort tag (e.g. glanville). */
  betaCohort: string | null;
  lastActiveAt: string | null;
  logins30d: number | null;
  sessionMinutes30d: number | null;
  errors30d: number | null;
  uploads30d: number | null;
  googleDriveConnected: boolean;
  loginMode: "exclusive" | "shared" | null;
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

export function tsToIso(value: unknown): string | null {
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

export function usageForCurrentMonth(usage: Record<string, number> | undefined): number | null {
  if (!usage || typeof usage !== "object") return null;
  const key = new Date().toISOString().slice(0, 7);
  const val = usage[key];
  return typeof val === "number" ? val : 0;
}

export async function loadFirestoreBilling(uid: string): Promise<Record<string, unknown> | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

export function summaryFromAuthAndBilling(
  record: import("firebase-admin/auth").UserRecord,
  billing: Record<string, unknown> | null
): AdminUserSummary {
  const usage = billing?.usage as Record<string, number> | undefined;
  const analyticsRaw =
    billing?.analytics && typeof billing.analytics === "object"
      ? (billing.analytics as Record<string, unknown>)
      : null;
  const rollup: UserAnalyticsRollup = aggregateUserAnalytics(analyticsRaw);
  const lastActiveAt =
    rollup.lastActiveAt ??
    tsToIso(analyticsRaw?.lastActiveAt) ??
    record.metadata.lastSignInTime ??
    null;
  const betaCohort =
    typeof billing?.betaCohort === "string" && billing.betaCohort.trim()
      ? billing.betaCohort.trim()
      : null;
  const loginModeRaw = billing?.loginMode;
  const loginMode: LoginMode | null =
    loginModeRaw != null ? parseLoginMode(loginModeRaw) : null;

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
    appAdmin: billing?.appAdmin === true || record.customClaims?.appAdmin === true,
    deepPdfInvoiceBeta: billing?.deepPdfInvoiceBeta === true,
    betaCohort,
    lastActiveAt,
    logins30d: rollup.logins30d,
    sessionMinutes30d: rollup.sessionMinutes30d,
    errors30d: rollup.errors30d,
    uploads30d: rollup.uploads30d,
    googleDriveConnected: googleDriveConnectedFromBilling(billing),
    loginMode,
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
    const billingSnaps = await Promise.all(page.users.map((u) => db.collection("users").doc(u.uid).get()));
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
