import { useCallback, useEffect, useRef, useState } from "react";
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
  const [syncError, setSyncError] = useState<string | null>(null);

  /** Callers often pass an inline `seed` literal (new reference every render); read via ref
   * so it doesn't sit in `refresh`'s deps and destabilize its identity. */
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const localKey = `ali-lab-${localSuffix}-${uid || "anon"}`;

  const writeLocal = useCallback(
    (next: T[]) => {
      try {
        localStorage.setItem(localKey, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    },
    [localKey]
  );

  const persistLocal = useCallback(
    (next: T[]) => {
      setItems(next);
      writeLocal(next);
    },
    [writeLocal]
  );

  const readLocal = useCallback((): T[] => {
    try {
      const local = JSON.parse(localStorage.getItem(localKey) || "[]") as T[];
      return Array.isArray(local) ? local : [];
    } catch {
      return [];
    }
  }, [localKey]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSyncError(null);
    const local = readLocal();
    try {
      const remote = await loadLabDocs<T>(uid, collectionName, localSuffix);
      if (remote.length > 0) {
        // Prefer remote, but keep any newer local-only rows (cloud write may have failed).
        const remoteIds = new Set(remote.map((r) => r.id));
        const localOnly = local.filter((r) => !remoteIds.has(r.id));
        const merged = [...remote, ...localOnly];
        setItems(merged);
        writeLocal(merged);
      } else if (local.length > 0) {
        setItems(local);
      } else {
        setItems(seedRef.current);
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
      setItems(local.length > 0 ? local : seedRef.current);
    }
    setLoading(false);
  }, [uid, collectionName, localSuffix, localKey, readLocal, writeLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (data: Omit<T, "id">) => {
      const tempId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      let id = tempId;
      setSyncError(null);

      // Optimistic local write first so refresh never loses Expected budgets.
      const optimistic = { id, ...data } as T;
      setItems((prev) => {
        const next = [...prev, optimistic];
        writeLocal(next);
        return next;
      });

      try {
        id = await addLabDoc(uid, collectionName, data as Record<string, unknown>);
        if (id !== tempId) {
          setItems((prev) => {
            const next = prev.map((x) => (x.id === tempId ? ({ ...x, id } as T) : x));
            writeLocal(next);
            return next;
          });
        }
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : String(e));
        // Keep local row with tempId
      }

      return { id, ...data } as T;
    },
    [uid, collectionName, writeLocal]
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      setSyncError(null);
      setItems((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
        writeLocal(next);
        return next;
      });
      try {
        if (uid && db) await updateLabDoc(uid, collectionName, id, patch as Record<string, unknown>);
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : String(e));
      }
    },
    [uid, collectionName, writeLocal]
  );

  const remove = useCallback(
    async (id: string) => {
      setSyncError(null);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        writeLocal(next);
        return next;
      });
      try {
        if (uid && db) await removeLabDoc(uid, collectionName, id);
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : String(e));
      }
    },
    [uid, collectionName, writeLocal]
  );

  return { items, loading, refresh, add, update, remove, setItems: persistLocal, uid, syncError };
}
