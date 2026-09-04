import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isMultiLoginMode, parseLoginMode, type LoginMode } from '@shared/loginMode';

const STORAGE_KEY = 'paystack_client_session_id';
const ROLE_KEY = 'paystack_client_session_role';

/** Shared-login host is considered gone after this much silence. */
export const SHARED_PRIMARY_IDLE_MS = 15 * 60 * 1000;

/** Presence fresher than this means the host tab is still open. */
const PRIMARY_PRESENCE_FRESH_MS = 90_000;

/** Throttle user-doc activity touches (presence still beats more often). */
const PRIMARY_TOUCH_MIN_INTERVAL_MS = 2 * 60 * 1000;

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

function parseFirestoreTimeMs(raw: unknown): number | null {
  if (raw && typeof raw === 'object' && 'toDate' in (raw as object)) {
    try {
      return (raw as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

/** True when the account has no fresh host heartbeat (or never stamped). */
export function isSharedPrimaryIdle(
  data: Record<string, unknown> | undefined,
  idleMs: number = SHARED_PRIMARY_IDLE_MS
): boolean {
  if (!data) return true;
  const at = parseFirestoreTimeMs(data.activeClientSessionAt);
  if (at == null) return true;
  return Date.now() - at > idleMs;
}

/** Idle on user doc AND no fresh presence from that host browser. */
async function isSharedPrimaryIdleAsync(
  uid: string,
  data: Record<string, unknown> | undefined
): Promise<boolean> {
  if (!isSharedPrimaryIdle(data)) return false;
  if (!db) return true;
  const remote = data?.activeClientSessionId;
  if (typeof remote !== "string" || !remote) return true;
  try {
    const presenceSnap = await getDoc(doc(db, "users", uid, "clientPresence", remote));
    if (!presenceSnap.exists()) return true;
    const last = parseFirestoreTimeMs(presenceSnap.data()?.lastSeenAt);
    if (last != null && Date.now() - last < PRIMARY_PRESENCE_FRESH_MS) return false;
  } catch {
    /* if presence unreadable, fall back to timestamp idle */
  }
  return true;
}

async function writeActiveClientSession(uid: string, id: string): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, 'users', uid),
    {
      activeClientSessionId: id,
      activeClientSessionAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function claimActiveClientSession(uid: string): Promise<string> {
  const id = crypto.randomUUID();
  setLocalClientSessionId(id);
  await writeActiveClientSession(uid, id);
  setClientSessionRole('primary');
  return id;
}

/** Host keepalive — call while the primary tab is open / active. */
let lastPrimaryTouchMs = 0;
export async function touchSharedPrimaryActivity(uid: string): Promise<void> {
  const local = getLocalClientSessionId();
  if (!local || !db) return;
  const role = getClientSessionRole();
  if (role !== 'primary') return;
  const now = Date.now();
  if (now - lastPrimaryTouchMs < PRIMARY_TOUCH_MIN_INTERVAL_MS) return;
  lastPrimaryTouchMs = now;
  try {
    await setDoc(
      doc(db, 'users', uid),
      { activeClientSessionAt: serverTimestamp() },
      { merge: true }
    );
  } catch {
    /* best-effort */
  }
}

/**
 * If the current host is idle (or gone), claim primary for this browser.
 * Returns the new role after the attempt.
 */
export async function tryClaimIdleSharedPrimary(uid: string): Promise<StoredClientRole> {
  const local = getLocalClientSessionId();
  if (!local || !db) return getClientSessionRole();

  const snap = await getDoc(doc(db, 'users', uid));
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  if (!isMultiLoginMode(data.loginMode)) return getClientSessionRole();

  const remote = data.activeClientSessionId;
  if (typeof remote === 'string' && remote === local) {
    setClientSessionRole('primary');
    return 'primary';
  }

  if (typeof remote === 'string' && remote.length > 0 && !(await isSharedPrimaryIdleAsync(uid, data))) {
    setClientSessionRole('viewer');
    return 'viewer';
  }

  await writeActiveClientSession(uid, local);
  setClientSessionRole('primary');
  lastPrimaryTouchMs = Date.now();
  return 'primary';
}

/** Register login — shared mode keeps existing primary unless idle; exclusive always claims. */
export async function registerClientSession(
  uid: string,
  loginMode?: LoginMode
): Promise<{ sessionId: string; role: ClientSessionRole }> {
  const id = crypto.randomUUID();
  setLocalClientSessionId(id);
  if (!db) return { sessionId: id, role: 'primary' };

  const snap = await getDoc(doc(db, 'users', uid));
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const mode = loginMode ?? parseLoginMode(data.loginMode);
  const remote = data.activeClientSessionId;

  if (
    isSingleActiveSessionEnabled() &&
    isMultiLoginMode(mode) &&
    typeof remote === 'string' &&
    remote.length > 0 &&
    remote !== id &&
    !(await isSharedPrimaryIdleAsync(uid, data))
  ) {
    setClientSessionRole('viewer');
    return { sessionId: id, role: 'viewer' };
  }

  await writeActiveClientSession(uid, id);
  setClientSessionRole('primary');
  lastPrimaryTouchMs = Date.now();
  return { sessionId: id, role: 'primary' };
}

/** Reconcile viewer vs primary after tab refresh (shared login mode). */
export async function syncClientSessionRole(uid: string): Promise<StoredClientRole> {
  const local = getLocalClientSessionId();
  if (!local || !db) return getClientSessionRole();

  const snap = await getDoc(doc(db, 'users', uid));
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const mode = parseLoginMode(data.loginMode);
  const remote = data.activeClientSessionId;

  if (!isSingleActiveSessionEnabled() || !isMultiLoginMode(mode)) {
    if (typeof remote === 'string' && remote === local) {
      setClientSessionRole('primary');
      return 'primary';
    }
    return getClientSessionRole();
  }

  if (typeof remote === 'string' && remote === local) {
    setClientSessionRole('primary');
    return 'primary';
  }

  if (typeof remote === 'string' && remote.length > 0 && !(await isSharedPrimaryIdleAsync(uid, data))) {
    // Preserve contributor if already granted a session on this browser
    const current = getClientSessionRole();
    if (current === 'contributor') return 'contributor';
    setClientSessionRole('viewer');
    return 'viewer';
  }

  // Host idle / missing → this tab becomes host
  await writeActiveClientSession(uid, local);
  setClientSessionRole('primary');
  lastPrimaryTouchMs = Date.now();
  return 'primary';
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
