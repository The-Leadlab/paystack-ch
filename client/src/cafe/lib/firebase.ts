import { initializeApp, type FirebaseApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import {
  initializeAuth,
  getAuth,
  getRedirectResult,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/** Use when surfacing Firestore permission errors — must match Firebase Console project for deployed rules. */
export const firebaseProjectId = firebaseConfig.projectId as string | undefined;

export const firebaseReady = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

if (!firebaseReady) {
  console.warn(
    'Missing Firebase env vars. Add VITE_FIREBASE_* to .env.local (local) or Netlify Site settings → Environment variables (production). See .env.example.'
  );
}

let app: FirebaseApp | undefined;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let storage: FirebaseStorage | null = null;
export let analytics: Analytics | null = null;

/**
 * Firebase Auth popup/redirect iframe sometimes delivers a stale event with no pending
 * promise → "INTERNAL ASSERTION FAILED: Pending promise was never set".
 * Swallow only that specific uncaught rejection so document processing / session stay alive.
 */
function installAuthAssertionGuard(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __paystackAuthAssertionGuard?: boolean };
  if (w.__paystackAuthAssertionGuard) return;
  w.__paystackAuthAssertionGuard = true;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | string | undefined;
    const msg = typeof reason === 'string' ? reason : String(reason?.message || '');
    if (msg.includes('Pending promise was never set')) {
      event.preventDefault();
      console.warn(
        '⚠️ Suppressed stale Firebase Auth popup/redirect event (Pending promise was never set). Session kept.'
      );
    }
  });
}

/**
 * Firebase Analytics pulls gtag (`googletagmanager.com/gtag/js?id=G-…`) and competes with React on /app.
 * Load only after `window.load`, then in idle time (long timeout), via dynamic import so it is not in the main chunk.
 */
function scheduleFirebaseAnalytics(appInstance: FirebaseApp): void {
  if (typeof window === 'undefined') return;
  if (!firebaseConfig.measurementId) return;

  const run = () => {
    void import('firebase/analytics')
      .then(({ getAnalytics, isSupported }) =>
        isSupported().then((supported) => {
          if (supported) analytics = getAnalytics(appInstance);
        })
      )
      .catch(() => {
        analytics = null;
      });
  };

  window.addEventListener(
    'load',
    () => {
      const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
        .requestIdleCallback;
      if (typeof ric === 'function') {
        ric(run, { timeout: 10_000 });
      } else {
        window.setTimeout(run, 5000);
      }
    },
    { once: true }
  );
}

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  installAuthAssertionGuard();

  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Hot reload / duplicate init — fall back to existing Auth instance.
    auth = getAuth(app);
  }

  db = getFirestore(app);
  storage = getStorage(app);
  scheduleFirebaseAnalytics(app);

  // Consume leftover redirect/popup auth events so onAuthEvent does not assert later.
  if (typeof window !== 'undefined' && auth) {
    void getRedirectResult(auth).catch(() => undefined);
  }
}
