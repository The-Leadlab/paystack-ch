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
    <header className="sticky top-0 z-40 flex justify-between items-center h-12 px-4 md:px-8 bg-[var(--pp-surface)]/95 backdrop-blur border-b border-[var(--pp-border)]">
      <div className="flex items-center gap-3 md:gap-5 min-w-0">
        {title ? (
          <h2 className="text-xs md:text-sm font-bold uppercase tracking-widest text-[var(--pp-on-surface)] truncate">
            {title}
          </h2>
        ) : null}
        <label className="flex items-center gap-2 text-[11px] text-[var(--pp-on-surface-variant)]">
          <span className="sr-only">{labT("month")}</span>
          <input
            type="month"
            className="pp-input px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--pp-on-surface)]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label={labT("month")}
          />
          <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-[var(--pp-on-surface-variant)]">
            {monthLabel}
          </span>
        </label>
      </div>

      <button
        type="button"
        className="p-1.5 rounded border border-[var(--pp-border)] hover:border-[var(--pp-primary)] hover:text-[var(--pp-primary)] transition-colors text-[var(--pp-on-surface-variant)]"
        onClick={() => void ledger.refresh()}
        disabled={ledger.loading}
        aria-label="Refresh"
      >
        <RefreshCw className={`size-3.5 ${ledger.loading ? "animate-spin" : ""}`} />
      </button>
    </header>
  );
}
