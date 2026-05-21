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

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadLabDocs<T>(uid, collectionName, localSuffix);
    if (list.length > 0) {
      setItems(list);
    } else {
      try {
        const key = `ali-lab-${localSuffix}-${uid || "anon"}`;
        const local = JSON.parse(localStorage.getItem(key) || "[]") as T[];
        setItems(local.length > 0 ? local : seed);
      } catch {
        setItems(seed);
      }
    }
    setLoading(false);
  }, [uid, collectionName, localSuffix, seed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistLocal = useCallback(
    (next: T[]) => {
      setItems(next);
      const key = `ali-lab-${localSuffix}-${uid || "anon"}`;
      localStorage.setItem(key, JSON.stringify(next));
    },
    [localSuffix, uid]
  );

  const add = useCallback(
    async (data: Omit<T, "id">) => {
      const id = await addLabDoc(uid, collectionName, data as Record<string, unknown>);
      const row = { id, ...data } as T;
      const next = [...items, row];
      persistLocal(next);
      if (uid && db) void refresh();
      return row;
    },
    [uid, collectionName, items, persistLocal, refresh]
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (uid) await updateLabDoc(uid, collectionName, id, patch as Record<string, unknown>);
      persistLocal(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [uid, collectionName, items, persistLocal]
  );

  const remove = useCallback(
    async (id: string) => {
      if (uid) await removeLabDoc(uid, collectionName, id);
      persistLocal(items.filter((x) => x.id !== id));
    },
    [uid, collectionName, items, persistLocal]
  );

  return { items, loading, refresh, add, update, remove, setItems: persistLocal, uid };
}
