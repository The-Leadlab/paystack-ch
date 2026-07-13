import React, { useEffect, useState } from 'react';
import { CreditCard, Home, Loader2, LogOut } from 'lucide-react';
import { useSearch } from 'wouter';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';
import { SELECTED_PLAN_STORAGE_KEY, parsePaystackPlanId, type PaystackPlanId } from '@shared/planCatalog';
import { PlanMarketingPanel, PLAN_ENTERPRISE_SALES_MAILTO } from './PlanMarketingPanel';
import { productionSiteHomeUrl } from '../lib/firebaseEmailAction';

/**
 * When VITE_SUBSCRIPTION_ENABLED=true, blocks the dashboard until Stripe subscription is trialing or active.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const search = useSearch();
  const { enforcementEnabled, loading, billing, inGoodStanding, startCheckout, openCustomerPortal } =
    useSubscription();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activating, setActivating] = useState(() => {
    const qs = search.startsWith('?') ? search.slice(1) : search;
    return new URLSearchParams(qs).get('subscription') === 'success';
  });
  const [chosenPlan, setChosenPlan] = useState<PaystackPlanId | null>(() => {
    if (typeof sessionStorage === 'undefined') return 'starter';
    const raw = sessionStorage.getItem(SELECTED_PLAN_STORAGE_KEY);
    const p = parsePaystackPlanId(raw);
    if (p && p !== 'enterprise') return p;
    return 'starter';
  });
  const st = billing?.subscriptionStatus;
  const needsPaymentMethodFix = st === 'past_due' || st === 'unpaid';

  useEffect(() => {
    if (!activating) return;
    if (inGoodStanding) {
      setActivating(false);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('subscription');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [activating, inGoodStanding]);

  const selectPlan = (id: PaystackPlanId) => {
    if (typeof sessionStorage !== 'undefined') {
      if (id === 'enterprise') sessionStorage.removeItem(SELECTED_PLAN_STORAGE_KEY);
      else sessionStorage.setItem(SELECTED_PLAN_STORAGE_KEY, id);
    }
    setChosenPlan(id);
  };

  if (!enforcementEnabled) {
    return <>{children}</>;
  }

  if (loading || (activating && !inGoodStanding)) {
    return (
      <div className="min-h-[100dvh] min-h-screen bg-cdlp-dark flex flex-col items-center justify-center gap-4 px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Loader2 className="w-10 h-10 text-cdlp-gold animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">
          {activating ? t('subscriptionActivating') : t('subscriptionLoading')}
        </p>
      </div>
    );
  }

  if (inGoodStanding) {
    return <>{children}</>;
  }

  const trialHint =
    billing?.trialEndsAt != null
      ? t('subscriptionTrialUntil').replace('{date}', billing.trialEndsAt.toLocaleDateString())
      : '';

  const planLabel = (id: PaystackPlanId) => {
    if (id === 'starter') return t('planStarterName');
    if (id === 'business') return t('planBusinessName');
    if (id === 'unlimited') return t('planUnlimitedName');
    return t('planEnterpriseName');
  };

  const showPlanPicker = !needsPaymentMethodFix;

  return (
    <div className="min-h-[100dvh] min-h-screen bg-cdlp-dark flex items-center justify-center px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] touch-manipulation">
      <div className="max-w-xl w-full border border-cdlp-border rounded-xl bg-cdlp-card p-6 sm:p-8 shadow-card text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-cdlp-gold/15 flex items-center justify-center border border-cdlp-gold/40">
          <CreditCard className="w-7 h-7 text-cdlp-gold" />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-white mb-2">{t('subscriptionTitle')}</h1>
          <p className="text-xs text-cdlp-muted leading-relaxed">{t('subscriptionBody')}</p>
          {trialHint ? <p className="text-[10px] text-cdlp-gold/90 mt-3 font-bold uppercase tracking-tight">{trialHint}</p> : null}
        </div>

        {showPlanPicker ? (
          <div className="text-left space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">{t('subscriptionPickPlan')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['starter', 'business', 'unlimited', 'enterprise'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectPlan(id)}
                  className={`rounded border px-2 py-3 text-[10px] font-black uppercase tracking-tight transition-colors ${
                    chosenPlan === id
                      ? 'border-cdlp-gold bg-cdlp-gold/15 text-white'
                      : 'border-cdlp-border text-cdlp-muted hover:border-cdlp-gold/50 hover:text-white'
                  }`}
                >
                  {planLabel(id)}
                </button>
              ))}
            </div>
            {chosenPlan ? (
              <PlanMarketingPanel planId={chosenPlan} variant="cdlp" showMostPopularBadge />
            ) : null}
          </div>
        ) : null}

        {err ? (
          <div className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
            {err}
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy || (showPlanPicker && !chosenPlan)}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                if (needsPaymentMethodFix) await openCustomerPortal();
                else {
                  if (!chosenPlan) {
                    setErr(t('subscriptionPickPlanError'));
                    return;
                  }
                  if (chosenPlan === 'enterprise') {
                    window.location.href = PLAN_ENTERPRISE_SALES_MAILTO;
                    return;
                  }
                  await startCheckout(chosenPlan);
                }
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
            className="w-full h-12 rounded-sm bg-cdlp-gold text-cdlp-black font-black text-xs uppercase tracking-wider hover:bg-cdlp-gold-light disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {needsPaymentMethodFix
              ? t('subscriptionUpdatePayment')
              : chosenPlan === 'enterprise'
                ? t('ctaContactSales')
                : t('subscriptionCta')}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full h-10 rounded-sm border border-cdlp-border text-[10px] font-bold uppercase text-cdlp-muted hover:text-white flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout')}
          </button>
          <a
            href={productionSiteHomeUrl()}
            className="w-full h-10 rounded-sm border border-cdlp-border text-[10px] font-bold uppercase text-cdlp-muted hover:text-white flex items-center justify-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            {t('authActionGoHome')}
          </a>
        </div>
      </div>
    </div>
  );
}
