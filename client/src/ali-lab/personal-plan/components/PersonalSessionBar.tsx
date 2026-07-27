import { Plus } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";

export function PersonalSessionBar({ month }: { month: string }) {
  const { t } = useLabLanguage();
  const ledger = usePersonalBudgetLedger(month);
  const { openTransaction } = usePersonalPlan();

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--pp-outline-variant)] bg-[var(--pp-surface-low)] px-4 md:px-16 py-2 text-xs">
      <span className="font-semibold text-[var(--pp-on-surface)]">{t("personalBudgetLabel")}</span>
      <button
        type="button"
        onClick={() => openTransaction()}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] font-bold"
      >
        <Plus className="size-3.5" />
        {t("stmtAddTx")}
      </button>

      <span className="text-[var(--pp-on-surface-variant)] ml-auto hidden sm:inline">
        {ledger.loading
          ? t("loadingLedger")
          : ledger.hasData
            ? t("personalTabsLiveHint")
            : t("personalTabsEmptyHint")}
      </span>
    </div>
  );
}
