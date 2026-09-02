import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isMultiLoginMode, parseLoginMode, type LoginMode } from '@shared/loginMode';

const STORAGE_KEY = 'paystack_client_session_id';
const ROLE_KEY = 'paystack_client_session_role';

export type ClientSessionRole = 'primary' | 'viewer';
export type StoredClientRole = ClientSessionRole | 'contributor';

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
    sessionStorage.removeItem(ROLE_KEY);
  } catch {
    /* ignore */
  }
}

export function setClientSessionRole(role: StoredClientRole): void {
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

export function getClientSessionRole(): StoredClientRole {
  try {
    const raw = sessionStorage.getItem(ROLE_KEY);
    if (raw === 'viewer' || raw === 'contributor') return raw;
    return 'primary';
  } catch {
    return 'primary';
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

/** Register login — shared mode keeps existing primary; exclusive mode claims session. */
export async function registerClientSession(
  uid: string,
  loginMode?: LoginMode
): Promise<{ sessionId: string; role: ClientSessionRole }> {
  const id = crypto.randomUUID();
  setLocalClientSessionId(id);
  if (!db) return { sessionId: id, role: 'primary' };

  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const mode = loginMode ?? parseLoginMode(data?.loginMode);
  const remote = data?.activeClientSessionId;

  if (
    isSingleActiveSessionEnabled() &&
    isMultiLoginMode(mode) &&
    typeof remote === 'string' &&
    remote.length > 0 &&
    remote !== id
  ) {
    setClientSessionRole('viewer');
    return { sessionId: id, role: 'viewer' };
  }

  await setDoc(
    doc(db, 'users', uid),
    {
      activeClientSessionId: id,
      activeClientSessionAt: serverTimestamp(),
    },
    { merge: true }
  );
  setClientSessionRole('primary');
  return { sessionId: id, role: 'primary' };
}

/** Reconcile viewer vs primary after tab refresh (shared login mode). */
export async function syncClientSessionRole(uid: string): Promise<StoredClientRole> {
  const local = getLocalClientSessionId();
  if (!local || !db) return getClientSessionRole();

  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const mode = parseLoginMode(data?.loginMode);
  const remote = data?.activeClientSessionId;

  if (
    isSingleActiveSessionEnabled() &&
    isMultiLoginMode(mode) &&
    typeof remote === 'string' &&
    remote.length > 0 &&
    remote !== local
  ) {
    setClientSessionRole('viewer');
    return 'viewer';
  }

  if (typeof remote === 'string' && remote === local) {
    setClientSessionRole('primary');
    return 'primary';
  }

  return getClientSessionRole();
}

export async function verifyActiveClientSession(uid: string): Promise<boolean> {
  if (!isSingleActiveSessionEnabled()) return true;
  const local = getLocalClientSessionId();
  if (!local || !db) return true;
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data();
  const remote = data?.activeClientSessionId;
  if (typeof remote !== 'string' || !remote) return true;
  if (remote === local) return true;
  if (isMultiLoginMode(data?.loginMode)) return true;
  return false;
}

export function watchActiveClientSession(
  uid: string,
  onKicked: () => void
): () => void {
  if (!isSingleActiveSessionEnabled() || !db) return () => undefined;
  const local = getLocalClientSessionId();
  if (!local) return () => undefined;
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const data = snap.data();
    const remote = data?.activeClientSessionId;
    if (typeof remote !== 'string' || !remote || remote === local) return;
    if (isMultiLoginMode(data?.loginMode)) return;
    onKicked();
  });
}
