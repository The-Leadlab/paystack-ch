import { Link } from "wouter";
import { ArrowRight, Plus } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useLabLanguage } from "../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { PersonalRecentLedger } from "../personal-plan/components/PersonalRecentLedger";
import { PersonalStatementUpload } from "../personal-plan/components/PersonalStatementUpload";
import { PersonalSavingsCoach } from "../personal-plan/components/PersonalSavingsCoach";
import { PersonalGoogleDrivePanel } from "../personal-plan/components/PersonalGoogleDrivePanel";
import {
  PERSONAL_PLAN_NAV,
  personalPlanNavHref,
  type PersonalPlanNavItem,
} from "../personal-plan/personalPlanNav";
import { formatChfDisplay, formatPct } from "../personal-plan/formatChfDisplay";

const SECTION_HINTS: Record<string, string> = {
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
  const { t } = useLabLanguage();
  const { month, surface, openTransaction } = usePersonalPlan();
  const budget = usePersonalBudgetLedger(month);
  const h = budget.totals;

  const sections = PERSONAL_PLAN_NAV.filter((item) => item.featureId !== "overview");

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pp-primary)]">Overview</p>
        <h2 className="text-2xl md:text-3xl font-bold mt-2">{t("stmtOverviewTitle")}</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2 max-w-2xl">{summary}</p>
        <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-2">{t("stmtIsolatedNote")}</p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">{t("income")}</p>
          <p className="text-lg font-semibold text-[var(--pp-secondary)] pp-tabular mt-1">
            {formatChfDisplay(h.totalIncome)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">{t("expenses")}</p>
          <p className="text-lg font-semibold pp-tabular mt-1">{formatChfDisplay(h.totalExpenses)}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">{t("savings")}</p>
          <p
            className={`text-lg font-semibold pp-tabular mt-1 ${h.savings >= 0 ? "text-[var(--pp-tertiary)]" : "text-[var(--pp-error)]"}`}
          >
            {formatChfDisplay(h.savings)}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">{t("savingsRate")}</p>
          <p className="text-lg font-semibold pp-tabular mt-1">{formatPct(h.savingsRatePct)}</p>
        </GlassCard>
      </div>

      <PersonalStatementUpload onImported={() => void budget.refresh()} />

      {budget.imports.length > 0 ? (
        <GlassCard className="p-4 space-y-2">
          <p className="text-sm font-semibold">Uploaded statements</p>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
            Saved in this session · {budget.totalImportCount} total across all sessions
          </p>
          <ul className="space-y-1.5 max-h-40 overflow-auto">
            {budget.imports.slice(0, 12).map((imp) => (
              <li
                key={imp.id}
                className="flex items-center justify-between gap-2 text-xs border-t border-[var(--pp-outline-variant)] pt-1.5 first:border-0 first:pt-0"
              >
                <span className="truncate font-medium">{imp.fileName}</span>
                <span className="shrink-0 text-[var(--pp-on-surface-variant)] pp-tabular">
                  {imp.rowCount} rows · {formatChfDisplay(imp.incomeTotal - imp.expenseTotal)}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <PersonalGoogleDrivePanel />

      <PersonalSavingsCoach month={month} totals={h} rows={budget.rows} />

      <GlassCard className="p-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => openTransaction()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-xs font-bold hover:opacity-90"
        >
          <Plus className="size-4" />
          {t("stmtAddTx")}
        </button>
        {!budget.hasData && !budget.loading && (
          <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("stmtEmptyHint")}</p>
        )}
        {budget.error && <p className="text-xs text-[var(--pp-error)]">{budget.error}</p>}
      </GlassCard>

      <div>
        <h3 className="text-sm font-semibold mb-3">{t("stmtExplore")}</h3>
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

      <PersonalRecentLedger month={month} onChanged={() => void budget.refresh()} />
    </div>
  );
}
