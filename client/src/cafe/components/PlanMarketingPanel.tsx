import { useLanguage } from '../context/LanguageContext';
import type { PaystackPlanId } from '@shared/planCatalog';
import { planMarketingFeatureKeys } from '@shared/planMarketingFeatureKeys';

/** Same mailto as landing `PricingSection` Enterprise CTA. */
export const PLAN_ENTERPRISE_SALES_MAILTO =
  'mailto:info@paystack.ch?subject=Enterprise%20plan%20%E2%80%94%20Paystack.ch';

function planMarketingDescription(t: (k: string) => string, planId: PaystackPlanId): string {
  if (planId === 'starter') return t('planStarterDescription');
  if (planId === 'business') return t('planBusinessDescription');
  if (planId === 'unlimited') return t('planUnlimitedDescription');
  return t('planEnterpriseDescription');
}

function planMarketingName(t: (k: string) => string, planId: PaystackPlanId): string {
  if (planId === 'starter') return t('planStarterName');
  if (planId === 'business') return t('planBusinessName');
  if (planId === 'unlimited') return t('planUnlimitedName');
  return t('planEnterpriseName');
}

/** e.g. `CHF 29.- /month` or `CHF Custom` for Enterprise. */
export function planMarketingPriceLine(t: (k: string) => string, planId: PaystackPlanId): string {
  if (planId === 'enterprise') {
    return `${t('pricingCurrency')} ${t('pricingCustom')}`;
  }
  const amount =
    planId === 'starter'
      ? t('pricingStarterAmount')
      : planId === 'business'
        ? t('pricingBusinessAmount')
        : t('pricingUnlimitedAmount');
  return `${t('pricingCurrency')} ${amount} ${t('pricingPerMonth')}`;
}

type BulletVariant = 'cdlp' | 'card';

const bulletPresets: Record<
  BulletVariant,
  { ul: string; li: string; span: string }
> = {
  cdlp: {
    ul: 'list-disc pl-4 space-y-1.5 text-[11px] text-cdlp-muted leading-snug marker:text-cdlp-gold/80',
    li: 'pl-0.5 text-cdlp-muted',
    span: 'text-inherit',
  },
  card: {
    ul: 'list-disc pl-4 space-y-1.5 text-[11px] text-muted-foreground leading-snug marker:text-brand-red/70',
    li: 'pl-0.5',
    span: 'text-foreground/95',
  },
};

/** Renders the same marketing bullets as the landing pricing table for `planId`. */
export function PlanMarketingFeatureBullets({
  planId,
  variant = 'cdlp',
  className,
  itemClassName,
  spanClassName,
}: {
  planId: PaystackPlanId;
  variant?: BulletVariant;
  /** Overrides `ul` classes when set */
  className?: string;
  itemClassName?: string;
  spanClassName?: string;
}) {
  const { t } = useLanguage();
  const keys = planMarketingFeatureKeys(planId);
  const preset = bulletPresets[variant];
  return (
    <ul className={className ?? preset.ul}>
      {keys.map((key) => (
        <li key={key} className={itemClassName ?? preset.li}>
          <span className={spanClassName ?? preset.span}>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Name, tagline, price line, and feature bullets aligned with the public pricing page
 * (used in-app when users pick a tier and on `/admin` guest checkout tools).
 */
export function PlanMarketingPanel({
  planId,
  variant = 'cdlp',
  className,
  showMostPopularBadge,
}: {
  planId: PaystackPlanId;
  variant?: 'cdlp' | 'card';
  className?: string;
  /** When true and plan is Business, shows the same “Most popular” label as pricing. */
  showMostPopularBadge?: boolean;
}) {
  const { t } = useLanguage();
  const name = planMarketingName(t, planId);
  const desc = planMarketingDescription(t, planId);
  const price = planMarketingPriceLine(t, planId);
  const popular = Boolean(showMostPopularBadge && planId === 'business');

  if (variant === 'card') {
    return (
      <div
        className={`rounded-md border border-border bg-muted/20 px-3 py-3 text-left space-y-2 ${className ?? ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="font-display text-xs font-black uppercase tracking-tight text-foreground">{name}</p>
              {popular ? (
                <span className="inline-flex rounded border border-brand-red/40 bg-brand-red/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-brand-red">
                  {t('pricingMostPopular')}
                </span>
              ) : null}
            </div>
            <p className="font-editorial text-[11px] text-muted-foreground leading-snug">{desc}</p>
          </div>
          <p className="shrink-0 font-display text-sm font-black tabular-nums text-foreground">{price}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
            {t('planSummaryIncludedTitle')}
          </p>
          <PlanMarketingFeatureBullets planId={planId} variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-sm border border-cdlp-border bg-cdlp-black/30 px-3 py-3 text-left space-y-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-black uppercase tracking-tight text-white">{name}</p>
            {popular ? (
              <span className="inline-flex rounded border border-cdlp-gold/50 bg-cdlp-gold/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-cdlp-gold">
                {t('pricingMostPopular')}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-cdlp-muted leading-snug">{desc}</p>
        </div>
        <p className="shrink-0 text-sm font-black tabular-nums text-cdlp-gold">{price}</p>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted mb-1.5">{t('planSummaryIncludedTitle')}</p>
        <PlanMarketingFeatureBullets planId={planId} variant="cdlp" />
      </div>
    </div>
  );
}
