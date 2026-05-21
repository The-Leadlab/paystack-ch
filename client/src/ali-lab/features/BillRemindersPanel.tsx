import { useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabBill } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";

export function BillRemindersPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { items, add, remove, uid } = useAliLabPersist<LabBill>(labCollections.bills, "bills", [
    { id: "seed-1", name: "Serafe", dueDate: "2026-06-01", amountChf: 335, recurrence: "yearly", remindDaysBefore: 14 },
    { id: "seed-2", name: "RC insurance", dueDate: "2026-07-15", amountChf: 1200, recurrence: "yearly", remindDaysBefore: 30 },
  ]);

  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amountChf, setAmountChf] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(() => {
    return [...items]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((b) => {
        const due = new Date(b.dueDate);
        const now = new Date(today);
        const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
        return { ...b, days, overdue: days < 0 };
      });
  }, [items, today]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          className="border border-border rounded px-2 py-1 flex-1 min-w-[120px]"
          placeholder="Serafe, LAMal, rent…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="date"
          className="border border-border rounded px-2 py-1"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <input
          type="number"
          className="border border-border rounded px-2 py-1 w-24"
          placeholder="CHF"
          value={amountChf || ""}
          onChange={(e) => setAmountChf(Number(e.target.value))}
        />
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
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
      <ul className="space-y-2">
        {upcoming.length === 0 && <li className="text-sm text-muted-foreground">{t("noData")}</li>}
        {upcoming.map((b) => (
          <li
            key={b.id}
            className={`flex justify-between items-center border rounded px-3 py-2 text-sm ${
              b.overdue ? "border-red-500/50 bg-red-500/5" : b.days <= b.remindDaysBefore ? "border-amber-500/50" : "border-border"
            }`}
          >
            <span>
              <strong>{b.name}</strong> — {t("due")} {b.dueDate}
              {b.overdue ? (
                <span className="text-red-500 ml-2 uppercase text-[10px] font-bold">{t("overdue")}</span>
              ) : (
                <span className="text-muted-foreground ml-2">
                  ({b.days} {t("daysUntil")})
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{b.amountChf.toLocaleString("de-CH")} CHF</span>
              <button type="button" className="text-[10px] text-muted-foreground underline" onClick={() => void remove(b.id)}>
                {t("delete")}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {!uid && <p className="text-xs text-muted-foreground">Swiss presets (Serafe) stored locally until sign-in.</p>}
    </div>
  );
}
