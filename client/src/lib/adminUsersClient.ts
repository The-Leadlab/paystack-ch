import { apiUrl } from "@/lib/apiBase";

export type AdminUserSummary = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  providerIds: string[];
  planId: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  planTestMode: boolean;
  usageThisMonth: number | null;
  appAdmin: boolean;
  deepPdfInvoiceBeta: boolean;
};

export type AdminUserDetail = AdminUserSummary & {
  photoUrl: string | null;
  phoneNumber: string | null;
  stripeInvoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
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
  lastPaymentAt: string | null;
  paymentLate: boolean;
  stripeCustomerMatchPending: boolean;
};

function readApiError(status: number, data: unknown, raw: string): string {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
    if (rec.error && typeof rec.error === "object") {
      const inner = rec.error as Record<string, unknown>;
      if (typeof inner.message === "string" && inner.message.trim()) return inner.message;
    }
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  }
  if (raw.includes("FUNCTION_INVOCATION_FAILED")) {
    return `Admin API crashed (HTTP ${status}). Try again; if it persists, check Vercel logs.`;
  }
  const snippet = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  if (snippet) return `Request failed (HTTP ${status}): ${snippet}`;
  return `Request failed (HTTP ${status})`;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const raw = await res.text();
  let data: ({ error?: unknown } & T) | undefined;
  try {
    data = raw ? (JSON.parse(raw) as { error?: unknown } & T) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    throw new Error(readApiError(res.status, data, raw));
  }
  return (data ?? ({} as T)) as T;
}

export async function checkAdminSession(): Promise<boolean> {
  try {
    const data = await adminFetch<{ ok: boolean }>("/api/admin/session");
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function listAdminUsers(search?: string): Promise<{
  users: AdminUserSummary[];
  total: number;
}> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return adminFetch(`/api/admin/users${q}`);
}

export async function getAdminUser(uid: string): Promise<AdminUserDetail> {
  const data = await adminFetch<{ user: AdminUserDetail }>(`/api/admin/user?uid=${encodeURIComponent(uid)}`);
  return data.user;
}

export type AdminUserActionBody =
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
  | { action: "set_plan"; planId: string | null; planTestMode?: boolean }
  | { action: "set_app_admin"; enabled: boolean }
  | { action: "set_deep_pdf_invoice_beta"; enabled: boolean }
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

export type CreateAdminUserBody = {
  email: string;
  password: string;
  displayName?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  planId?: string | null;
  planTestMode?: boolean;
};

export async function createAdminUser(
  body: CreateAdminUserBody
): Promise<{ ok: boolean; uid: string; email: string; message: string }> {
  return adminFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function runAdminUserAction(
  uid: string,
  body: AdminUserActionBody
): Promise<{ ok: boolean; message: string; data?: { resetLink?: string; verificationLink?: string; refundId?: string } }> {
  return adminFetch("/api/admin/user", {
    method: "POST",
    body: JSON.stringify({ uid, ...body }),
  });
}
