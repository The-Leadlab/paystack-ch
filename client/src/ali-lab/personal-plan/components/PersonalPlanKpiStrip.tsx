import { GlassCard } from "./GlassCard";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { formatChfDisplay, formatPct } from "../formatChfDisplay";

function KpiCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral" | "tertiary";
}) {
  const bar =
    tone === "positive"
      ? "bg-[var(--pp-secondary)]"
      : tone === "negative"
        ? "bg-[var(--pp-error)]"
        : tone === "tertiary"
          ? "bg-[var(--pp-tertiary)]"
          : "bg-[var(--pp-on-surface-variant)]";

  return (
    <GlassCard className="p-3.5 md:p-4 flex flex-col gap-2 min-h-[6.5rem] justify-between">
      <span className="pp-kpi-label">{label}</span>
      <span className="text-lg md:text-xl font-bold tracking-tight pp-tabular text-[var(--pp-on-surface)]">
        {value}
      </span>
      <div className="h-0.5 w-full rounded-full bg-[var(--pp-surface-highest)] overflow-hidden">
        <div className={`h-full w-2/5 ${bar}`} />
      </div>
    </GlassCard>
  );
}

export function PersonalPlanKpiStrip() {
  const { t } = useLabLanguage();
  const { month } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);
  const h = ledger.totals;

  return (
    <section data-tour="overview-kpi" className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--pp-on-surface-variant)]">
        {t("month")}: <span className="text-[var(--pp-on-surface)]">{month}</span>
        <span className="font-normal opacity-70"> — use the calendar in the header to change period</span>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <KpiCell label={t("income")} value={formatChfDisplay(h.totalIncome)} tone="positive" />
        <KpiCell label={t("expenses")} value={formatChfDisplay(h.totalExpenses)} tone="neutral" />
        <KpiCell
          label={t("savings")}
          value={formatChfDisplay(h.savings)}
          tone={h.savings >= 0 ? "tertiary" : "negative"}
        />
        <KpiCell
          label={t("balance")}
          value={formatChfDisplay(h.balance)}
          tone={h.balance >= 0 ? "neutral" : "negative"}
        />
        <KpiCell
          label={t("savingsRate")}
          value={formatPct(h.savingsRatePct)}
          tone={h.savingsRatePct >= 0 ? "positive" : "negative"}
        />
      </div>
    </section>
  );
}
