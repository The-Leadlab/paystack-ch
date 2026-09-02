import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const STORAGE_KEY = 'paystack_client_session_id';

export function isSingleActiveSessionEnabled(): boolean {
  const raw = import.meta.env.VITE_SINGLE_ACTIVE_SESSION?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return true;
}

export function getLocalClientSessionId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLocalClientSessionId(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearLocalClientSessionId(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function claimActiveClientSession(uid: string): Promise<string> {
  const id = crypto.randomUUID();
  setLocalClientSessionId(id);
  if (!db) return id;
  await setDoc(
    doc(db, 'users', uid),
    {
      activeClientSessionId: id,
      activeClientSessionAt: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}

export async function verifyActiveClientSession(uid: string): Promise<boolean> {
  if (!isSingleActiveSessionEnabled()) return true;
  const local = getLocalClientSessionId();
  if (!local || !db) return true;
  const snap = await getDoc(doc(db, 'users', uid));
  const remote = snap.data()?.activeClientSessionId;
  if (typeof remote !== 'string' || !remote) return true;
  return remote === local;
}

export function watchActiveClientSession(
  uid: string,
  onKicked: () => void
): () => void {
  if (!isSingleActiveSessionEnabled() || !db) return () => undefined;
  const local = getLocalClientSessionId();
  if (!local) return () => undefined;
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const remote = snap.data()?.activeClientSessionId;
    if (typeof remote === 'string' && remote && remote !== local) {
      onKicked();
    }
  });
}
