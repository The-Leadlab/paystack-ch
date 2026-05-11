import React, { useState } from 'react';
import { CreditCard, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * When VITE_SUBSCRIPTION_ENABLED=true, blocks the dashboard until Stripe subscription is trialing or active.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { enforcementEnabled, loading, billing, inGoodStanding, startCheckout, openCustomerPortal } =
    useSubscription();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const st = billing?.subscriptionStatus;
  const needsPaymentMethodFix = st === 'past_due' || st === 'unpaid';

  if (!enforcementEnabled) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cdlp-dark flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-cdlp-gold animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">{t('subscriptionLoading')}</p>
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

  return (
    <div className="min-h-screen bg-cdlp-dark flex items-center justify-center p-6">
      <div className="max-w-md w-full border border-cdlp-border rounded-lg bg-cdlp-card p-8 shadow-card text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-cdlp-gold/15 flex items-center justify-center border border-cdlp-gold/40">
          <CreditCard className="w-7 h-7 text-cdlp-gold" />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-white mb-2">{t('subscriptionTitle')}</h1>
          <p className="text-xs text-cdlp-muted leading-relaxed">{t('subscriptionBody')}</p>
          {trialHint ? <p className="text-[10px] text-cdlp-gold/90 mt-3 font-bold uppercase tracking-tight">{trialHint}</p> : null}
        </div>
        {err ? (
          <div className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
            {err}
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                if (needsPaymentMethodFix) await openCustomerPortal();
                else await startCheckout();
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
            className="w-full h-12 rounded-sm bg-cdlp-gold text-cdlp-black font-black text-xs uppercase tracking-wider hover:bg-cdlp-gold-light disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {needsPaymentMethodFix ? t('subscriptionUpdatePayment') : t('subscriptionCta')}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full h-10 rounded-sm border border-cdlp-border text-[10px] font-bold uppercase text-cdlp-muted hover:text-white flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
