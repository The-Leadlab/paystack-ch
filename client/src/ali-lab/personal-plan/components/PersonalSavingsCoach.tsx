import { useEffect, useState } from "react";
import { Lightbulb, Loader2, PiggyBank, Sparkles } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import {
  buildMonthSnapshot,
  suggestPersonalSavingsAdvice,
  type PersonalSavingsAdvice,
} from "../../lib/personalAiAssist";
import type { PersonalBudgetTx } from "../../lib/personalBudgetStore";
import { formatChfDisplay, formatPct } from "../formatChfDisplay";
import { GlassCard } from "./GlassCard";

type Props = {
  month: string;
  totals: {
    totalIncome: number;
    totalExpenses: number;
    savings: number;
    savingsRatePct: number;
  };
  rows: PersonalBudgetTx[];
};

export function PersonalSavingsCoach({ month, totals, rows }: Props) {
  const { t } = useLabLanguage();
  const [advice, setAdvice] = useState<PersonalSavingsAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        const snap = buildMonthSnapshot(month, totals, rows);
        const next = await suggestPersonalSavingsAdvice(snap);
        if (!cancelled) setAdvice(next);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = window.setTimeout(() => void run(), 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on month money shape, not row identity
  }, [
    month,
    totals.totalIncome,
    totals.totalExpenses,
    totals.savings,
    totals.savingsRatePct,
    rows.length,
  ]);

  return (
    <GlassCard className="p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pp-primary)] inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            {t("saveCoachTitle")}
          </p>
          <h3 className="text-lg font-bold mt-1">{t("saveCoachHeading")}</h3>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1">{t("saveCoachHint")}</p>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-[var(--pp-primary)] shrink-0" />}
      </div>

      {err && <p className="text-xs text-[var(--pp-error)]">{err}</p>}

      {advice && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--pp-primary)]/8 p-3">
              <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)] inline-flex items-center gap-1">
                <PiggyBank className="size-3.5" />
                {t("saveCoachHowMuch")}
              </p>
              <p className="text-xl font-semibold pp-tabular mt-1 text-[var(--pp-primary)]">
                {formatChfDisplay(advice.targetSaveChf)}
              </p>
              <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1">
                {formatPct(advice.targetSavePct)} {t("saveCoachOfIncome")}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--pp-surface)]/50 p-3">
              <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)]">{t("saveCoachSummary")}</p>
              <p className="text-sm mt-1 leading-snug">{advice.summary}</p>
              <p className="text-[10px] text-[var(--pp-on-surface-variant)] mt-2">
                {advice.source === "ai" ? t("saveCoachSourceAi") : t("saveCoachSourceHeuristic")}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase text-[var(--pp-on-surface-variant)] mb-2 inline-flex items-center gap-1">
              <Lightbulb className="size-3.5" />
              {t("saveCoachHowTo")}
            </p>
            <ul className="space-y-2">
              {advice.tips.map((tip) => (
                <li
                  key={`${tip.title}-${tip.estimatedMonthlySave}`}
                  className="rounded-lg border border-[var(--pp-outline-variant)]/50 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{tip.title}</p>
                    {tip.estimatedMonthlySave > 0 && (
                      <p className="text-[11px] font-bold text-[var(--pp-tertiary)] pp-tabular">
                        ~{formatChfDisplay(tip.estimatedMonthlySave)}/{t("month").toLowerCase()}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1 leading-snug">{tip.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {!advice && !loading && !err && (
        <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("saveCoachEmpty")}</p>
      )}
    </GlassCard>
  );
}
