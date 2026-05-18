import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { BillingLinkFirestorePatch } from "@shared/billingLink";

/** Merge server-verified Stripe billing fields into `users/{uid}` (Option B, no Admin SDK). */
export async function applyBillingLinkToFirestore(
  uid: string,
  billing: BillingLinkFirestorePatch
): Promise<void> {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { subscriptionStatus: "none" }, { merge: true });
  }
  await setDoc(
    ref,
    {
      stripeCustomerId: billing.stripeCustomerId,
      subscriptionId: billing.subscriptionId,
      subscriptionStatus: billing.subscriptionStatus,
      planId: billing.planId,
      trialEndsAt: billing.trialEndsAt ? Timestamp.fromDate(new Date(billing.trialEndsAt)) : null,
      currentPeriodEnd: Timestamp.fromDate(new Date(billing.currentPeriodEnd)),
      billingLinkedAt: Timestamp.fromDate(new Date(billing.billingLinkedAt)),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
