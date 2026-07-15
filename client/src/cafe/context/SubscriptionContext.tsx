/**
 * Billing POSTs to `/api/stripe/*` (live). Sandbox checkout is admin-only via `/admin` operator tools.
 * Same origin on Vercel, or set VITE_API_BASE_URL when the SPA is hosted separately.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isPlanTestUser, isSubscriptionOrVerificationBypassUser } from '../lib/subscriptionBypass';
import { applyPlanTestSelection } from '../lib/planTestSelection';
import { useAuth } from './AuthContext';
import {
  SELECTED_PLAN_STORAGE_KEY,
  UNRESTRICTED_ENTITLEMENTS,
  currentMonthKey,
  entitlementsForPlan,
  parsePaystackPlanId,
  type PaystackPlanId,
  type PlanEntitlements,
} from '@shared/planCatalog';
import { STRIPE_BILLING_PATH_LIVE, parseStripeFetchResponse } from '../lib/stripeCheckoutClient';
import { apiUrl } from '@/lib/apiBase';

type UserBillingSnapshot = {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  planId: PaystackPlanId | null;
  stripeCustomerId: string | null;
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
  /** Documents completed this calendar month, account-wide — survives new sessions and document deletion. */
  documentsUsedThisMonth: number;
  /** Records one completed document against the current calendar month's durable usage count. */
  incrementDocumentUsage: () => Promise<void>;
  /** Ops sandbox: simulate starter / business / unlimited without Stripe. */
  isPlanTestUser: boolean;
  setPlanTestPlan: (planId: PaystackPlanId) => Promise<void>;
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
  const planTest = useMemo(() => isPlanTestUser(user), [user]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<UserBillingSnapshot | null>(null);
  const [documentsUsedThisMonth, setDocumentsUsedThisMonth] = useState(0);

  useEffect(() => {
    if (!user || !db) {
      setBilling(null);
      setDocumentsUsedThisMonth(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setBilling({ subscriptionStatus: 'none', trialEndsAt: null, planId: null, stripeCustomerId: null });
          setDocumentsUsedThisMonth(0);
        } else {
          const d = snap.data() as Record<string, unknown>;
          const ts = d.trialEndsAt as { toDate?: () => Date } | undefined;
          setBilling({
            subscriptionStatus: typeof d.subscriptionStatus === 'string' ? d.subscriptionStatus : 'none',
            trialEndsAt: ts && typeof ts.toDate === 'function' ? ts.toDate() : null,
            planId: parsePaystackPlanId(d.planId),
            stripeCustomerId:
              typeof d.stripeCustomerId === 'string' && d.stripeCustomerId.trim()
                ? d.stripeCustomerId.trim()
                : null,
          });
          const usage = d.usage as Record<string, unknown> | undefined;
          const usedRaw = usage?.[currentMonthKey()];
          setDocumentsUsedThisMonth(typeof usedRaw === 'number' && Number.isFinite(usedRaw) ? usedRaw : 0);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Subscription snapshot error:', err);
        setBilling({ subscriptionStatus: 'none', trialEndsAt: null, planId: null, stripeCustomerId: null });
        setDocumentsUsedThisMonth(0);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const incrementDocumentUsage = useCallback(async () => {
    if (!user || !db) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { usage: { [currentMonthKey()]: increment(1) } }, { merge: true });
  }, [user]);

  const inGoodStanding = useMemo(() => {
    if (bypass) return true;
    if (!enforcementEnabled) return true;
    const st = billing?.subscriptionStatus;
    return st === 'trialing' || st === 'active';
  }, [bypass, enforcementEnabled, billing?.subscriptionStatus]);

  const entitlements = useMemo(() => {
    if (!enforcementEnabled) return UNRESTRICTED_ENTITLEMENTS;
    if (planTest) return entitlementsForPlan(billing?.planId ?? 'starter');
    if (bypass) return UNRESTRICTED_ENTITLEMENTS;
    return entitlementsForPlan(billing?.planId ?? undefined);
  }, [enforcementEnabled, planTest, bypass, billing?.planId]);

  const setPlanTestPlan = useCallback(
    async (planId: PaystackPlanId) => {
      if (!user) throw new Error('Not signed in');
      if (!planTest) throw new Error('Plan test mode is not enabled for this account');
      await applyPlanTestSelection(user.uid, planId);
    },
    [user, planTest]
  );

  const startCheckout = useCallback(
    async (planIdArg?: PaystackPlanId | null) => {
      if (!user) throw new Error('Not signed in');
      const fromStorage =
        typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SELECTED_PLAN_STORAGE_KEY) : null;
      const resolved = planIdArg ?? parsePaystackPlanId(fromStorage);
      const token = await user.getIdToken();
      const billingPath = STRIPE_BILLING_PATH_LIVE;
      const res = await fetch(apiUrl(`${billingPath}/create-checkout-session`), {
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
    const billingPath = STRIPE_BILLING_PATH_LIVE;
    const stripeCustomerId = billing?.stripeCustomerId;
    const res = await fetch(apiUrl(`${billingPath}/create-portal-session`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        stripeCustomerId ? { stripeCustomerId } : {}
      ),
    });
    const { json, errorMessage } = await parseStripeFetchResponse(res);
    if (!json) throw new Error(errorMessage || 'Billing portal failed');
    if (!res.ok) throw new Error(errorMessage || 'Billing portal failed');
    const url = json.url;
    if (typeof url !== 'string' || !url) {
      throw new Error(typeof json.error === 'string' ? json.error : 'No portal URL returned');
    }
    window.location.href = url;
  }, [user, billing?.stripeCustomerId]);

  const value: SubscriptionContextValue = {
    enforcementEnabled,
    loading,
    billing,
    inGoodStanding,
    entitlements,
    documentsUsedThisMonth,
    incrementDocumentUsage,
    isPlanTestUser: planTest,
    setPlanTestPlan,
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
