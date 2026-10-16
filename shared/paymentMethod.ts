/**
 * Payment methods for restaurant revenue.
 *
 * Auto-fill only from sources that actually report tender (POS Z-reading,
 * Stripe/Lightspeed CSV). Manual invoice uploads stay unspecified until the
 * user picks a method.
 */

export const MANUAL_PAYMENT_METHODS = [
  "cash",
  "card",
  "twint",
  "bank_transfer",
  "other",
] as const;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];
export type StoredPaymentMethod = ManualPaymentMethod | "unspecified";

export const PAYMENT_MIX_BUCKETS = [
  "cash",
  "card",
  "twint",
  "bank_transfer",
  "other",
  "unspecified",
] as const;

export type PaymentMixBucket = (typeof PAYMENT_MIX_BUCKETS)[number];

const ALIASES: Array<{ bucket: PaymentMixBucket; needles: string[] }> = [
  { bucket: "cash", needles: ["cash", "especes", "espèces", "liquide", "bar"] },
  { bucket: "card", needles: ["card", "carte", "visa", "mastercard", "amex", "debit", "apple_pay", "google_pay"] },
  { bucket: "twint", needles: ["twint"] },
  { bucket: "bank_transfer", needles: ["bank_transfer", "bank", "transfer", "virement", "payout"] },
];

export function normalizeStoredPaymentMethod(
  raw: string | null | undefined
): StoredPaymentMethod {
  const t = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (!t || t === "unspecified" || t === "unknown" || t === "unset") return "unspecified";
  for (const { bucket, needles } of ALIASES) {
    if (needles.some((n) => t === n || t.includes(n))) return bucket === "unspecified" ? "unspecified" : bucket;
  }
  if ((MANUAL_PAYMENT_METHODS as readonly string[]).includes(t)) return t as ManualPaymentMethod;
  if (t === "gift_card" || t === "voucher" || t === "other") return "other";
  return "other";
}

export function paymentMixBucket(raw: string | null | undefined): PaymentMixBucket {
  return normalizeStoredPaymentMethod(raw);
}

export function isAssignedPaymentMethod(
  raw: string | null | undefined
): raw is ManualPaymentMethod {
  const n = normalizeStoredPaymentMethod(raw);
  return n !== "unspecified";
}

export const PAYMENT_METHOD_I18N: Record<StoredPaymentMethod, { en: string; fr: string }> = {
  cash: { en: "Cash", fr: "Espèces" },
  card: { en: "Card", fr: "Carte" },
  twint: { en: "TWINT", fr: "TWINT" },
  bank_transfer: { en: "Bank transfer", fr: "Virement" },
  other: { en: "Other", fr: "Autre" },
  unspecified: { en: "Unspecified", fr: "Non spécifié" },
};
