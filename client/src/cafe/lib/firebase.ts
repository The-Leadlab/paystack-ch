import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyCNC-pw5NpEqQxVaOQsrJyXkQDoprqOj4M',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'paystack-ch.web.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'paystack-ch',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'paystack-ch.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '18248522501',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:18248522501:web:c1fcbf056563db501f356c',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-GQBZ7DCL1G',
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
