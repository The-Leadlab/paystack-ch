/**
 * Internal email when a new customer completes trial checkout / links their account.
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { parseTruthyEnv } from "../shared/stripeMode.js";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { sendResendEmail } from "./resendEmail.js";

const DEFAULT_RECIPIENTS = ["joshua@the-leadlab.com", "ali@the-leadlab.com"];

export function newUserNotifyRecipients(): string[] {
  const raw = process.env.NEW_USER_NOTIFY_EMAILS?.trim();
  if (!raw) return [...DEFAULT_RECIPIENTS];
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_RECIPIENTS];
}

export function newUserNotifyEnabled(useTestStripe: boolean): boolean {
  if (!useTestStripe) return true;
  return parseTruthyEnv(process.env.NEW_USER_NOTIFY_IN_TEST);
}

async function claimNotifyDedupeKey(dedupeKey: string): Promise<boolean> {
  if (!hasFirebaseAdminCredentials()) return true;
  ensureFirebaseAdmin();
  const db = getFirestore();
  const ref = db.collection("adminNotifyDedup").doc(dedupeKey);
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set({ kind: "new_user", at: FieldValue.serverTimestamp() });
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyAdminsNewUser(opts: {
  email: string;
  displayName?: string | null;
  uid?: string | null;
  planId?: string | null;
  stripeSessionId?: string | null;
  source: "checkout_webhook" | "checkout_link";
  useTestStripe?: boolean;
}): Promise<void> {
  if (!newUserNotifyEnabled(Boolean(opts.useTestStripe))) return;

  const dedupeKey = opts.stripeSessionId
    ? `newUser:${opts.stripeSessionId}`
    : opts.uid
      ? `newUser:uid:${opts.uid}`
      : `newUser:email:${opts.email.toLowerCase()}`;

  try {
    const shouldSend = await claimNotifyDedupeKey(dedupeKey);
    if (!shouldSend) return;
  } catch (e) {
    console.warn("[newUserNotify] dedupe check failed — sending anyway:", e);
  }

  const email = opts.email.trim().toLowerCase();
  if (!email) return;

  const plan = opts.planId?.trim() || "starter";
  const name = opts.displayName?.trim() || "—";
  const appUrl = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://www.paystack.ch";
  const modeLabel = opts.useTestStripe ? " (Stripe test)" : "";

  const subject = `New Paystack trial signup${modeLabel}: ${email}`;
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#2B2B2B">
<p><strong>New customer</strong> completed checkout and linked their account on Paystack.ch.</p>
<table style="border-collapse:collapse;margin:16px 0">
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Email</td><td>${escapeHtml(email)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Name</td><td>${escapeHtml(name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Plan</td><td>${escapeHtml(plan)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600">Source</td><td>${escapeHtml(opts.source)}</td></tr>
${opts.uid ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Firebase UID</td><td style="font-family:monospace;font-size:12px">${escapeHtml(opts.uid)}</td></tr>` : ""}
${opts.stripeSessionId ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Stripe session</td><td style="font-family:monospace;font-size:12px">${escapeHtml(opts.stripeSessionId)}</td></tr>` : ""}
</table>
<p><a href="${escapeHtml(appUrl)}/admin">Open admin panel</a></p>
</body></html>`;

  try {
    await sendResendEmail({
      to: newUserNotifyRecipients(),
      subject,
      html,
    });
    console.info("[newUserNotify] sent to", newUserNotifyRecipients().join(", "), "for", email);
  } catch (e) {
    console.error("[newUserNotify] failed:", e);
  }
}
