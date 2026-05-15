import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';
import type { PaystackPlanId } from '@shared/planCatalog';
import { planMarketingFeatureKeys } from '@shared/planMarketingFeatureKeys';

function planDisplayName(id: PaystackPlanId | null, t: (k: string) => string): string {
  if (id === 'starter') return t('planStarterName');
  if (id === 'business') return t('planBusinessName');
  if (id === 'unlimited') return t('planUnlimitedName');
  if (id === 'enterprise') return t('planEnterpriseName');
  return t('planSummaryPlanUnknown');
}

function formatLimit(n: number | null, t: (k: string) => string): string {
  if (n === null) return t('planSummaryUnlimited');
  return String(n);
}

/**
 * Shown at the top of the dashboard when subscription enforcement is on and the user has access:
 * numeric caps from entitlements plus the same marketing feature lines as the landing pricing table.
 */
export function PlanEntitlementsBanner() {
  const { t } = useLanguage();
  const { enforcementEnabled, inGoodStanding, billing, entitlements, openCustomerPortal } = useSubscription();
  const [portalBusy, setPortalBusy] = useState(false);

  if (!enforcementEnabled || !inGoodStanding) return null;

  const planId = billing?.planId;
  const effectivePlan: PaystackPlanId = planId ?? 'starter';
  const status = billing?.subscriptionStatus;
  const statusLabel =
    status === 'trialing'
      ? t('planSummaryStatusTrialing')
      : status === 'active'
        ? t('planSummaryStatusActive')
        : status && status !== 'none'
          ? status
          : '';

  const rows: { label: string; value: string }[] = [
    { label: t('planSummaryDocuments'), value: formatLimit(entitlements.maxDocumentsPerMonth, t) },
    { label: t('planSummaryEmployees'), value: formatLimit(entitlements.maxEmployeeSlots, t) },
    { label: t('planSummarySessions'), value: formatLimit(entitlements.maxSessions, t) },
  ];

  const featureKeys = planMarketingFeatureKeys(effectivePlan);

  return (
    <div className="shrink-0 border-b border-cdlp-border bg-cdlp-card/80 backdrop-blur-sm px-3 py-3 sm:px-4">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-3 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">{t('planSummaryTitle')}</p>
            {statusLabel ? (
              <span className="text-[10px] font-bold uppercase tracking-tight text-cdlp-gold/90">{statusLabel}</span>
            ) : null}
          </div>
          <p className="text-sm font-black text-white tracking-tight">{planDisplayName(planId, t)}</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-cdlp-muted sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 sm:block">
                <dt className="font-bold text-cdlp-muted/90 shrink-0">{r.label}</dt>
                <dd className="text-white font-semibold tabular-nums sm:mt-0.5">{r.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted mb-2">{t('planSummaryIncludedTitle')}</p>
            <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-cdlp-muted leading-snug marker:text-cdlp-gold/80">
              {featureKeys.map((key) => (
                <li key={key} className="pl-0.5">
                  <span className="text-white/95">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          disabled={portalBusy}
          onClick={async () => {
            setPortalBusy(true);
            try {
              await openCustomerPortal();
            } catch {
              /* stay on page */
            } finally {
              setPortalBusy(false);
            }
          }}
          className="shrink-0 inline-flex items-center justify-center gap-2 self-start rounded-sm border border-cdlp-gold/50 bg-cdlp-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cdlp-gold hover:bg-cdlp-gold/20 disabled:opacity-50"
        >
          {portalBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
          {t('subscriptionManageBilling')}
        </button>
      </div>
    </div>
  );
}
