import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";

const FIELD = "revenueLedgerEnabled";

export function useRevenueLedgerPrefs(): {
  enabled: boolean;
  loading: boolean;
  setEnabled: (next: boolean) => Promise<void>;
  toggle: () => Promise<void>;
} {
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(Boolean(user?.uid));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid || !db) {
        if (!cancelled) {
          setEnabledState(false);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (!cancelled) setEnabledState(snapshot.data()?.[FIELD] === true);
      } catch (error) {
        console.warn("Could not load revenue ledger preference:", error);
        if (!cancelled) setEnabledState(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      setEnabledState(next);
      if (!user?.uid || !db) return;
      try {
        await setDoc(doc(db, "users", user.uid), { [FIELD]: next }, { merge: true });
      } catch (error) {
        console.warn("Could not save revenue ledger preference:", error);
        setEnabledState(!next);
        throw error;
      }
    },
    [user?.uid]
  );

  const toggle = useCallback(async () => {
    await setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, loading, setEnabled, toggle };
}
