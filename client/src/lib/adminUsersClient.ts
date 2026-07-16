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

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let data: { error?: string } & T = {} as { error?: string } & T;
  try {
    data = (await res.json()) as { error?: string } & T;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  }
  return data;
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
