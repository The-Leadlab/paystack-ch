import { Link } from "wouter";
import { ArrowRight, Plus } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { PersonalRecentLedger } from "../personal-plan/components/PersonalRecentLedger";
import {
  PERSONAL_PLAN_NAV,
  personalPlanNavHref,
  type PersonalPlanNavItem,
} from "../personal-plan/personalPlanNav";
import { formatChfDisplay, formatPct } from "../personal-plan/formatChfDisplay";

const SECTION_HINTS: Record<string, string> = {
  "session-tasks": "Per-session checklist with add, complete, remove, and progress",
  budgeting: "Set monthly limits and track spending by category",
  forecasting: "90-day cash flow projection from your ledger",
  goals: "Savings and debt targets with progress tracking",
  investments: "Holdings, allocation, and performance",
  "bill-reminders": "Recurring bills, due dates, and payment logging",
};

function QuickLinkCard({
  item,
  surface,
  hint,
}: {
  item: PersonalPlanNavItem;
  surface: "lab" | "app";
  hint: string;
}) {
  const Icon = item.icon;
  return (
    <Link href={personalPlanNavHref(item, surface)}>
      <GlassCard className="p-4 h-full hover:border-[var(--pp-primary)]/40 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between gap-2">
          <div className="p-2 rounded-lg bg-[var(--pp-primary)]/10">
            <Icon className="size-4 text-[var(--pp-primary)]" />
          </div>
          <ArrowRight className="size-4 text-[var(--pp-on-surface-variant)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
        <p className="text-sm font-semibold mt-3">{item.label}</p>
        <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1 leading-snug">{hint}</p>
      </GlassCard>
    </Link>
  );
}

export function PersonalDashboardPanel({ feature }: { feature: AliLabFeature }) {
  const { summary } = useLabFeatureText(feature);
  const { month, surface, openTransaction } = usePersonalPlan();
  const ledger = useAliLabLedger(month);
  const h = ledger.householdMonth;

  const sections = PERSONAL_PLAN_NAV.filter((item) => item.featureId !== "overview");

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pp-primary)]">Overview</p>
        <h2 className="text-2xl md:text-3xl font-bold mt-2">Your month at a glance</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2 max-w-2xl">{summary}</p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">Income</p>
          <p className="text-lg font-semibold text-[var(--pp-secondary)] pp-tabular mt-1">
            {formatChfDisplay(h.totalIncome)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">Expenses</p>
          <p className="text-lg font-semibold pp-tabular mt-1">{formatChfDisplay(h.totalExpenses)}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">Savings</p>
          <p
            className={`text-lg font-semibold pp-tabular mt-1 ${h.savings >= 0 ? "text-[var(--pp-tertiary)]" : "text-[var(--pp-error)]"}`}
          >
            {formatChfDisplay(h.savings)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">Savings rate</p>
          <p className="text-lg font-semibold pp-tabular mt-1">{formatPct(h.savingsRatePct)}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => openTransaction()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-xs font-bold hover:opacity-90"
        >
          <Plus className="size-4" />
          Add transaction
        </button>
        {!ledger.sessionReady && (
          <p className="text-xs text-[var(--pp-error)]">
            Select a session in the bar above, or create one in Business first.
          </p>
        )}
        {!ledger.hasFirebaseData && ledger.sessionReady && !ledger.loading && (
          <p className="text-xs text-[var(--pp-on-surface-variant)]">
            No transactions yet — add your first income or expense to populate the dashboard.
          </p>
        )}
      </GlassCard>

      <div>
        <h3 className="text-sm font-semibold mb-3">Explore</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((item) => (
            <QuickLinkCard
              key={item.id}
              item={item}
              surface={surface}
              hint={SECTION_HINTS[item.featureId] ?? item.label}
            />
          ))}
        </div>
      </div>

      <PersonalRecentLedger month={month} />
    </div>
  );
}
