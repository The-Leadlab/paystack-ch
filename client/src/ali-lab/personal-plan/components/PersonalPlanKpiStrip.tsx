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
  const color =
    tone === "positive"
      ? "text-[var(--pp-secondary)]"
      : tone === "negative"
        ? "text-[var(--pp-error)]"
        : tone === "tertiary"
          ? "text-[var(--pp-tertiary)]"
          : "text-[var(--pp-on-surface)]";

  return (
    <GlassCard className="p-4 md:p-5 flex flex-col gap-1">
      <span className="pp-kpi-label">{label}</span>
      <span className={`text-xl md:text-2xl font-semibold pp-tabular ${color}`}>{value}</span>
    </GlassCard>
  );
}

export function PersonalPlanKpiStrip() {
  const { t } = useLabLanguage();
  const { month } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);
  const h = ledger.totals;

  return (
    <section data-tour="overview-kpi" className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
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
    </section>
  );
}
