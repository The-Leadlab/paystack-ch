import {
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DocumentProcessErrorCode } from './documentProcessError';

export type UserActivityType =
  | 'login'
  | 'logout'
  | 'session_heartbeat'
  | 'doc_upload'
  | 'doc_processed'
  | 'document_process_error';

const LOGIN_SESSION_KEY = 'paystack_activity_login_logged';

type DailyBucketKey = 'logins' | 'sessionMinutes' | 'errors' | 'uploads';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailyField(day: string, field: DailyBucketKey): string {
  return `analytics.daily.${day}.${field}`;
}

async function bumpDaily(uid: string, field: DailyBucketKey, amount = 1): Promise<void> {
  if (!db) return;
  const day = todayKey();
  try {
    await updateDoc(doc(db, 'users', uid), {
      [dailyField(day, field)]: increment(amount),
      'analytics.lastActiveAt': serverTimestamp(),
    });
  } catch {
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          analytics: {
            daily: { [day]: { [field]: amount } },
            lastActiveAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
    } catch {
      /* non-fatal telemetry */
    }
  }
}

export async function logUserActivity(
  uid: string,
  type: UserActivityType,
  meta?: { errorCode?: DocumentProcessErrorCode | string; fileName?: string }
): Promise<void> {
  if (!db || !uid) return;
  const at = new Date().toISOString();
  try {
    await addDoc(collection(db, 'userActivity'), {
      uid,
      type,
      at,
      meta: meta ?? null,
    });
  } catch {
    /* event log is best-effort */
  }

  const userRef = doc(db, 'users', uid);
  const day = todayKey();
  const patch: Record<string, unknown> = {
    'analytics.lastActiveAt': serverTimestamp(),
  };

  if (type === 'login') {
    patch['analytics.lastLoginAt'] = at;
    patch[dailyField(day, 'logins')] = increment(1);
  } else if (type === 'session_heartbeat') {
    patch[dailyField(day, 'sessionMinutes')] = increment(5);
  } else if (type === 'doc_upload') {
    patch[dailyField(day, 'uploads')] = increment(1);
  } else if (type === 'document_process_error') {
    patch[dailyField(day, 'errors')] = increment(1);
  }

  try {
    await updateDoc(userRef, patch);
  } catch {
    try {
      await setDoc(userRef, { analytics: { lastActiveAt: serverTimestamp() } }, { merge: true });
      await bumpDaily(uid, type === 'session_heartbeat' ? 'sessionMinutes' : type === 'login' ? 'logins' : type === 'doc_upload' ? 'uploads' : type === 'document_process_error' ? 'errors' : 'logins', type === 'session_heartbeat' ? 5 : 1);
    } catch {
      /* ignore */
    }
  }
}

/** Once per browser session after auth. */
export function logLoginActivityOnce(uid: string): void {
  try {
    if (sessionStorage.getItem(LOGIN_SESSION_KEY) === uid) return;
    sessionStorage.setItem(LOGIN_SESSION_KEY, uid);
  } catch {
    /* continue */
  }
  void logUserActivity(uid, 'login');
}

export function clearLoginActivitySessionFlag(): void {
  try {
    sessionStorage.removeItem(LOGIN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
