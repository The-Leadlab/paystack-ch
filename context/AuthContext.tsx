import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, firebaseReady } from '../lib/firebase';

type AuthContextValue = {
  user: FirebaseUser | null;
  session: null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  resendVerificationEmail: () => Promise<{ error: Error | null }>;
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

  const signUp = async (email: string, password: string, username?: string) => {
    if (!auth) {
      return { error: new Error('Firebase is not configured.') };
    }
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = username?.trim();
      if (displayName) {
        await updateProfile(newUser, { displayName });
      }
      await sendEmailVerification(newUser);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) return { error: new Error('Firebase is not configured.') };
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
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
      await sendEmailVerification(user);
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
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
