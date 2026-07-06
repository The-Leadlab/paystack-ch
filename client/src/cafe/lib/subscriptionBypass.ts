import type { User } from "firebase/auth";

const BUILT_IN_BYPASS_EMAILS = [
  "admin@test.com",
  "ali@the-leadlab.com",
  "kara@the-leadlab.com",
  "kldavies2016@gmail.com",
];

/** Team accounts that skip Stripe paywall but must pick a plan to simulate real entitlements. */
const BUILT_IN_PLAN_TEST_EMAILS = ["joshua@the-leadlab.com"];

export function planTestEmails(): string[] {
  const configured = String(import.meta.env.VITE_PLAN_TEST_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BUILT_IN_PLAN_TEST_EMAILS, ...configured]));
}

export function isPlanTestEmail(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return Boolean(normalized && planTestEmails().includes(normalized));
}

export function isPlanTestUser(user: User | null): boolean {
  return isPlanTestEmail(user?.email);
}

export function subscriptionBypassEmails(): string[] {
  const configured = String(import.meta.env.VITE_SUBSCRIPTION_BYPASS_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BUILT_IN_BYPASS_EMAILS, ...configured, ...planTestEmails()]));
}

export function isSubscriptionBypassEmail(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return Boolean(normalized && subscriptionBypassEmails().includes(normalized));
}

/** Bypass subscription enforcement and email verification (legacy admins / ops). */
export function isSubscriptionOrVerificationBypassUser(user: User | null): boolean {
  if (!user) return false;
  const uids = String(import.meta.env.VITE_SUBSCRIPTION_BYPASS_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (uids.includes(user.uid)) return true;
  return isSubscriptionBypassEmail(user.email);
}
