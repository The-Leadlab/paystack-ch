/**
 * Billing POSTs to `/api/stripe/*` (live keys). Same origin on Vercel, or set VITE_API_BASE_URL when the SPA
 * is hosted separately. Set STRIPE_CORS_ORIGIN on the API for cross-origin browser calls.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isSubscriptionOrVerificationBypassUser } from '../lib/subscriptionBypass';
import { useAuth } from './AuthContext';
import {
  SELECTED_PLAN_STORAGE_KEY,
  UNRESTRICTED_ENTITLEMENTS,
  entitlementsForPlan,
  parsePaystackPlanId,
  type PaystackPlanId,
  type PlanEntitlements,
} from '@shared/planCatalog';
import { parseStripeFetchResponse } from '../lib/stripeCheckoutClient';
import { apiUrl } from '@/lib/apiBase';

const STRIPE_API_PATH = '/api/stripe';

type UserBillingSnapshot = {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  planId: PaystackPlanId | null;
};

type SubscriptionContextValue = {
  /** When true, app requires Stripe subscription in trialing or active state. */
  enforcementEnabled: boolean;
  loading: boolean;
  billing: UserBillingSnapshot | null;
  /** Access to dashboard modules (false → paywall). */
  inGoodStanding: boolean;
  /** Effective limits and feature flags for the current plan (unrestricted when enforcement is off). */
  entitlements: PlanEntitlements;
  startCheckout: (planId?: PaystackPlanId | null) => Promise<void>;
  openCustomerPortal: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function parseBoolEnv(v: unknown): boolean {
  return String(v || '').toLowerCase() === 'true' || v === '1';
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const enforcementEnabled = parseBoolEnv(import.meta.env.VITE_SUBSCRIPTION_ENABLED);
  const bypass = useMemo(() => isSubscriptionOrVerificationBypassUser(user), [user]);
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
          setBilling({ subscriptionStatus: 'none', trialEndsAt: null, planId: null });
        } else {
          const d = snap.data() as Record<string, unknown>;
          const ts = d.trialEndsAt as { toDate?: () => Date } | undefined;
          setBilling({
            subscriptionStatus: typeof d.subscriptionStatus === 'string' ? d.subscriptionStatus : 'none',
            trialEndsAt: ts && typeof ts.toDate === 'function' ? ts.toDate() : null,
            planId: parsePaystackPlanId(d.planId),
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Subscription snapshot error:', err);
        setBilling({ subscriptionStatus: 'none', trialEndsAt: null, planId: null });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const inGoodStanding = useMemo(() => {
    if (bypass) return true;
    if (!enforcementEnabled) return true;
    const st = billing?.subscriptionStatus;
    return st === 'trialing' || st === 'active';
  }, [bypass, enforcementEnabled, billing?.subscriptionStatus]);

  const entitlements = useMemo(() => {
    if (!enforcementEnabled) return UNRESTRICTED_ENTITLEMENTS;
    if (bypass) return UNRESTRICTED_ENTITLEMENTS;
    return entitlementsForPlan(billing?.planId ?? undefined);
  }, [enforcementEnabled, bypass, billing?.planId]);

  const startCheckout = useCallback(
    async (planIdArg?: PaystackPlanId | null) => {
      if (!user) throw new Error('Not signed in');
      const fromStorage =
        typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SELECTED_PLAN_STORAGE_KEY) : null;
      const resolved = planIdArg ?? parsePaystackPlanId(fromStorage);
      const token = await user.getIdToken();
      const res = await fetch(apiUrl(`${STRIPE_API_PATH}/create-checkout-session`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: resolved ?? undefined }),
      });
      const { json, errorMessage } = await parseStripeFetchResponse(res);
      if (!json) throw new Error(errorMessage || 'Checkout failed');
      if (!res.ok) throw new Error(errorMessage || 'Checkout failed');
      const url = json.url;
      if (typeof url !== 'string' || !url) {
        throw new Error(typeof json.error === 'string' ? json.error : 'No checkout URL returned');
      }
      window.location.href = url;
    },
    [user]
  );

  const openCustomerPortal = useCallback(async () => {
    if (!user) throw new Error('Not signed in');
    const token = await user.getIdToken();
    const res = await fetch(apiUrl(`${STRIPE_API_PATH}/create-portal-session`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });
    const { json, errorMessage } = await parseStripeFetchResponse(res);
    if (!json) throw new Error(errorMessage || 'Billing portal failed');
    if (!res.ok) throw new Error(errorMessage || 'Billing portal failed');
    const url = json.url;
    if (typeof url !== 'string' || !url) {
      throw new Error(typeof json.error === 'string' ? json.error : 'No portal URL returned');
    }
    window.location.href = url;
  }, [user]);

  const value: SubscriptionContextValue = {
    enforcementEnabled,
    loading,
    billing,
    inGoodStanding,
    entitlements,
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
