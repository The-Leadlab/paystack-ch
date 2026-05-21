import { useMemo } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { useFinance } from "@/cafe/context/FinanceContext";
import { buildCashForecast } from "../utils/forecastFromLedger";

export function ForecastingPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { income, expenses, loading } = useFinance();

  const points = useMemo(() => buildCashForecast(income, expenses, 0), [income, expenses]);

  const summary = useMemo(() => {
    if (!points.length) return null;
    const last = points[points.length - 1];
    const min = Math.min(...points.map((p) => p.balanceChf));
    const max = Math.max(...points.map((p) => p.balanceChf));
    return { end: last.balanceChf, min, max };
  }, [points]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <p className="text-xs font-bold uppercase">{t("forecast")}</p>
      {loading && <p className="text-sm text-muted-foreground">Loading ledger…</p>}
      {summary && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="border border-border rounded p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Day 90 balance</p>
            <p className="font-bold">{summary.end.toLocaleString("de-CH")} CHF</p>
          </div>
          <div className="border border-border rounded p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Min</p>
            <p className="font-bold text-red-500">{summary.min.toLocaleString("de-CH")}</p>
          </div>
          <div className="border border-border rounded p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Max</p>
            <p className="font-bold text-emerald-600">{summary.max.toLocaleString("de-CH")}</p>
          </div>
        </div>
      )}
      <div className="h-32 flex items-end gap-px border border-border rounded p-2 bg-muted/20">
        {points.filter((_, i) => i % 3 === 0).map((p) => {
          const h = Math.max(4, Math.min(100, 50 + p.balanceChf / 1000));
          return (
            <div
              key={p.date}
              title={`${p.date}: ${p.balanceChf} CHF`}
              className="flex-1 bg-brand-red/80 rounded-t min-w-[2px]"
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Projection uses trailing weekly averages from your Firestore income/expenses (sign in + use /app sessions).
      </p>
    </div>
  );
}
