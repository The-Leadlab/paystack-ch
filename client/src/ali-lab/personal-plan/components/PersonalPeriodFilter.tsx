import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { currentMonthKey, usePersonalPlan } from "../context/PersonalPlanContext";

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentMonthKey(d);
}

/** Single calendar period control — drives KPIs and month-scoped ledger lists. */
export function PersonalPeriodFilter({
  className = "",
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { lang, t } = useLabLanguage();
  const { month, setMonth } = usePersonalPlan();

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === "fr" ? "fr-CH" : "de-CH", {
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded border border-[var(--pp-border)] bg-[var(--pp-surface-high)] px-1.5 py-1 ${className}`}
      data-tour="period-filter"
    >
      {showLabel ? (
        <span className="hidden sm:inline-flex items-center gap-1 pl-1 text-[9px] font-bold uppercase tracking-wider text-[var(--pp-on-surface-variant)]">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          {t("month")}
        </span>
      ) : (
        <CalendarDays className="size-3.5 shrink-0 text-[var(--pp-on-surface-variant)] ml-0.5" aria-hidden />
      )}
      <button
        type="button"
        className="p-1 rounded text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)] hover:bg-[var(--pp-surface-highest)]"
        onClick={() => setMonth(shiftMonth(month, -1))}
        aria-label="Previous month"
        title="Previous month"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <label className="relative inline-flex items-center">
        <span className="sr-only">{t("month")}</span>
        <input
          type="month"
          className="pp-input border-0 bg-transparent px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pp-on-surface)] min-w-[7.5rem]"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
          aria-label={t("month")}
          title={monthLabel}
        />
      </label>
      <button
        type="button"
        className="p-1 rounded text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)] hover:bg-[var(--pp-surface-highest)]"
        onClick={() => setMonth(shiftMonth(month, 1))}
        aria-label="Next month"
        title="Next month"
      >
        <ChevronRight className="size-3.5" />
      </button>
      <button
        type="button"
        className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)]"
        onClick={() => setMonth(currentMonthKey())}
        title="Jump to current month"
      >
        Today
      </button>
    </div>
  );
}
