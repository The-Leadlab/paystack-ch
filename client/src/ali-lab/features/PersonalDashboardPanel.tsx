import { Plus } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { PersonalRecentLedger } from "../personal-plan/components/PersonalRecentLedger";
import { PersonalStatementUpload } from "../personal-plan/components/PersonalStatementUpload";
import { formatChfDisplay, formatPct } from "../personal-plan/formatChfDisplay";

export function PersonalDashboardPanel({ feature: _feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { month, openTransaction } = usePersonalPlan();
  const budget = usePersonalBudgetLedger(month);
  const h = budget.totals;

  return (
    <div className="space-y-5">
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
        <GlassCard className="p-4">
          <ul className="space-y-1.5 max-h-36 overflow-auto">
            {budget.imports.slice(0, 8).map((imp) => (
              <li key={imp.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{imp.fileName}</span>
                <span className="shrink-0 text-[var(--pp-on-surface-variant)] pp-tabular">
                  {imp.rowCount} · {formatChfDisplay(imp.incomeTotal - imp.expenseTotal)}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => openTransaction()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-xs font-bold hover:opacity-90"
        >
          <Plus className="size-4" />
          {t("stmtAddTx")}
        </button>
        {budget.error ? <p className="text-xs text-[var(--pp-error)]">{budget.error}</p> : null}
      </div>

      <PersonalRecentLedger month={month} onChanged={() => void budget.refresh()} />
    </div>
  );
}
