import type { CheckoutLinkFailure } from "./stripeCheckoutClient";
import { formatCustomerCheckoutError } from "./formatCustomerCheckoutError";

/** Map API / Firestore link errors to LanguageContext keys or a fallback message. */
export function formatCheckoutLinkError(
  err: unknown,
  t: (key: string) => string
): string {
  const e = err as CheckoutLinkFailure;
  const code = e?.code;
  if (code === "email_mismatch") {
    const stripeEmail = e.stripeEmail;
    if (stripeEmail) {
      return t("checkoutLinkEmailMismatch").replace("{email}", stripeEmail);
    }
    return t("checkoutLinkEmailHint");
  }
  if (code === "firestore_permission") {
    return t("checkoutLinkFirestoreDenied");
  }
  if (code === "auth_no_email") {
    return t("checkoutLinkNoEmail");
  }
  const msg = e instanceof Error ? e.message : String(err);
  if (/Firebase Admin credentials/i.test(msg)) {
    return t("checkoutLinkAdminBlockedHint");
  }
  return formatCustomerCheckoutError(err, t, "checkoutLinkGeneric");
}
