import { RefreshCw } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { PersonalPeriodFilter } from "./PersonalPeriodFilter";

/** Slim sticky bar — calendar period filter + refresh. */
export function PersonalPlanHeader({ title }: { title?: string }) {
  const { t: labT } = useLabLanguage();
  const { month } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center gap-3 h-12 px-4 md:px-8 bg-[var(--pp-surface)]/95 backdrop-blur border-b border-[var(--pp-border)]">
      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
        {title ? (
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-widest text-[var(--pp-on-surface)] truncate shrink-0">
            {title}
          </h2>
        ) : null}
        <PersonalPeriodFilter />
      </div>

      <button
        type="button"
        className="p-1.5 rounded border border-[var(--pp-border)] hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)] transition-colors text-[var(--pp-on-surface-variant)] shrink-0"
        onClick={() => void ledger.refresh()}
        disabled={ledger.loading}
        aria-label={labT("month") ? "Refresh" : "Refresh"}
      >
        <RefreshCw className={`size-3.5 ${ledger.loading ? "animate-spin" : ""}`} />
      </button>
    </header>
  );
}
