/**
 * Billing calls POST /api/stripe/* (same origin on Vercel, or set VITE_API_BASE_URL to your Vercel app
 * when the SPA is hosted on Firebase Hosting). For cross-origin API, set STRIPE_CORS_ORIGIN on Vercel
 * to your SPA origin (e.g. https://paystack-ch.web.app).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

type UserBillingSnapshot = {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
};

type SubscriptionContextValue = {
  /** When true, app requires Stripe subscription in trialing or active state. */
  enforcementEnabled: boolean;
  loading: boolean;
  billing: UserBillingSnapshot | null;
  /** Access to dashboard modules (false → paywall). */
  inGoodStanding: boolean;
  startCheckout: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function parseBoolEnv(v: unknown): boolean {
  return String(v || '').toLowerCase() === 'true' || v === '1';
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const enforcementEnabled = parseBoolEnv(import.meta.env.VITE_SUBSCRIPTION_ENABLED);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<UserBillingSnapshot | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setBilling(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setBilling({ subscriptionStatus: 'none', trialEndsAt: null });
        } else {
          const d = snap.data() as Record<string, unknown>;
          const ts = d.trialEndsAt as { toDate?: () => Date } | undefined;
          setBilling({
            subscriptionStatus: typeof d.subscriptionStatus === 'string' ? d.subscriptionStatus : 'none',
            trialEndsAt: ts && typeof ts.toDate === 'function' ? ts.toDate() : null,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Subscription snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const inGoodStanding = useMemo(() => {
    if (!enforcementEnabled) return true;
    const st = billing?.subscriptionStatus;
    return st === 'trialing' || st === 'active';
  }, [enforcementEnabled, billing?.subscriptionStatus]);

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

  const startCheckout = useCallback(async () => {
    if (!user) throw new Error('Not signed in');
    const token = await user.getIdToken();
    const res = await fetch(`${apiBase}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    if (!data.url) throw new Error('No checkout URL returned');
    window.location.href = data.url;
  }, [user, apiBase]);

  const openCustomerPortal = useCallback(async () => {
    if (!user) throw new Error('Not signed in');
    const token = await user.getIdToken();
    const res = await fetch(`${apiBase}/api/stripe/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) throw new Error(data.error || 'Billing portal failed');
    if (!data.url) throw new Error('No portal URL returned');
    window.location.href = data.url;
  }, [user, apiBase]);

  const value: SubscriptionContextValue = {
    enforcementEnabled,
    loading,
    billing,
    inGoodStanding,
    startCheckout,
    openCustomerPortal,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
