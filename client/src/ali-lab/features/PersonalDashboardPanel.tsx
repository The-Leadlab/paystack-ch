import { Plus } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { PersonalRecentLedger } from "../personal-plan/components/PersonalRecentLedger";
import { PersonalStatementUpload } from "../personal-plan/components/PersonalStatementUpload";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

/** Overview body — KPIs live once in the shell strip (filtered by header calendar). */
export function PersonalDashboardPanel({ feature: _feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { month, openTransaction } = usePersonalPlan();
  const budget = usePersonalBudgetLedger(month);

  return (
    <div className="space-y-5">
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
