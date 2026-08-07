import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/cafe/context/AuthContext";
import { useWorkspaceOptional } from "@/cafe/context/WorkspaceContext";
import { auth, db } from "@/cafe/lib/firebase";
import {
  addLabDoc,
  loadLabDocs,
  removeLabDoc,
  updateLabDoc,
} from "../aliLabFirestore";

function isPermissionError(msg: string): boolean {
  return /missing or insufficient permissions|permission-denied|permission_denied|unauthorized/i.test(
    msg
  );
}

async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isPermissionError(msg) && auth?.currentUser) {
      try {
        await auth.currentUser.getIdToken(true);
        return await fn();
      } catch (retryErr) {
        throw retryErr;
      }
    }
    throw e;
  }
}

export function useAliLabPersist<T extends { id: string }>(
  collectionName: string,
  localSuffix: string,
  seed: T[] = []
) {
  const { user } = useAuth();
  const workspace = useWorkspaceOptional();
  const uid = workspace?.dataOwnerUid || user?.uid;
  const canWrite = workspace?.canWrite !== false;
  const [items, setItems] = useState<T[]>(seed);
  const [loading, setLoading] = useState(true);
  /** Soft message — local data is authoritative when cloud is unavailable. */
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cloudAvailable, setCloudAvailable] = useState(true);
  /** True when last failure was a write (show slightly more emphasis). */
  const [syncWriteFailed, setSyncWriteFailed] = useState(false);

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
    setSyncWriteFailed(false);
    const local = readLocal();
    try {
      const remote = await withAuthRetry(() =>
        loadLabDocs<T>(uid, collectionName, localSuffix)
      );
      setCloudAvailable(true);
      setSyncError(null);
      if (remote.length > 0) {
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
      const msg = e instanceof Error ? e.message : String(e);
      setCloudAvailable(false);
      // Soft: local is fine — do not alarm on load-only permission failures.
      if (isPermissionError(msg)) {
        setSyncError(null);
      } else {
        setSyncError(msg);
      }
      setItems(local.length > 0 ? local : seedRef.current);
    }
    setLoading(false);
  }, [uid, collectionName, localSuffix, readLocal, writeLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onLab = () => void refresh();
    window.addEventListener("ali-lab-data-changed", onLab);
    return () => window.removeEventListener("ali-lab-data-changed", onLab);
  }, [refresh]);

  const add = useCallback(
    async (data: Omit<T, "id">) => {
      if (!canWrite) throw new Error("Read-only access");
      const tempId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      let id = tempId;
      setSyncError(null);
      setSyncWriteFailed(false);

      const optimistic = { id, ...data } as T;
      setItems((prev) => {
        const next = [...prev, optimistic];
        writeLocal(next);
        return next;
      });

      try {
        id = await withAuthRetry(() =>
          addLabDoc(uid, collectionName, data as Record<string, unknown>)
        );
        setCloudAvailable(true);
        if (id !== tempId) {
          setItems((prev) => {
            const next = prev.map((x) => (x.id === tempId ? ({ ...x, id } as T) : x));
            writeLocal(next);
            return next;
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCloudAvailable(false);
        setSyncWriteFailed(true);
        setSyncError(isPermissionError(msg) ? "cloud-unavailable" : msg);
      }

      return { id, ...data } as T;
    },
    [uid, collectionName, writeLocal, canWrite]
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (!canWrite) throw new Error("Read-only access");
      setSyncError(null);
      setSyncWriteFailed(false);
      setItems((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
        writeLocal(next);
        return next;
      });
      try {
        if (uid && db) {
          await withAuthRetry(() =>
            updateLabDoc(uid, collectionName, id, patch as Record<string, unknown>)
          );
          setCloudAvailable(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCloudAvailable(false);
        setSyncWriteFailed(true);
        setSyncError(isPermissionError(msg) ? "cloud-unavailable" : msg);
      }
    },
    [uid, collectionName, writeLocal, canWrite]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!canWrite) throw new Error("Read-only access");
      setSyncError(null);
      setSyncWriteFailed(false);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        writeLocal(next);
        return next;
      });
      try {
        if (uid && db) {
          await withAuthRetry(() => removeLabDoc(uid, collectionName, id));
          setCloudAvailable(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCloudAvailable(false);
        setSyncWriteFailed(true);
        setSyncError(isPermissionError(msg) ? "cloud-unavailable" : msg);
      }
    },
    [uid, collectionName, writeLocal, canWrite]
  );

  const dismissSyncError = useCallback(() => {
    setSyncError(null);
    setSyncWriteFailed(false);
  }, []);

  return {
    items,
    loading,
    refresh,
    add,
    update,
    remove,
    setItems: persistLocal,
    uid,
    syncError,
    cloudAvailable,
    syncWriteFailed,
    dismissSyncError,
  };
}
