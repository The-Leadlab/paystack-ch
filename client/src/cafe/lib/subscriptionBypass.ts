import type { User } from "firebase/auth";
import {
  PERSONAL_DEV_ADMIN_EMAIL,
  isPersonalDevAdminEmail,
} from "@shared/personalProductAccess";

const BUILT_IN_BYPASS_EMAILS = [
  "admin@test.com",
  PERSONAL_DEV_ADMIN_EMAIL,
  "joshua@the-leadlab.com",
  "kara@the-leadlab.com",
  "kldavies2016@gmail.com",
];

/**
 * Plan-test sandbox emails (must pick Starter/Business/Unlimited without Stripe).
 * Joshua is full bypass with unlimited entitlements — not in this list.
 */
const BUILT_IN_PLAN_TEST_EMAILS: string[] = [];

/** Ops who see an Admin panel shortcut inside `/app`. */
const BUILT_IN_ADMIN_APP_ACCESS_EMAILS = ["joshua@the-leadlab.com", PERSONAL_DEV_ADMIN_EMAIL];

/**
 * Who may open `/personal` while Personal is not publicly available.
 * Dev admin (`ali@the-leadlab.com`) only — do not expand without product approval.
 */
const BUILT_IN_PERSONAL_FINANCES_EMAILS = [PERSONAL_DEV_ADMIN_EMAIL];

export { isPersonalDevAdminEmail };

/** Dev admin: Personal lab access + Admin panel labeled “Dev admin”. */
export function isDevAdminEmail(email: string | null | undefined): boolean {
  return isPersonalDevAdminEmail(email);
}

export function isDevAdminUser(user: User | null): boolean {
  return isDevAdminEmail(user?.email);
}

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

export function adminAppAccessEmails(): string[] {
  const configured = String(import.meta.env.VITE_ADMIN_APP_ACCESS_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BUILT_IN_ADMIN_APP_ACCESS_EMAILS, ...configured]));
}

export function isAdminAppAccessEmail(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return Boolean(normalized && adminAppAccessEmails().includes(normalized));
}

export function isAdminAppAccessUser(
  user: User | null,
  opts?: { appAdmin?: boolean | null }
): boolean {
  if (isAdminAppAccessEmail(user?.email)) return true;
  if (opts?.appAdmin === true) return true;
  return false;
}

export function personalFinancesAccessEmails(): string[] {
  const configured = String(import.meta.env.VITE_PERSONAL_FINANCES_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BUILT_IN_PERSONAL_FINANCES_EMAILS, ...configured]));
}

export function isPersonalFinancesAccessEmail(email: string | null | undefined): boolean {
  const normalized = email?.toLowerCase().trim();
  return Boolean(normalized && personalFinancesAccessEmails().includes(normalized));
}

export function isPersonalFinancesAccessUser(user: User | null): boolean {
  return isPersonalFinancesAccessEmail(user?.email);
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
