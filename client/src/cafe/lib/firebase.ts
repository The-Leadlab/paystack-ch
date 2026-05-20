import { initializeApp, type FirebaseApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
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
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run, { timeout: 10_000 });
      } else {
        window.setTimeout(run, 5000);
      }
    },
    { once: true }
  );
}

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  scheduleFirebaseAnalytics(app);
}
