import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, firebaseProjectId } from "./firebase";
import type { BillingLinkFirestorePatch } from "@shared/billingLink";

/** Merge server-verified Stripe billing fields into `users/{uid}` (Option B, no Admin SDK). */
export async function applyBillingLinkToFirestore(
  uid: string,
  billing: BillingLinkFirestorePatch
): Promise<void> {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  try {
    await setDoc(
      doc(db, "users", uid),
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|insufficient/i.test(msg)) {
      throw new Error(
        `Firestore denied saving your plan (project ${firebaseProjectId ?? "unknown"}). ` +
          "In Firebase Console → Firestore → Rules, publish the firestore.rules from this repo, then try again."
      );
    }
    throw e;
  }
}
