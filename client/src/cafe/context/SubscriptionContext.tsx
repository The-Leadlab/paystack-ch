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
  effectiveTeamSeats,
  entitlementsForPlan,
  parsePaystackPlanId,
  personalDocumentsLimit,
  type PaystackPlanId,
  type PlanEntitlements,
} from '@shared/planCatalog';
import { STRIPE_BILLING_PATH_LIVE, parseStripeFetchResponse } from '../lib/stripeCheckoutClient';
import { apiUrl } from '@/lib/apiBase';
import { useWorkspaceOptional } from './WorkspaceContext';

type UserBillingSnapshot = {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  planId: PaystackPlanId | null;
  stripeCustomerId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  personalAddonSeats: number;
  personalDocPack: boolean;
  appAdmin: boolean;
  /** Admin-granted beta / sandbox plan — no Stripe charge required. */
  planTestMode: boolean;
  /** Admin beta: force deep multi-page invoice extraction. */
  deepPdfInvoiceBeta: boolean;
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
  /** Personal statement uploads this calendar month. */
  personalDocumentsUsedThisMonth: number;
  /** Records one completed document against the current calendar month's durable usage count. */
  incrementDocumentUsage: () => Promise<void>;
  /** Records one personal statement/finance document upload for the month. */
  incrementPersonalDocumentUsage: () => Promise<void>;
  /** Ops sandbox: simulate starter / business / unlimited without Stripe. */
  isPlanTestUser: boolean;
  setPlanTestPlan: (planId: PaystackPlanId) => Promise<void>;
  startCheckout: (planId?: PaystackPlanId | null) => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  /** End trial immediately (no charge) or schedule cancel at period end for paid plans. */
  cancelSubscription: (opts?: { immediate?: boolean }) => Promise<{ canceled: string; wasTrialing: boolean }>;
  /** Personal plan: add paid seat (CHF 5) or activate doc pack (CHF 8 → 100 docs). */
  purchasePersonalAddon: (addon: 'seat' | 'doc_pack') => Promise<{ message: string; alreadyActive?: boolean }>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function parseBoolEnv(v: unknown): boolean {
  return String(v || '').toLowerCase() === 'true' || v === '1';
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const workspace = useWorkspaceOptional();
  const enforcementEnabled = parseBoolEnv(import.meta.env.VITE_SUBSCRIPTION_ENABLED);
  const planTest = useMemo(() => isPlanTestUser(user), [user]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<UserBillingSnapshot | null>(null);
  const [documentsUsedThisMonth, setDocumentsUsedThisMonth] = useState(0);
  const [personalDocumentsUsedThisMonth, setPersonalDocumentsUsedThisMonth] = useState(0);
  const bypass = useMemo(
    () => isSubscriptionOrVerificationBypassUser(user) || billing?.appAdmin === true,
    [user, billing?.appAdmin]
  );

  useEffect(() => {
    if (!user || !db) {
      setBilling(null);
      setDocumentsUsedThisMonth(0);
      setPersonalDocumentsUsedThisMonth(0);
      setLoading(false);
      return;
    }
    // Members inherit the owner's plan + usage; owners use their own profile.
    const profileUid =
      workspace && !workspace.loading && !workspace.isOwner && workspace.dataOwnerUid
        ? workspace.dataOwnerUid
        : user.uid;
    setLoading(true);
    const ref = doc(db, 'users', profileUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setBilling({
            subscriptionStatus: 'none',
            trialEndsAt: null,
            planId: null,
            stripeCustomerId: null,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            personalAddonSeats: 0,
            personalDocPack: false,
            appAdmin: false,
            planTestMode: false,
            deepPdfInvoiceBeta: false,
          });
          setDocumentsUsedThisMonth(0);
          setPersonalDocumentsUsedThisMonth(0);
        } else {
          const d = snap.data() as Record<string, unknown>;
          const ts = d.trialEndsAt as { toDate?: () => Date } | undefined;
          const periodTs = d.currentPeriodEnd as { toDate?: () => Date } | undefined;
          setBilling({
            subscriptionStatus: typeof d.subscriptionStatus === 'string' ? d.subscriptionStatus : 'none',
            trialEndsAt: ts && typeof ts.toDate === 'function' ? ts.toDate() : null,
            planId: parsePaystackPlanId(d.planId),
            stripeCustomerId:
              typeof d.stripeCustomerId === 'string' && d.stripeCustomerId.trim()
                ? d.stripeCustomerId.trim()
                : null,
            cancelAtPeriodEnd: d.cancelAtPeriodEnd === true,
            currentPeriodEnd:
              periodTs && typeof periodTs.toDate === 'function' ? periodTs.toDate() : null,
            personalAddonSeats:
              typeof d.personalAddonSeats === 'number' && Number.isFinite(d.personalAddonSeats)
                ? Math.max(0, Math.floor(d.personalAddonSeats))
                : 0,
            personalDocPack: d.personalDocPack === true,
            appAdmin: d.appAdmin === true,
            planTestMode: d.planTestMode === true,
            deepPdfInvoiceBeta: d.deepPdfInvoiceBeta === true,
          });
          const usage = d.usage as Record<string, unknown> | undefined;
          const month = currentMonthKey();
          const usedRaw = usage?.[month];
          setDocumentsUsedThisMonth(typeof usedRaw === 'number' && Number.isFinite(usedRaw) ? usedRaw : 0);
          const personalUsage = d.personalUsage as Record<string, unknown> | undefined;
          const personalRaw = personalUsage?.[month];
          setPersonalDocumentsUsedThisMonth(
            typeof personalRaw === 'number' && Number.isFinite(personalRaw) ? personalRaw : 0
          );
        }
        setLoading(false);
      },
      (err) => {
        console.error('Subscription snapshot error:', err);
        setBilling({
          subscriptionStatus: 'none',
          trialEndsAt: null,
          planId: null,
          stripeCustomerId: null,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          personalAddonSeats: 0,
          personalDocPack: false,
          appAdmin: false,
          planTestMode: false,
          deepPdfInvoiceBeta: false,
        });
        setDocumentsUsedThisMonth(0);
        setPersonalDocumentsUsedThisMonth(0);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user, workspace?.loading, workspace?.isOwner, workspace?.dataOwnerUid]);

  const incrementDocumentUsage = useCallback(async () => {
    if (!user || !db) return;
    // Only the owner can write usage on users/{uid}; members skip (caps still read from owner).
    if (workspace && !workspace.isOwner) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { usage: { [currentMonthKey()]: increment(1) } }, { merge: true });
  }, [user, workspace]);

  const incrementPersonalDocumentUsage = useCallback(async () => {
    if (!user || !db) return;
    if (workspace && !workspace.isOwner) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { personalUsage: { [currentMonthKey()]: increment(1) } }, { merge: true });
  }, [user, workspace]);

  const inGoodStanding = useMemo(() => {
    if (bypass) return true;
    if (!enforcementEnabled) return true;
    // Invited teammates share the owner's paid/trial workspace
    if (workspace && !workspace.loading && !workspace.isOwner && workspace.dataOwnerUid) {
      return true;
    }
    // Admin-granted beta / plan test mode (subscriptionStatus is intentionally "none")
    if (billing?.planTestMode === true) return true;
    const st = billing?.subscriptionStatus;
    return st === 'trialing' || st === 'active';
  }, [bypass, enforcementEnabled, billing?.subscriptionStatus, billing?.planTestMode, workspace]);

  const entitlements = useMemo((): PlanEntitlements => {
    if (!enforcementEnabled) return UNRESTRICTED_ENTITLEMENTS;
    if (planTest || billing?.planTestMode === true) {
      return entitlementsForPlan(billing?.planId ?? 'starter');
    }
    if (bypass) return UNRESTRICTED_ENTITLEMENTS;
    const base = entitlementsForPlan(billing?.planId ?? undefined);
    const seats = effectiveTeamSeats(billing?.planId, billing?.personalAddonSeats ?? 0);
    const personalDocs = personalDocumentsLimit({
      docPackActive: billing?.personalDocPack === true,
      planId: billing?.planId,
    });
    return {
      ...base,
      maxTeamSeats: seats,
      maxPersonalDocumentsPerMonth: personalDocs ?? base.maxPersonalDocumentsPerMonth,
    };
  }, [
    enforcementEnabled,
    planTest,
    bypass,
    billing?.planId,
    billing?.planTestMode,
    billing?.personalAddonSeats,
    billing?.personalDocPack,
  ]);

  const setPlanTestPlan = useCallback(
    async (planId: PaystackPlanId) => {
      if (!user) throw new Error('Not signed in');
      if (!planTest && billing?.planTestMode !== true) {
        throw new Error('Plan test mode is not enabled for this account');
      }
      await applyPlanTestSelection(user.uid, planId);
    },
    [user, planTest, billing?.planTestMode]
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

  const cancelSubscription = useCallback(
    async (opts?: { immediate?: boolean }) => {
      if (!user) throw new Error('Not signed in');
      const token = await user.getIdToken();
      const billingPath = STRIPE_BILLING_PATH_LIVE;
      const res = await fetch(apiUrl(`${billingPath}/cancel-subscription`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ immediate: opts?.immediate === true }),
      });
      const { json, errorMessage } = await parseStripeFetchResponse(res);
      if (!json) throw new Error(errorMessage || 'Cancel failed');
      if (!res.ok) throw new Error(errorMessage || 'Cancel failed');
      return {
        canceled: typeof json.canceled === 'string' ? json.canceled : 'immediate',
        wasTrialing: json.wasTrialing === true,
      };
    },
    [user]
  );

  const purchasePersonalAddon = useCallback(
    async (addon: 'seat' | 'doc_pack') => {
      if (!user) throw new Error('Not signed in');
      const token = await user.getIdToken();
      const billingPath = STRIPE_BILLING_PATH_LIVE;
      const res = await fetch(apiUrl(`${billingPath}/personal-addon`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ addon }),
      });
      const { json, errorMessage } = await parseStripeFetchResponse(res);
      if (!json) throw new Error(errorMessage || 'Addon purchase failed');
      if (!res.ok) throw new Error(errorMessage || 'Addon purchase failed');
      return {
        message: typeof json.message === 'string' ? json.message : 'Addon updated',
        alreadyActive: json.alreadyActive === true,
      };
    },
    [user]
  );

  const value: SubscriptionContextValue = {
    enforcementEnabled,
    loading,
    billing,
    inGoodStanding,
    entitlements,
    documentsUsedThisMonth,
    personalDocumentsUsedThisMonth,
    incrementDocumentUsage,
    incrementPersonalDocumentUsage,
    isPlanTestUser: planTest || billing?.planTestMode === true,
    setPlanTestPlan,
    startCheckout,
    openCustomerPortal,
    cancelSubscription,
    purchasePersonalAddon,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
