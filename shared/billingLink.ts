import type { PaystackPlanId } from "./planCatalog";

/** Fields the client may merge into `users/{uid}` after a verified Stripe link (Option B). */
export type BillingLinkFirestorePatch = {
  stripeCustomerId: string | null;
  subscriptionId: string;
  subscriptionStatus: string;
  planId: PaystackPlanId;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  billingLinkedAt: string;
};

export type LinkCheckoutSessionResponse = {
  ok: true;
  billing: BillingLinkFirestorePatch;
  /** Present when server could not use Admin SDK; client must write `billing` to Firestore. */
  clientWriteRequired?: boolean;
};
