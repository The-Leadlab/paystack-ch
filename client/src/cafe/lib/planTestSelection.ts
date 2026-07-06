import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { PaystackPlanId } from "@shared/planCatalog";

const PLAN_TEST_PLANS: PaystackPlanId[] = ["starter", "business", "unlimited"];

export function isPlanTestPlanId(id: PaystackPlanId): boolean {
  return PLAN_TEST_PLANS.includes(id);
}

/** Apply a sandbox plan on the user's Firestore billing doc (no Stripe checkout). */
export async function applyPlanTestSelection(uid: string, planId: PaystackPlanId): Promise<void> {
  if (!db) throw new Error("Firebase is not configured");
  if (!isPlanTestPlanId(planId)) {
    throw new Error("Only starter, business, and unlimited can be selected in plan test mode");
  }
  await setDoc(
    doc(db, "users", uid),
    {
      planId,
      subscriptionStatus: "active",
      planTestMode: true,
    },
    { merge: true }
  );
}

export { PLAN_TEST_PLANS };
