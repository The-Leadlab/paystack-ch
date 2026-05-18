import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
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

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Analytics works only in browser environments and when supported.
  if (typeof window !== 'undefined') {
    isSupported()
      .then((supported) => {
        if (supported && app) analytics = getAnalytics(app);
      })
      .catch(() => {
        analytics = null;
      });
  }
}
