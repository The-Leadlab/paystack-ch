import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyCTo9cQ0Xa4690GQpPDWZ_oskZu9S41M6I',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'cafe-la-place.web.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'cafe-la-place',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'cafe-la-place.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '212199909940',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:212199909940:web:dddac3b3ab42dd23103861',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-0BP43Y28RN',
};

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
export let analytics: Analytics | null = null;

if (firebaseReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

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
