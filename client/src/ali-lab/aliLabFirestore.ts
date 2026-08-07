import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/cafe/lib/firebase";

const BUDGETS = "ali_lab_budgets";
const BILLS = "ali_lab_bills";
const GOALS = "ali_lab_goals";
const RULES = "ali_lab_rules";
const HOLDINGS = "ali_lab_holdings";
const MEMBERS = "ali_lab_members";
const SPLITS = "ali_lab_splits";
const OFFLINE = "ali_lab_offline_queue";

function localKey(uid: string, suffix: string): string {
  return `ali-lab-${suffix}-${uid || "anon"}`;
}

/** Firestore rejects `undefined` field values — strip before write. */
function stripUndefined<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Keep huge receipt data URLs local-only (Firestore ~1MB doc limit). */
function forFirestoreWrite(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = stripUndefined(data);
  const receipt = cleaned.receiptDataUrl;
  if (typeof receipt === "string" && receipt.length > 400_000) {
    delete cleaned.receiptDataUrl;
  }
  // Extra photo gallery stays device-local (too large for Firestore docs).
  if ("extraReceipts" in cleaned) delete cleaned.extraReceipts;
  return cleaned;
}

export async function loadLabDocs<T extends { id: string }>(
  uid: string | undefined,
  collectionName: string,
  localSuffix: string
): Promise<T[]> {
  if (uid && db) {
    const snap = await getDocs(
      query(collection(db, collectionName), where("restaurantId", "==", uid))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }
  try {
    return JSON.parse(localStorage.getItem(localKey(uid || "anon", localSuffix)) || "[]");
  } catch {
    return [];
  }
}

export async function saveLabDoc<T extends Record<string, unknown>>(
  uid: string | undefined,
  collectionName: string,
  localSuffix: string,
  items: ({ id: string } & T)[]
): Promise<void> {
  if (!uid || !db) {
    localStorage.setItem(localKey(uid || "anon", localSuffix), JSON.stringify(items));
    return;
  }
  // Firestore: caller uses add/update per item; bulk local mirror for offline
  localStorage.setItem(localKey(uid, localSuffix), JSON.stringify(items));
}

export async function addLabDoc<T extends Record<string, unknown>>(
  uid: string | undefined,
  collectionName: string,
  data: T
): Promise<string> {
  if (uid && db) {
    const ref = await addDoc(collection(db, collectionName), {
      ...forFirestoreWrite(data as Record<string, unknown>),
      restaurantId: uid,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  }
  return crypto.randomUUID();
}

export async function updateLabDoc(
  uid: string | undefined,
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  if (uid && db) {
    // Merge + restaurantId so ownership rules stay satisfied on partial patches.
    await setDoc(
      doc(db, collectionName, id),
      {
        ...forFirestoreWrite(data),
        restaurantId: uid,
      },
      { merge: true }
    );
  }
}

export async function removeLabDoc(
  uid: string | undefined,
  collectionName: string,
  id: string
): Promise<void> {
  if (uid && db) {
    await deleteDoc(doc(db, collectionName, id));
  }
}

export const labCollections = {
  budgets: BUDGETS,
  bills: BILLS,
  goals: GOALS,
  rules: RULES,
  holdings: HOLDINGS,
  members: MEMBERS,
  splits: SPLITS,
  offline: OFFLINE,
} as const;
