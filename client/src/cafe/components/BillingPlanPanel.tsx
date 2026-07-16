import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, KeyRound, Loader2, ArrowUpCircle, XCircle } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';
import type { PaystackPlanId } from '@shared/planCatalog';
import { parseTaxRegion, type TaxRegion } from '@shared/taxRegions';
import { PlanMarketingFeatureBullets, PlanMarketingPanel, PLAN_ENTERPRISE_SALES_MAILTO } from './PlanMarketingPanel';
import { GoogleDriveConnectPanel } from './GoogleDriveConnectPanel';
import { db } from '../lib/firebase';

function planDisplayName(id: PaystackPlanId | null | undefined, t: (k: string) => string): string {
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

const UPGRADE_PLANS: PaystackPlanId[] = ['starter', 'business', 'unlimited', 'enterprise'];

export function BillingPlanPanel({ onDriveSync }: { onDriveSync?: () => Promise<{ count: number }> }) {
  const { t } = useLanguage();
  const { user, changePassword } = useAuth();
  const { enforcementEnabled, loading, billing, entitlements, startCheckout, openCustomerPortal, isPlanTestUser, setPlanTestPlan } = useSubscription();

  const [portalBusy, setPortalBusy] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<PaystackPlanId | null>(billing?.planId ?? 'starter');
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeErr, setUpgradeErr] = useState<string | null>(null);
  const [planTestBusy, setPlanTestBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [taxRegion, setTaxRegion] = useState<TaxRegion>('ch');
  const [taxRegionLoading, setTaxRegionLoading] = useState(Boolean(user?.uid));
  const [taxRegionSaving, setTaxRegionSaving] = useState(false);
  const [taxRegionError, setTaxRegionError] = useState<string | null>(null);

  const isPasswordUser = useMemo(
    () => user?.providerData?.some((p) => p.providerId === 'password') ?? false,
    [user]
  );

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

  const trialHint =
    billing?.trialEndsAt != null
      ? t('subscriptionTrialUntil').replace('{date}', billing.trialEndsAt.toLocaleDateString())
      : '';

  const rows: { label: string; value: string }[] = [
    { label: t('planSummaryDocuments'), value: formatLimit(entitlements.maxDocumentsPerMonth, t) },
    { label: t('planSummarySessions'), value: formatLimit(entitlements.maxSessions, t) },
  ];

  const planLabel = (id: PaystackPlanId) => planDisplayName(id, t);

  useEffect(() => {
    let cancelled = false;

    async function loadTaxRegion() {
      if (!user?.uid || !db) {
        if (!cancelled) setTaxRegionLoading(false);
        return;
      }
      setTaxRegionLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) setTaxRegion(parseTaxRegion(snapshot.data()?.taxRegion));
      } catch (error) {
        console.warn('Could not load tax region:', error);
      } finally {
        if (!cancelled) setTaxRegionLoading(false);
      }
    }

    void loadTaxRegion();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const saveTaxRegion = async (nextRegion: TaxRegion) => {
    if (!user?.uid || !db) return;
    setTaxRegionError(null);
    setTaxRegionSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { taxRegion: nextRegion });
      setTaxRegion(nextRegion);
    } catch (error) {
      console.error('Could not save tax region:', error);
      setTaxRegionError(t('billingTaxRegionSaveError'));
    } finally {
      setTaxRegionSaving(false);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      await openCustomerPortal();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setPortalBusy(false);
    }
  };

  const handleUpgrade = async () => {
    if (!upgradePlan) {
      setUpgradeErr(t('subscriptionPickPlanError'));
      return;
    }
    if (upgradePlan === 'enterprise') {
      window.location.href = PLAN_ENTERPRISE_SALES_MAILTO;
      return;
    }
    setUpgradeErr(null);
    setUpgradeBusy(true);
    try {
      await startCheckout(upgradePlan);
    } catch (e) {
      setUpgradeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUpgradeBusy(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErr(null);
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordErr(t('billingPasswordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr(t('billingPasswordMismatch'));
      return;
    }
    setPasswordBusy(true);
    try {
      const { error } = await changePassword(currentPassword, newPassword);
      if (error) {
        setPasswordErr(error.message);
        return;
      }
      setPasswordMsg(t('billingPasswordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setPasswordBusy(false);
    }
  };

  if (loading && enforcementEnabled) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="w-10 h-10 text-cdlp-gold animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">{t('subscriptionLoading')}</p>
      </div>
    );
  }

  return (
    <div className="billing-plan-panel max-w-3xl mx-auto space-y-8 pb-8">
      <header className="ba-page-header flex-col items-start !mb-6">
        <h1>{t('subscriptionManageBilling')}</h1>
        <p className="text-xs text-cdlp-muted leading-relaxed max-w-prose font-normal normal-case tracking-normal">
          {t('billingPageIntro')}
        </p>
      </header>

      {isPlanTestUser ? (
        <section className="ba-panel space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-cdlp-gold">{t('planTestTitle')}</h2>
          <p className="text-xs text-cdlp-muted leading-relaxed">{t('planTestBody')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(['starter', 'business', 'unlimited'] as const).map((id) => (
              <button
                key={id}
                type="button"
                disabled={planTestBusy}
                onClick={async () => {
                  setPlanTestBusy(true);
                  try {
                    await setPlanTestPlan(id);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : String(e));
                  } finally {
                    setPlanTestBusy(false);
                  }
                }}
                className={`rounded-md border px-2 py-3 text-[10px] font-black uppercase tracking-tight transition-colors disabled:opacity-50 ${
                  effectivePlan === id
                    ? 'border-cdlp-gold/70 bg-cdlp-cream/50 text-white'
                    : 'border-cdlp-border bg-cdlp-dark/30 text-cdlp-muted hover:border-cdlp-gold/35 hover:text-white'
                }`}
              >
                {planLabel(id)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {enforcementEnabled ? (
        <section className="ba-panel space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">{t('planSummaryTitle')}</p>
            {statusLabel ? (
              <span
                className={`text-[10px] font-bold uppercase tracking-tight ${
                  status === 'active' ? 'text-emerald-400/90' : 'text-cdlp-gold/80'
                }`}
              >
                {statusLabel}
              </span>
            ) : null}
          </div>
          <p className="text-lg font-black ba-field-value tracking-tight">{planDisplayName(planId, t)}</p>
          {trialHint ? (
            <p className="text-[10px] text-cdlp-gold/75 font-bold uppercase tracking-tight">{trialHint}</p>
          ) : null}
          <dl className="grid grid-cols-1 gap-3 text-[11px] sm:grid-cols-3">
            {rows.map((r) => (
              <div
                key={r.label}
                className="rounded-lg border border-cdlp-border/90 bg-cdlp-cream/40 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
              >
                <dt className="font-bold text-cdlp-muted">{r.label}</dt>
                <dd className="ba-field-value font-semibold tabular-nums mt-1">{r.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted mb-2">{t('planSummaryIncludedTitle')}</p>
            <PlanMarketingFeatureBullets planId={effectivePlan} variant="cdlp" />
          </div>
          <button
            type="button"
            disabled={portalBusy}
            onClick={() => void openPortal()}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-cdlp-border bg-cdlp-dark/40 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-cdlp-muted hover:border-cdlp-gold/35 hover:bg-cdlp-cream/30 hover:text-white disabled:opacity-50 transition-colors"
          >
            {portalBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cdlp-gold" />
            ) : (
              <CreditCard className="w-3.5 h-3.5 text-cdlp-gold/80" />
            )}
            {t('billingOpenStripePortal')}
          </button>
        </section>
      ) : (
        <section className="ba-panel p-5 text-xs text-cdlp-muted">
          {t('billingEnforcementOff')}
        </section>
      )}

      {enforcementEnabled ? (
        <section className="ba-panel space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider ba-field-value flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 shrink-0 text-cdlp-gold/85" aria-hidden />
            {t('billingUpgradeTitle')}
          </h2>
          <p className="text-xs text-cdlp-muted leading-relaxed">{t('billingUpgradeBody')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t('billingUpgradeTitle')}>
            {UPGRADE_PLANS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setUpgradePlan(id)}
                className={`rounded-md border px-2 py-3 text-[10px] font-black uppercase tracking-tight transition-colors ${
                  upgradePlan === id
                    ? 'border-cdlp-gold/70 bg-cdlp-cream/50 text-white shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-cdlp-gold)_18%,transparent)]'
                    : 'border-cdlp-border bg-cdlp-dark/30 text-cdlp-muted hover:border-cdlp-gold/35 hover:bg-cdlp-cream/20 hover:text-white/90'
                }`}
              >
                {planLabel(id)}
              </button>
            ))}
          </div>
          {upgradePlan ? (
            <PlanMarketingPanel
              planId={upgradePlan}
              variant="cdlp"
              showMostPopularBadge
              className="border-cdlp-border/80 bg-cdlp-dark/25"
            />
          ) : null}
          {upgradeErr ? (
            <p className="text-[10px] font-bold text-red-400/90 bg-red-950/25 border border-red-900/30 rounded-md px-3 py-2">
              {upgradeErr}
            </p>
          ) : null}
          <button
            type="button"
            disabled={upgradeBusy || !upgradePlan}
            onClick={() => void handleUpgrade()}
            className="w-full h-11 rounded-sm bg-cdlp-gold text-cdlp-black font-black text-xs uppercase tracking-wider hover:bg-cdlp-gold-light disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {upgradeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
            {upgradePlan === 'enterprise' ? t('ctaContactSales') : t('billingUpgradeCta')}
          </button>
        </section>
      ) : null}

      {enforcementEnabled ? (
        <section className="rounded-xl border border-cdlp-gold-pale/25 bg-cdlp-cream/35 p-5 sm:p-6 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-cdlp-muted flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0 text-cdlp-gold/70" aria-hidden />
            {t('billingCancelTitle')}
          </h2>
          <p className="text-xs text-cdlp-muted leading-relaxed">{t('billingCancelBody')}</p>
          <button
            type="button"
            disabled={portalBusy}
            onClick={() => void openPortal()}
            className="w-full h-11 rounded-sm border border-cdlp-gold-pale/40 bg-transparent text-cdlp-muted font-black text-xs uppercase tracking-wider hover:border-cdlp-gold/40 hover:bg-cdlp-gold/5 hover:text-cdlp-gold/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {portalBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 opacity-80" />}
            {t('billingCancelCta')}
          </button>
        </section>
      ) : null}

      <GoogleDriveConnectPanel onDriveSync={onDriveSync} />

      <section className="ba-panel space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider ba-field-value flex items-center gap-2">
          <KeyRound className="w-4 h-4 shrink-0 text-cdlp-muted" aria-hidden />
          {t('billingAccountTitle')}
        </h2>
        <p className="text-xs text-cdlp-muted">
          {t('billingAccountEmail')}{' '}
          <span className="font-bold ba-field-value">{user?.email ?? '—'}</span>
        </p>
        <div className="max-w-md">
          <label htmlFor="tax-region" className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted mb-2 block">
            {t('billingTaxRegionLabel')}
          </label>
          <select
            id="tax-region"
            value={taxRegion}
            disabled={taxRegionLoading || taxRegionSaving || !user?.uid}
            onChange={(event) => void saveTaxRegion(event.target.value as TaxRegion)}
            className="ba-verify-field"
          >
            <option value="ch">{t('billingTaxRegionCh')}</option>
            <option value="uk">{t('billingTaxRegionUk')}</option>
            <option value="off">{t('billingTaxRegionOff')}</option>
          </select>
          <p className="mt-2 text-xs text-cdlp-muted">{t('billingTaxRegionHint')}</p>
          {taxRegionError ? <p className="mt-2 text-xs text-red-400 font-medium">{taxRegionError}</p> : null}
        </div>
        {isPasswordUser ? (
          <form onSubmit={handlePasswordChange} className="space-y-3 max-w-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted">{t('billingChangePasswordTitle')}</p>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('billingCurrentPassword')}
              required
              className="ba-verify-field"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('billingNewPassword')}
              required
              minLength={6}
              className="ba-verify-field"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('billingConfirmPassword')}
              required
              minLength={6}
              className="ba-verify-field"
            />
            {passwordErr ? <p className="text-xs text-red-400 font-medium">{passwordErr}</p> : null}
            {passwordMsg ? <p className="text-xs text-emerald-400 font-medium">{passwordMsg}</p> : null}
            <button
              type="submit"
              disabled={passwordBusy}
              className="h-10 px-4 rounded-sm border border-cdlp-border bg-cdlp-dark/40 text-cdlp-muted font-black text-[10px] uppercase tracking-wider hover:border-cdlp-gold/35 hover:bg-cdlp-cream/30 hover:text-white disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {passwordBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('billingChangePasswordCta')}
            </button>
          </form>
        ) : (
          <p className="text-xs text-cdlp-muted leading-relaxed">{t('billingGooglePasswordHint')}</p>
        )}
      </section>
    </div>
  );
}
