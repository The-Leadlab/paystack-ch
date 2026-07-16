import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, firebaseReady } from '../lib/firebase';
import { emailVerificationActionCodeSettings } from '../lib/firebaseEmailAction';
import {
  AUTH_ERR_REGISTRATION_CLOSED,
  type AuthAccessOptions,
  checkPublicAuthAccess,
  isPaidRegistrationEnforced,
} from '../lib/authAccess';

async function ensureUserBillingStub(firebaseUser: FirebaseUser): Promise<void> {
  if (!db) return;
  try {
    const ref = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      if (!Object.prototype.hasOwnProperty.call(snap.data(), 'taxRegion')) {
        await setDoc(ref, { taxRegion: 'ch' }, { merge: true });
      }
      return;
    }
    await setDoc(
      ref,
      {
        subscriptionStatus: 'none',
        email: firebaseUser.email ?? '',
        taxRegion: 'ch',
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not create users/{uid} billing stub:', err);
  }
}

type AuthContextValue = {
  user: FirebaseUser | null;
  session: null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (
    options?: AuthAccessOptions & { allowNewUserFromCheckout?: boolean }
  ) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    username?: string,
    options?: { allowFromCheckout?: boolean }
  ) => Promise<{ error: Error | null }>;
  resendVerificationEmail: () => Promise<{ error: Error | null }>;
  /** Reload Firebase user (e.g. after clicking the verification link). */
  refreshAuthUser: () => Promise<{ emailVerified: boolean }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Fallback: if onAuthStateChanged never fires (e.g. domain not authorized),
    // stop the loading spinner after 8 seconds.
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn('Firebase Auth timed out — check authorized domains in Firebase Console.');
        return false;
      });
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser ?? null);
      setLoading(false);
      if (firebaseUser) void ensureUserBillingStub(firebaseUser);
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) {
      return { error: new Error('Firebase is not configured.') };
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    username?: string,
    options?: { allowFromCheckout?: boolean }
  ) => {
    if (!auth) {
      return { error: new Error('Firebase is not configured.') };
    }
    if (isPaidRegistrationEnforced() && !options?.allowFromCheckout) {
      return { error: new Error(AUTH_ERR_REGISTRATION_CLOSED) };
    }
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = username?.trim();
      if (displayName) {
        await updateProfile(newUser, { displayName });
      }
      await sendEmailVerification(newUser, emailVerificationActionCodeSettings());
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signInWithGoogle = async (
    options?: AuthAccessOptions & { allowNewUserFromCheckout?: boolean }
  ) => {
    if (!auth) return { error: new Error('Firebase is not configured.') };
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const info = getAdditionalUserInfo(result);
      const denied = checkPublicAuthAccess(result.user, {
        isNewUser: info?.isNewUser === true,
        allowNewUserFromCheckout: options?.allowNewUserFromCheckout,
        skipRegistrationGate: options?.skipRegistrationGate,
      });
      if (denied) {
        await firebaseSignOut(auth);
        return { error: new Error(denied) };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth) return { error: new Error('Firebase is not configured.') };
    const user = auth.currentUser;
    if (!user) return { error: new Error('Not signed in.') };
    try {
      await sendEmailVerification(user, emailVerificationActionCodeSettings());
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const refreshAuthUser = async () => {
    if (!auth?.currentUser) {
      return { emailVerified: false };
    }
    await auth.currentUser.reload();
    const verified = auth.currentUser.emailVerified;
    // Force React to re-read emailVerified (reload mutates the same User reference).
    setUser(null);
    setUser(auth.currentUser);
    return { emailVerified: verified };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth?.currentUser?.email) {
      return { error: new Error('Not signed in with email and password.') };
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async () => {
    if (auth) await firebaseSignOut(auth);
  };

  const value: AuthContextValue = {
    user,
    session: null,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    resendVerificationEmail,
    refreshAuthUser,
    changePassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
