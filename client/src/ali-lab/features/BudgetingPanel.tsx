import { useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { useFinance } from "@/cafe/context/FinanceContext";
import { useSession } from "@/cafe/context/SessionContext";
import type { Expense } from "@/cafe/types";
import type { LabBudgetMode } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";

const CATEGORIES: Expense["category"][] = ["BILLS", "SUPPLIERS", "PAYROLL", "PAYROLL_TAXES", "OTHER"];

type BudgetRow = {
  id: string;
  month: string;
  category: string;
  budgetChf: number;
  mode: LabBudgetMode;
};

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function spentForMonth(expenses: Expense[], month: string, category: string, sessionId?: string): number {
  return expenses
    .filter((e) => {
      if (sessionId && e.session_id !== sessionId) return false;
      return e.date.startsWith(month) && e.category === category;
    })
    .reduce((s, e) => s + e.amount, 0);
}

export function BudgetingPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { expenses, income, loading: finLoading } = useFinance();
  const { currentSession } = useSession();
  const [month, setMonth] = useState(monthKey());
  const [mode, setMode] = useState<LabBudgetMode>("traditional");

  const { items: saved, update, add, uid } = useAliLabPersist<BudgetRow>(
    labCollections.budgets,
    "budgets",
    []
  );

  const rows = useMemo(() => {
    const sid = currentSession?.id;
    return CATEGORIES.map((cat) => {
      const savedRow = saved.find((b) => b.month === month && b.category === cat);
      const budgetChf = savedRow?.budgetChf ?? 0;
      const spent = spentForMonth(expenses, month, cat, sid);
      return { cat, budgetChf, spent, id: savedRow?.id };
    });
  }, [saved, month, expenses, currentSession?.id]);

  const totalBudget = rows.reduce((s, r) => s + r.budgetChf, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalIncome = income
    .filter((i) => i.date.startsWith(month) && (!currentSession?.id || i.session_id === currentSession.id))
    .reduce((s, i) => s + i.amount, 0);

  const zeroBasedGap = mode === "zero-based" ? totalIncome - totalBudget : 0;

  const setBudget = async (category: string, budgetChf: number) => {
    const existing = saved.find((b) => b.month === month && b.category === category);
    const payload = { month, category, budgetChf, mode };
    if (existing) await update(existing.id, payload);
    else await add(payload);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex flex-wrap gap-3 items-center text-xs">
        <label className="font-bold uppercase">
          {t("month")}{" "}
          <input
            type="month"
            className="border border-border rounded px-2 py-1 ml-1"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <select
          className="border border-border rounded px-2 py-1"
          value={mode}
          onChange={(e) => setMode(e.target.value as LabBudgetMode)}
        >
          <option value="traditional">{t("traditional")}</option>
          <option value="zero-based">{t("zeroBased")}</option>
        </select>
        {finLoading && <span className="text-muted-foreground">Loading ledger…</span>}
        {!uid && <span className="text-amber-600">Using local budget cache</span>}
      </div>
      {mode === "zero-based" && (
        <p className="text-xs rounded bg-muted/50 p-2">
          Income this month: <strong>{totalIncome.toLocaleString("de-CH")} CHF</strong> — unallocated:{" "}
          <strong className={zeroBasedGap < 0 ? "text-red-500" : "text-emerald-600"}>
            {zeroBasedGap.toLocaleString("de-CH")} CHF
          </strong>
        </p>
      )}
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">{t("category")}</th>
            <th className="text-right p-2">{t("budget")}</th>
            <th className="text-right p-2">{t("spent")}</th>
            <th className="text-right p-2">{t("variance")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const v = row.budgetChf - row.spent;
            return (
              <tr key={row.cat} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{row.cat}</td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    className="w-28 text-right border border-border rounded px-1 bg-background"
                    value={row.budgetChf || ""}
                    onChange={(e) => void setBudget(row.cat, Number(e.target.value) || 0)}
                  />
                </td>
                <td className="p-2 text-right">{row.spent.toLocaleString("de-CH")}</td>
                <td className={`p-2 text-right font-medium ${v < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {v.toLocaleString("de-CH")}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/30 font-bold">
          <tr>
            <td className="p-2">Total</td>
            <td className="p-2 text-right">{totalBudget.toLocaleString("de-CH")}</td>
            <td className="p-2 text-right">{totalSpent.toLocaleString("de-CH")}</td>
            <td className="p-2 text-right">{(totalBudget - totalSpent).toLocaleString("de-CH")}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
