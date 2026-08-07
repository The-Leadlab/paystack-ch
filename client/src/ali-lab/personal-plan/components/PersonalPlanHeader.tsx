import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";

/** Slim sticky bar — month + refresh. Language / theme / sessions live in Settings. */
export function PersonalPlanHeader({ title }: { title?: string }) {
  const { lang, t: labT } = useLabLanguage();
  const { month, setMonth } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === "fr" ? "fr-CH" : "de-CH", {
      month: "long",
      year: "numeric",
    });
  }, [month, lang]);

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center h-14 px-4 md:px-16 bg-[var(--pp-surface)]/95 backdrop-blur border-b border-[var(--pp-outline-variant)]">
      <div className="flex items-center gap-3 md:gap-5 min-w-0">
        {title ? (
          <h2 className="text-base md:text-lg font-semibold text-[var(--pp-primary)] truncate">{title}</h2>
        ) : null}
        <label className="flex items-center gap-2 text-[11px] text-[var(--pp-on-surface-variant)]">
          <span className="sr-only">{labT("month")}</span>
          <input
            type="month"
            className="pp-input px-2 py-1 text-xs font-bold text-[var(--pp-primary)] border-b-2 border-[var(--pp-primary)] bg-transparent rounded-none"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label={labT("month")}
          />
          <span className="hidden sm:inline text-sm text-[var(--pp-on-surface-variant)]">{monthLabel}</span>
        </label>
      </div>

      <button
        type="button"
        className="p-2 rounded-full hover:bg-[var(--pp-surface-high)] transition-colors text-[var(--pp-on-surface-variant)]"
        onClick={() => void ledger.refresh()}
        disabled={ledger.loading}
        aria-label="Refresh"
      >
        <RefreshCw className={`size-4 ${ledger.loading ? "animate-spin" : ""}`} />
      </button>
    </header>
  );
}
