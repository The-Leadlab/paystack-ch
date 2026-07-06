import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useLabLanguage } from "../context/LabLanguageContext";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { buildCashForecast } from "../utils/forecastFromLedger";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

export function ForecastingPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { summary: featureSummary } = useLabFeatureText(feature);
  const ledger = useAliLabLedger();
  const [startBalance, setStartBalance] = useState(0);
  const [useLedgerStart, setUseLedgerStart] = useState(true);
  const [horizon, setHorizon] = useState<"90d" | "12m">("90d");

  const ledgerBalance = ledger.household.balance;

  useEffect(() => {
    if (useLedgerStart) setStartBalance(ledgerBalance);
  }, [useLedgerStart, ledgerBalance]);

  const points = useMemo(
    () => buildCashForecast(ledger.filteredIncome, ledger.filteredExpenses, startBalance),
    [ledger.filteredIncome, ledger.filteredExpenses, startBalance]
  );

  const summary = useMemo(() => {
    if (!points.length) return null;
    const last = points[points.length - 1];
    const min = Math.min(...points.map((p) => p.balanceChf));
    const max = Math.max(...points.map((p) => p.balanceChf));
    const firstNegative = points.find((p) => p.balanceChf < 0);
    const avgDailyNet =
      points.length > 1 ? (last.balanceChf - startBalance) / points.length : 0;
    const inflow = ledger.filteredIncome.reduce((s, i) => s + i.amount, 0);
    const outflow = ledger.filteredExpenses.reduce((s, e) => s + e.amount, 0);
    return {
      end: last.balanceChf,
      min,
      max,
      firstNegativeDay: firstNegative?.date,
      avgDailyNet,
      inflow,
      outflow,
    };
  }, [points, startBalance, ledger.filteredIncome, ledger.filteredExpenses]);

  const weeklyRows = useMemo(() => {
    const out: { week: string; endBalance: number }[] = [];
    points.forEach((p, i) => {
      if (i % 7 !== 6 && i !== points.length - 1) return;
      const week = Math.floor(i / 7) + 1;
      out.push({ week: `W${week}`, endBalance: p.balanceChf });
    });
    return out.slice(0, 13);
  }, [points]);

  const chartPoints = points.filter((_, i) => i % 3 === 0);
  const chartMax = summary?.max ?? 1;
  const chartMin = summary?.min ?? 0;
  const chartRange = chartMax - chartMin || 1;

  const pathD = useMemo(() => {
    if (chartPoints.length < 2) return "";
    const w = 1000;
    const h = 400;
    const step = w / (chartPoints.length - 1);
    return chartPoints
      .map((p, i) => {
        const x = i * step;
        const norm = (p.balanceChf - chartMin) / chartRange;
        const y = h - 50 - norm * (h - 100);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [chartPoints, chartMin, chartRange]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--pp-on-surface-variant)]">{featureSummary}</p>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-9 space-y-6">
          <GlassCard panel className="p-5 md:p-8 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 relative z-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--pp-on-surface-variant)] mb-1">
                  Projected balance (90 days)
                </p>
                <h3 className="text-3xl md:text-5xl font-bold pp-tabular">
                  {summary ? formatChfDisplay(summary.end) : "—"}
                </h3>
                {summary && (
                  <p className="text-sm flex items-center gap-2 mt-2">
                    <span className="text-[var(--pp-secondary)] font-bold flex items-center gap-1">
                      <TrendingUp className="size-4" />
                      {formatChfDisplay(summary.avgDailyNet)}/day avg
                    </span>
                    <span className="text-[var(--pp-on-surface-variant)]">from ledger history</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHorizon("90d")}
                  className={`px-4 py-2 rounded text-xs font-semibold border ${
                    horizon === "90d"
                      ? "bg-[var(--pp-surface-highest)] border-[var(--pp-outline-variant)]"
                      : "text-[var(--pp-on-surface-variant)] border-transparent"
                  }`}
                >
                  90 days
                </button>
                <button
                  type="button"
                  disabled
                  title="12-month forecast coming soon"
                  className="px-4 py-2 rounded text-xs font-semibold text-[var(--pp-on-surface-variant)] opacity-50 cursor-not-allowed"
                >
                  12 months
                </button>
              </div>
            </div>

            <div className="h-[280px] md:h-[360px] relative">
              {pathD ? (
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
                  <defs>
                    <linearGradient id="forecastGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4edea3" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#4edea3" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line stroke="#333333" strokeDasharray="4" x1="0" x2="1000" y1="300" y2="300" />
                  <line stroke="#333333" strokeDasharray="4" x1="0" x2="1000" y1="200" y2="200" />
                  <line stroke="#333333" strokeDasharray="4" x1="0" x2="1000" y1="100" y2="100" />
                  <path d={`${pathD} L 1000 400 L 0 400 Z`} fill="url(#forecastGradient)" />
                  <path d={pathD} fill="transparent" stroke="#4edea3" strokeWidth="3" />
                </svg>
              ) : (
                <p className="text-sm text-[var(--pp-on-surface-variant)] p-8">{t("noLedgerYet")}</p>
              )}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard panel className="p-4">
              <p className="text-xs text-[var(--pp-on-surface-variant)] mb-2 uppercase tracking-wider">Inflow (session)</p>
              <h4 className="text-lg font-semibold text-[var(--pp-secondary)] pp-tabular">
                {summary ? formatChfDisplay(summary.inflow) : "—"}
              </h4>
            </GlassCard>
            <GlassCard panel className="p-4">
              <p className="text-xs text-[var(--pp-on-surface-variant)] mb-2 uppercase tracking-wider">Outflow (session)</p>
              <h4 className="text-lg font-semibold text-[var(--pp-primary)] pp-tabular">
                {summary ? formatChfDisplay(summary.outflow) : "—"}
              </h4>
            </GlassCard>
            <GlassCard panel className="p-4">
              <p className="text-xs text-[var(--pp-on-surface-variant)] mb-2 uppercase tracking-wider">Day 90 min</p>
              <h4 className="text-lg font-semibold pp-tabular">
                {summary ? formatChfDisplay(summary.min) : "—"}
              </h4>
            </GlassCard>
          </div>
        </section>

        <aside className="xl:col-span-3 space-y-4">
          <GlassCard panel className="p-4">
            <h3 className="text-base font-semibold mb-3">Starting balance</h3>
            <input
              type="number"
              className="pp-input w-full px-3 py-2 text-sm mb-2"
              value={startBalance}
              onChange={(e) => {
                setUseLedgerStart(false);
                setStartBalance(Number(e.target.value) || 0);
              }}
            />
            <button
              type="button"
              className="text-xs text-[var(--pp-primary)] font-semibold underline"
              onClick={() => {
                setUseLedgerStart(true);
                setStartBalance(ledgerBalance);
              }}
            >
              {t("useLedgerBalance")} ({formatChfDisplay(ledgerBalance)})
            </button>
            {summary?.firstNegativeDay && (
              <p className="text-xs text-[var(--pp-error)] mt-3">
                Negative from {summary.firstNegativeDay}
              </p>
            )}
          </GlassCard>

          {weeklyRows.length > 0 && (
            <GlassCard panel className="p-4 overflow-hidden">
              <h3 className="text-sm font-semibold mb-3">{t("week")}ly projection</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {weeklyRows.map((r) => (
                  <div key={r.week} className="flex justify-between pp-tabular border-b border-[var(--pp-border)] pb-1">
                    <span>{r.week}</span>
                    <span className={r.endBalance < 0 ? "text-[var(--pp-error)]" : ""}>
                      {formatChfDisplay(r.endBalance)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </aside>
      </div>
    </div>
  );
}
