/** Personal import sessions (IndexedDB) — organize statement uploads + Drive dedupe keys. */

export const PERSONAL_SESSION_CHANGED = "paystack-personal-session-changed";

const DB_NAME = "paystack-personal-sessions";
const DB_VERSION = 1;
const STORE = "sessions";
const META = "meta";

export type PersonalSession = {
  id: string;
  name: string;
  createdAt: string;
  /** Content hashes already backed up to Drive for this session. */
  driveFingerprints: string[];
  /** Import ids committed in this session. */
  importIds: string[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore, meta: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, META], mode);
    const store = tx.objectStore(STORE);
    const meta = tx.objectStore(META);
    Promise.resolve(fn(store, meta)).then(resolve, reject);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
  });
}

function idbGet<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(store: IDBObjectStore, value: unknown, key?: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(store: IDBObjectStore, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function listPersonalSessions(): Promise<PersonalSession[]> {
  return withStore("readonly", async (store) => {
    const rows = await idbGetAll<PersonalSession>(store);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export async function getCurrentPersonalSessionId(): Promise<string | null> {
  return withStore("readonly", async (_s, meta) => {
    const id = await idbGet<string>(meta, "currentSessionId");
    return typeof id === "string" ? id : null;
  });
}

export async function setCurrentPersonalSessionId(id: string | null): Promise<void> {
  await withStore("readwrite", async (_s, meta) => {
    if (id) await idbPut(meta, id, "currentSessionId");
    else await idbDelete(meta, "currentSessionId");
  });
}

export async function ensureDefaultPersonalSession(): Promise<PersonalSession> {
  const existing = await listPersonalSessions();
  const currentId = await getCurrentPersonalSessionId();
  if (currentId) {
    const cur = existing.find((s) => s.id === currentId);
    if (cur) return cur;
  }
  if (existing[0]) {
    await setCurrentPersonalSessionId(existing[0].id);
    return existing[0];
  }
  const year = new Date().getFullYear();
  return addPersonalSession(`Personal ${year}`);
}

export async function addPersonalSession(name: string): Promise<PersonalSession> {
  const row: PersonalSession = {
    id: `psess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Session ${new Date().toISOString().slice(0, 10)}`,
    createdAt: new Date().toISOString(),
    driveFingerprints: [],
    importIds: [],
  };
  await withStore("readwrite", async (store, meta) => {
    await idbPut(store, row);
    await idbPut(meta, row.id, "currentSessionId");
  });
  return row;
}

export async function renamePersonalSession(id: string, name: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    const row = await idbGet<PersonalSession>(store, id);
    if (!row) return;
    await idbPut(store, { ...row, name: name.trim() || row.name });
  });
}

export async function deletePersonalSession(id: string): Promise<void> {
  await withStore("readwrite", async (store, meta) => {
    await idbDelete(store, id);
    const cur = await idbGet<string>(meta, "currentSessionId");
    if (cur === id) {
      const rest = await idbGetAll<PersonalSession>(store);
      await idbPut(meta, rest[0]?.id || null, "currentSessionId");
    }
  });
}

export async function recordPersonalSessionImport(sessionId: string, importId: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    const row = await idbGet<PersonalSession>(store, sessionId);
    if (!row) return;
    if (row.importIds.includes(importId)) return;
    await idbPut(store, { ...row, importIds: [...row.importIds, importId] });
  });
}

export async function hasPersonalDriveFingerprint(sessionId: string, fingerprint: string): Promise<boolean> {
  return withStore("readonly", async (store) => {
    const row = await idbGet<PersonalSession>(store, sessionId);
    return Boolean(row?.driveFingerprints.includes(fingerprint));
  });
}

export async function addPersonalDriveFingerprint(sessionId: string, fingerprint: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    const row = await idbGet<PersonalSession>(store, sessionId);
    if (!row) return;
    if (row.driveFingerprints.includes(fingerprint)) return;
    await idbPut(store, { ...row, driveFingerprints: [...row.driveFingerprints, fingerprint] });
  });
}

/** Stable fingerprint for Drive dedupe (name + size + lastModified). */
export async function fingerprintPersonalFile(file: File): Promise<string> {
  const base = `${file.name}|${file.size}|${file.lastModified}`;
  try {
    const data = new TextEncoder().encode(base);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  } catch {
    return btoa(base).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  }
}
