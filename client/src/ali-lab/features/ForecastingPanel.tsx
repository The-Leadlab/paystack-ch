import { useEffect, useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { buildCashForecast } from "../utils/forecastFromLedger";
import { computeLedgerTotals } from "../utils/ledgerTotals";

export function ForecastingPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const ledger = useAliLabLedger();
  const [startBalance, setStartBalance] = useState(0);
  const [useLedgerStart, setUseLedgerStart] = useState(true);

  const ledgerBalance = useMemo(
    () =>
      computeLedgerTotals(ledger.filteredIncome, ledger.filteredExpenses).balance,
    [ledger.filteredIncome, ledger.filteredExpenses]
  );

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
    return { end: last.balanceChf, min, max, firstNegativeDay: firstNegative?.date, avgDailyNet };
  }, [points, startBalance]);

  const weeklyRows = useMemo(() => {
    const out: { week: string; endBalance: number }[] = [];
    points.forEach((p, i) => {
      if (i % 7 !== 6 && i !== points.length - 1) return;
      const week = Math.floor(i / 7) + 1;
      out.push({ week: `W${week}`, endBalance: p.balanceChf });
    });
    return out.slice(0, 13);
  }, [points]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex flex-wrap gap-3 items-center text-xs">
        <label className="font-bold uppercase">
          Starting balance (CHF)
          <input
            type="number"
            className="border border-border rounded px-2 py-1 ml-2 w-28 font-normal"
            value={startBalance}
            onChange={(e) => {
              setUseLedgerStart(false);
              setStartBalance(Number(e.target.value) || 0);
            }}
          />
        </label>
        <button
          type="button"
          className="text-brand-red font-bold uppercase underline"
          onClick={() => {
            setUseLedgerStart(true);
            setStartBalance(ledgerBalance);
          }}
        >
          {t("useLedgerBalance")} ({ledgerBalance.toLocaleString("de-CH")})
        </button>
      </div>
      <p className="text-xs font-bold uppercase">{t("forecast")}</p>
      {ledger.loading && <p className="text-sm text-muted-foreground">Loading ledger…</p>}
      {summary && (
        <p className="text-xs text-muted-foreground">
          Trailing weekly average net flow ≈ {summary.avgDailyNet.toLocaleString("de-CH")} CHF / day
        </p>
      )}
      {summary?.firstNegativeDay && (
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
          Projected negative balance from {summary.firstNegativeDay} — review expenses or starting balance.
        </p>
      )}
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
          const range = summary ? summary.max - summary.min || 1 : 1;
          const norm = summary ? (p.balanceChf - summary.min) / range : 0.5;
          const h = Math.max(4, Math.min(100, 8 + norm * 92));
          const negative = p.balanceChf < 0;
          return (
            <div
              key={p.date}
              title={`${p.date}: ${p.balanceChf} CHF`}
              className={`flex-1 rounded-t min-w-[2px] ${negative ? "bg-red-500/90" : "bg-brand-red/80"}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      {weeklyRows.length > 0 && (
        <table className="w-full text-xs border border-border rounded overflow-hidden">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Week</th>
              <th className="text-right p-2">End balance CHF</th>
            </tr>
          </thead>
          <tbody>
            {weeklyRows.map((r) => (
              <tr key={r.week} className="border-t border-border">
                <td className="p-2">{r.week}</td>
                <td className={`p-2 text-right font-mono ${r.endBalance < 0 ? "text-red-500" : ""}`}>
                  {r.endBalance.toLocaleString("de-CH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
