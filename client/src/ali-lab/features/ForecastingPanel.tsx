import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useLabLanguage } from "../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import { buildCashForecast } from "../utils/forecastFromLedger";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

const CHART_W = 640;
const CHART_H = 280;
const PAD = { top: 24, right: 16, bottom: 36, left: 56 };

export function ForecastingPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { summary: featureSummary } = useLabFeatureText(feature);
  const ledger = usePersonalBudgetLedger();
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

  const chart = useMemo(() => {
    if (points.length < 2 || !summary) return null;
    const sample = points.filter((_, i) => i % 2 === 0 || i === points.length - 1);
    const rawMin = Math.min(summary.min, 0, startBalance);
    const rawMax = Math.max(summary.max, 0, startBalance);
    const pad = Math.max((rawMax - rawMin) * 0.08, 50);
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;
    const yRange = yMax - yMin || 1;
    const innerW = CHART_W - PAD.left - PAD.right;
    const innerH = CHART_H - PAD.top - PAD.bottom;

    const xAt = (i: number) => PAD.left + (i / (sample.length - 1)) * innerW;
    const yAt = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * innerH;

    const line = sample
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.balanceChf).toFixed(1)}`)
      .join(" ");
    const area = `${line} L ${xAt(sample.length - 1).toFixed(1)} ${yAt(0).toFixed(1)} L ${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} Z`;
    const zeroY = yAt(0);

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = yMin + (yRange * i) / ticks;
      return { v, y: yAt(v) };
    });

    const xLabels = [
      { i: 0, label: sample[0]?.date?.slice(5) || "D1" },
      { i: Math.floor(sample.length / 2), label: "≈45d" },
      { i: sample.length - 1, label: sample[sample.length - 1]?.date?.slice(5) || "D90" },
    ];

    return { line, area, zeroY, yTicks, xLabels, xAt, sample };
  }, [points, summary, startBalance]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("reportsTitle")}</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2 max-w-2xl">
          {t("reportsIntro")}
        </p>
        <p className="text-xs text-[var(--pp-on-surface-variant)] mt-1">{featureSummary}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-9 space-y-6">
          <GlassCard panel className="p-5 md:p-8 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4 relative z-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--pp-on-surface-variant)] mb-1">
                  {t("reportsProjected")}
                </p>
                <h3 className="text-3xl md:text-4xl font-bold pp-tabular">
                  {summary ? formatChfDisplay(summary.end) : "—"}
                </h3>
                {summary && (
                  <p className="text-sm flex flex-wrap items-center gap-2 mt-2">
                    <span
                      className={`font-bold inline-flex items-center gap-1 ${
                        summary.avgDailyNet >= 0 ? "text-[var(--pp-secondary)]" : "text-[var(--pp-error)]"
                      }`}
                    >
                      <TrendingUp className="size-4" />
                      {formatChfDisplay(summary.avgDailyNet)}/day
                    </span>
                    <span className="text-[var(--pp-on-surface-variant)] text-xs">{t("reportsFromLedger")}</span>
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

            <div className="w-full overflow-x-auto">
              {chart ? (
                <svg
                  className="w-full h-auto max-h-[320px]"
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  role="img"
                  aria-label={t("reportsProjected")}
                >
                  <defs>
                    <linearGradient id="ppForecastFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--pp-secondary)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--pp-secondary)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {chart.yTicks.map((tick) => (
                    <g key={tick.v}>
                      <line
                        x1={PAD.left}
                        x2={CHART_W - PAD.right}
                        y1={tick.y}
                        y2={tick.y}
                        stroke="var(--pp-border)"
                        strokeWidth="1"
                      />
                      <text
                        x={PAD.left - 8}
                        y={tick.y + 3}
                        textAnchor="end"
                        fill="var(--pp-on-surface-variant)"
                        fontSize="10"
                        fontFamily="inherit"
                      >
                        {Math.round(tick.v).toLocaleString("de-CH")}
                      </text>
                    </g>
                  ))}

                  <line
                    x1={PAD.left}
                    x2={CHART_W - PAD.right}
                    y1={chart.zeroY}
                    y2={chart.zeroY}
                    stroke="var(--pp-outline)"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />

                  <path d={chart.area} fill="url(#ppForecastFill)" />
                  <path
                    d={chart.line}
                    fill="none"
                    stroke="var(--pp-secondary)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {chart.xLabels.map((lab) => (
                    <text
                      key={`${lab.i}-${lab.label}`}
                      x={chart.xAt(lab.i)}
                      y={CHART_H - 10}
                      textAnchor="middle"
                      fill="var(--pp-on-surface-variant)"
                      fontSize="10"
                    >
                      {lab.label}
                    </text>
                  ))}
                </svg>
              ) : (
                <p className="text-sm text-[var(--pp-on-surface-variant)] p-8">{t("noLedgerYet")}</p>
              )}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard panel className="p-4">
              <p className="text-xs text-[var(--pp-on-surface-variant)] mb-2 uppercase tracking-wider">
                {t("reportsInflow")}
              </p>
              <h4 className="text-lg font-semibold text-[var(--pp-secondary)] pp-tabular">
                {summary ? formatChfDisplay(summary.inflow) : "—"}
              </h4>
            </GlassCard>
            <GlassCard panel className="p-4">
              <p className="text-xs text-[var(--pp-on-surface-variant)] mb-2 uppercase tracking-wider">
                {t("reportsOutflow")}
              </p>
              <h4 className="text-lg font-semibold text-[var(--pp-primary)] pp-tabular">
                {summary ? formatChfDisplay(summary.outflow) : "—"}
              </h4>
            </GlassCard>
            <GlassCard panel className="p-4">
              <p className="text-xs text-[var(--pp-on-surface-variant)] mb-2 uppercase tracking-wider">
                {t("reportsDay90Min")}
              </p>
              <h4 className="text-lg font-semibold pp-tabular">
                {summary ? formatChfDisplay(summary.min) : "—"}
              </h4>
            </GlassCard>
          </div>
        </section>

        <aside className="xl:col-span-3 space-y-4">
          <GlassCard panel className="p-4">
            <h3 className="text-base font-semibold mb-3">{t("reportsStartBalance")}</h3>
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
                {t("reportsNegativeFrom")} {summary.firstNegativeDay}
              </p>
            )}
          </GlassCard>

          {weeklyRows.length > 0 && (
            <GlassCard panel className="p-4 overflow-hidden">
              <h3 className="text-sm font-semibold mb-3">{t("week")}ly projection</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {weeklyRows.map((r) => (
                  <div
                    key={r.week}
                    className="flex justify-between pp-tabular border-b border-[var(--pp-border)] pb-1"
                  >
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
