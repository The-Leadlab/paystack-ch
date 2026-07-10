import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/cafe/context/AuthContext";
import { db } from "@/cafe/lib/firebase";
import {
  addLabDoc,
  loadLabDocs,
  removeLabDoc,
  updateLabDoc,
} from "../aliLabFirestore";

export function useAliLabPersist<T extends { id: string }>(
  collectionName: string,
  localSuffix: string,
  seed: T[] = []
) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [items, setItems] = useState<T[]>(seed);
  const [loading, setLoading] = useState(true);

  const localKey = `ali-lab-${localSuffix}-${uid || "anon"}`;

  const persistLocal = useCallback(
    (next: T[]) => {
      setItems(next);
      try {
        localStorage.setItem(localKey, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [localKey]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadLabDocs<T>(uid, collectionName, localSuffix);
    if (list.length > 0) {
      setItems(list);
    } else {
      try {
        const local = JSON.parse(localStorage.getItem(localKey) || "[]") as T[];
        setItems(local.length > 0 ? local : seed);
      } catch {
        setItems(seed);
      }
    }
    setLoading(false);
  }, [uid, collectionName, localSuffix, localKey, seed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (data: Omit<T, "id">) => {
      const id = await addLabDoc(uid, collectionName, data as Record<string, unknown>);
      const row = { id, ...data } as T;
      setItems((prev) => {
        const next = [...prev, row];
        try {
          localStorage.setItem(localKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      return row;
    },
    [uid, collectionName, localKey, refresh]
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (uid && db) await updateLabDoc(uid, collectionName, id, patch as Record<string, unknown>);
      setItems((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
        try {
          localStorage.setItem(localKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [uid, collectionName, localKey, db]
  );

  const remove = useCallback(
    async (id: string) => {
      if (uid && db) await removeLabDoc(uid, collectionName, id);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        try {
          localStorage.setItem(localKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [uid, collectionName, localKey, db]
  );

  return { items, loading, refresh, add, update, remove, setItems: persistLocal, uid };
}
