import { RefreshCw } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { PersonalPeriodFilter } from "./PersonalPeriodFilter";

/** Slim sticky bar — calendar period filter + refresh. */
export function PersonalPlanHeader({ title }: { title?: string }) {
  const { t } = useLabLanguage();
  const { month } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 min-h-12 py-1.5 px-3 md:px-8 bg-[var(--pp-surface)]/95 backdrop-blur border-b border-[var(--pp-border)] overflow-hidden">
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 overflow-hidden">
        {title ? (
          <h2 className="hidden md:block text-sm font-bold uppercase tracking-widest text-[var(--pp-on-surface)] truncate shrink-0">
            {title}
          </h2>
        ) : null}
        <PersonalPeriodFilter className="min-w-0 max-w-full" />
      </div>

      <button
        type="button"
        className="inline-flex items-center justify-center size-10 min-h-10 min-w-10 rounded-lg border border-[var(--pp-border)] hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)] transition-colors text-[var(--pp-on-surface-variant)] shrink-0"
        onClick={() => void ledger.refresh()}
        disabled={ledger.loading}
        aria-label={t("refreshAria")}
      >
        <RefreshCw className={`size-3.5 ${ledger.loading ? "animate-spin" : ""}`} />
      </button>
    </header>
  );
}
