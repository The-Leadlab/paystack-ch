import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { isInventoryAllowedForUser } from "@shared/inventoryAccess";
import { useAuth } from "../context/AuthContext";
import { useUkUat } from "../context/UkUatContext";
import { db } from "../lib/firebase";
import { isAdminAppAccessUser } from "../lib/subscriptionBypass";

/** Shared inventory/stock visibility gate for /app and /admin-uk. */
export function useInventoryAllowed(): boolean {
  const { user } = useAuth();
  const { ukUatActive } = useUkUat();
  const [inventoryBeta, setInventoryBeta] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) {
      setInventoryBeta(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setInventoryBeta(snap.data()?.inventoryBeta === true);
    });
    return () => unsub();
  }, [user?.uid]);

  return isInventoryAllowedForUser(user?.email, {
    inventoryBeta,
    ukUatActive,
    adminAppAccess: isAdminAppAccessUser(user),
  });
}
