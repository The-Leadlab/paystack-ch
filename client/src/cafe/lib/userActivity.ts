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

/** Metadata only — never document body / OCR / line items. */
export type UserActivityMeta = {
  errorCode?: DocumentProcessErrorCode | string;
  /** Short technical / user-facing error (truncated). */
  errorMessage?: string;
  fileName?: string;
  pageCount?: number;
  durationMs?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  sessionId?: string;
  pdfPageSplit?: boolean;
};

const LOGIN_SESSION_KEY = 'paystack_activity_login_logged';
const MAX_ERROR_MESSAGE = 280;
const MAX_FILE_NAME = 200;

type DailyBucketKey = 'logins' | 'sessionMinutes' | 'errors' | 'uploads' | 'processed';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailyField(day: string, field: DailyBucketKey): string {
  return `analytics.daily.${day}.${field}`;
}

function sanitizeMeta(meta?: UserActivityMeta): UserActivityMeta | null {
  if (!meta) return null;
  const out: UserActivityMeta = {};
  if (meta.errorCode) out.errorCode = String(meta.errorCode).slice(0, 80);
  if (meta.errorMessage) out.errorMessage = String(meta.errorMessage).slice(0, MAX_ERROR_MESSAGE);
  if (meta.fileName) out.fileName = String(meta.fileName).slice(0, MAX_FILE_NAME);
  if (typeof meta.pageCount === 'number' && Number.isFinite(meta.pageCount)) {
    out.pageCount = Math.max(0, Math.round(meta.pageCount));
  }
  if (typeof meta.durationMs === 'number' && Number.isFinite(meta.durationMs)) {
    out.durationMs = Math.max(0, Math.round(meta.durationMs));
  }
  if (typeof meta.fileSizeBytes === 'number' && Number.isFinite(meta.fileSizeBytes)) {
    out.fileSizeBytes = Math.max(0, Math.round(meta.fileSizeBytes));
  }
  if (meta.mimeType) out.mimeType = String(meta.mimeType).slice(0, 80);
  if (meta.sessionId) out.sessionId = String(meta.sessionId).slice(0, 80);
  if (typeof meta.pdfPageSplit === 'boolean') out.pdfPageSplit = meta.pdfPageSplit;
  return Object.keys(out).length ? out : null;
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
  meta?: UserActivityMeta
): Promise<void> {
  if (!db || !uid) return;
  const at = new Date().toISOString();
  const cleanMeta = sanitizeMeta(meta);
  try {
    await addDoc(collection(db, 'userActivity'), {
      uid,
      type,
      at,
      meta: cleanMeta,
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
  } else if (type === 'doc_processed') {
    patch[dailyField(day, 'processed')] = increment(1);
  } else if (type === 'document_process_error') {
    patch[dailyField(day, 'errors')] = increment(1);
  }

  try {
    await updateDoc(userRef, patch);
  } catch {
    try {
      await setDoc(userRef, { analytics: { lastActiveAt: serverTimestamp() } }, { merge: true });
      const field: DailyBucketKey =
        type === 'session_heartbeat'
          ? 'sessionMinutes'
          : type === 'login'
            ? 'logins'
            : type === 'doc_upload'
              ? 'uploads'
              : type === 'doc_processed'
                ? 'processed'
                : type === 'document_process_error'
                  ? 'errors'
                  : 'logins';
      await bumpDaily(uid, field, type === 'session_heartbeat' ? 5 : 1);
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
