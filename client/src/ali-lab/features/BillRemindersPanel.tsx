import { useMemo, useState } from "react";
import { Calendar, Receipt, AlertTriangle } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabBill } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";

function annualizedChf(b: LabBill): number {
  if (b.recurrence === "monthly") return b.amountChf * 12;
  if (b.recurrence === "yearly") return b.amountChf;
  return b.amountChf;
}

export function BillRemindersPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const ledger = useAliLabLedger();
  const { items, add, remove, uid } = useAliLabPersist<LabBill>(labCollections.bills, "bills", [
    { id: "seed-1", name: "Serafe", dueDate: "2026-06-01", amountChf: 335, recurrence: "yearly", remindDaysBefore: 14 },
    { id: "seed-2", name: "RC insurance", dueDate: "2026-07-15", amountChf: 1200, recurrence: "yearly", remindDaysBefore: 30 },
  ]);

  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amountChf, setAmountChf] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const upcoming = useMemo(() => {
    return [...items]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((b) => {
        const due = new Date(b.dueDate);
        const now = new Date(today);
        const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
        const paidInLedger = ledger.filteredExpenses.some(
          (e) =>
            e.date.startsWith(monthPrefix) &&
            e.description?.toLowerCase().includes(b.name.toLowerCase().slice(0, 4))
        );
        return { ...b, days, overdue: days < 0, paidInLedger, annualChf: annualizedChf(b) };
      });
  }, [items, today, monthPrefix, ledger.filteredExpenses]);

  const totalAnnual = upcoming.reduce((s, b) => s + b.annualChf, 0);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Bill reminders</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2">{summary}</p>
      </section>

      <GlassCard className="p-4 flex flex-wrap items-center gap-4">
        <Receipt className="size-5 text-[var(--pp-primary)] shrink-0" />
        <p className="text-sm text-[var(--pp-on-surface-variant)]">
          {t("annualCost")}: <strong className="text-[var(--pp-on-surface)]">{formatChfDisplay(totalAnnual)}</strong>{" "}
          {t("committedRecurringSuffix")}
        </p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="pp-input px-3 py-2 flex-1 min-w-[120px] text-sm"
            placeholder={t("billPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="date"
            className="pp-input px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            type="number"
            className="pp-input px-3 py-2 w-24 text-sm"
            placeholder="CHF"
            value={amountChf || ""}
            onChange={(e) => setAmountChf(Number(e.target.value))}
          />
          <button
            type="button"
            className="bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] px-4 py-2 rounded-lg text-xs font-bold"
            onClick={() => {
              if (!name.trim() || !dueDate) return;
              void add({
                name: name.trim(),
                dueDate,
                amountChf,
                recurrence: "yearly",
                remindDaysBefore: 14,
              });
              setName("");
              setDueDate("");
              setAmountChf(0);
            }}
          >
            {t("addBill")}
          </button>
        </div>
      </GlassCard>

      <div className="space-y-3">
        {upcoming.length === 0 && (
          <p className="text-sm text-[var(--pp-on-surface-variant)]">{t("noData")}</p>
        )}
        {upcoming.map((b) => (
          <GlassCard
            key={b.id}
            className={`p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 ${
              b.overdue
                ? "border-[var(--pp-error)]/50"
                : b.days <= b.remindDaysBefore
                  ? "border-[var(--pp-primary)]/40"
                  : ""
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              {b.overdue ? (
                <AlertTriangle className="size-5 text-[var(--pp-error)] shrink-0 mt-0.5" />
              ) : (
                <Calendar className="size-5 text-[var(--pp-tertiary)] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{b.name}</p>
                <p className="text-xs text-[var(--pp-on-surface-variant)]">
                  {t("due")} {b.dueDate}
                  {b.paidInLedger && (
                    <span className="text-[var(--pp-secondary)] ml-2 font-semibold uppercase text-[10px]">
                      {t("paidInLedger")}
                    </span>
                  )}
                </p>
                {b.overdue ? (
                  <span className="text-[11px] text-[var(--pp-error)] font-bold uppercase">{t("overdue")}</span>
                ) : (
                  <span className="text-[11px] text-[var(--pp-on-surface-variant)]">
                    {b.days} {t("daysUntil")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right pp-tabular">
                <p className="font-semibold">{formatChfDisplay(b.amountChf)}</p>
                <p className="text-[10px] text-[var(--pp-on-surface-variant)]">
                  {formatChfDisplay(b.annualChf, { prefix: false })}
                  {t("perYear")}
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] text-[var(--pp-on-surface-variant)] underline"
                onClick={() => void remove(b.id)}
              >
                {t("delete")}
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
      {!uid && <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("swissPresetsLocal")}</p>}
    </div>
  );
}
