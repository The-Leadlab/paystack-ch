import { useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import type { LabBudgetMode } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  classifyPersonalExpense,
  classifyPersonalIncome,
  personalExpenseLabelKey,
  personalIncomeLabelKey,
} from "../personalCategories";

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

export function BudgetingPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const ledger = useAliLabLedger();
  const { filteredExpenses: expenses, filteredIncome: income, loading: finLoading, currentSession } =
    ledger;
  const [month, setMonth] = useState(monthKey());
  const [mode, setMode] = useState<LabBudgetMode>("traditional");

  const { items: saved, update, add, uid } = useAliLabPersist<BudgetRow>(
    labCollections.budgets,
    "budgets",
    []
  );

  const inMonth = (date: string) => date.startsWith(month);
  const inSession = (sessionId: string) =>
    ledger.isAllSessionsView || !currentSession?.id || sessionId === currentSession.id;

  const expenseRows = useMemo(() => {
    return PERSONAL_EXPENSE_CATEGORIES.map((cat) => {
      const savedRow = saved.find((b) => b.month === month && b.category === cat);
      const budgetChf = savedRow?.budgetChf ?? 0;
      const spent = expenses
        .filter((e) => inMonth(e.date) && inSession(e.session_id) && classifyPersonalExpense(e) === cat)
        .reduce((s, e) => s + e.amount, 0);
      return { cat, budgetChf, spent, id: savedRow?.id };
    });
  }, [saved, month, expenses, currentSession?.id, ledger.isAllSessionsView]);

  const incomeRows = useMemo(() => {
    return PERSONAL_INCOME_CATEGORIES.map((cat) => {
      const key = `income:${cat}`;
      const savedRow = saved.find((b) => b.month === month && b.category === key);
      const budgetChf = savedRow?.budgetChf ?? 0;
      const received = income
        .filter((i) => inMonth(i.date) && inSession(i.session_id) && classifyPersonalIncome(i) === cat)
        .reduce((s, i) => s + i.amount, 0);
      return { cat, key, budgetChf, received, id: savedRow?.id };
    });
  }, [saved, month, income, currentSession?.id, ledger.isAllSessionsView]);

  const totalExpenseBudget = expenseRows.reduce((s, r) => s + r.budgetChf, 0);
  const totalSpent = expenseRows.reduce((s, r) => s + r.spent, 0);
  const totalIncomeExpected = incomeRows.reduce((s, r) => s + r.budgetChf, 0);
  const totalIncomeReceived = incomeRows.reduce((s, r) => s + r.received, 0);
  const zeroBasedGap = mode === "zero-based" ? totalIncomeReceived - totalExpenseBudget : 0;

  const setBudget = async (category: string, budgetChf: number) => {
    const existing = saved.find((b) => b.month === month && b.category === category);
    const payload = { month, category, budgetChf, mode };
    if (existing) await update(existing.id, payload);
    else await add(payload);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{summary}</p>
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
        {finLoading && <span className="text-muted-foreground">{t("loadingLedger")}</span>}
        {!uid && <span className="text-amber-600">{t("localBudgetCache")}</span>}
      </div>
      {mode === "zero-based" && (
        <p className="text-xs rounded bg-muted/50 p-2">
          {t("incomeThisMonth")}: <strong>{totalIncomeReceived.toLocaleString("de-CH")} CHF</strong> —{" "}
          {t("unallocated")}:{" "}
          <strong className={zeroBasedGap < 0 ? "text-red-500" : "text-emerald-600"}>
            {zeroBasedGap.toLocaleString("de-CH")} CHF
          </strong>
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("incomeExpected")}
        </h3>
        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">{t("category")}</th>
              <th className="text-right p-2">{t("expected")}</th>
              <th className="text-right p-2">{t("received")}</th>
              <th className="text-right p-2">{t("variance")}</th>
            </tr>
          </thead>
          <tbody>
            {incomeRows.map((row) => {
              const v = row.budgetChf - row.received;
              return (
                <tr key={row.key} className="border-t border-border">
                  <td className="p-2 text-xs">{t(personalIncomeLabelKey(row.cat))}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-28 text-right border border-border rounded px-1 bg-background"
                      value={row.budgetChf || ""}
                      onChange={(e) => void setBudget(row.key, Number(e.target.value) || 0)}
                    />
                  </td>
                  <td className="p-2 text-right">{row.received.toLocaleString("de-CH")}</td>
                  <td
                    className={`p-2 text-right font-medium ${v < 0 ? "text-emerald-600" : v > 0 ? "text-amber-600" : ""}`}
                  >
                    {v.toLocaleString("de-CH")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 font-bold">
            <tr>
              <td className="p-2">{t("total")}</td>
              <td className="p-2 text-right">{totalIncomeExpected.toLocaleString("de-CH")}</td>
              <td className="p-2 text-right">{totalIncomeReceived.toLocaleString("de-CH")}</td>
              <td className="p-2 text-right">
                {(totalIncomeExpected - totalIncomeReceived).toLocaleString("de-CH")}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("expensesHousehold")}
        </h3>
        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">{t("category")}</th>
              <th className="text-right p-2">{t("budget")}</th>
              <th className="text-right p-2">{t("spent")}</th>
              <th className="text-right p-2">{t("variance")}</th>
              <th className="text-right p-2">{t("variancePct")}</th>
            </tr>
          </thead>
          <tbody>
            {expenseRows.map((row) => {
              const v = row.budgetChf - row.spent;
              const pct =
                row.budgetChf > 0 ? Math.round((row.spent / row.budgetChf) * 100) : row.spent > 0 ? 999 : 0;
              return (
                <tr key={row.cat} className="border-t border-border">
                  <td className="p-2 text-xs">{t(personalExpenseLabelKey(row.cat))}</td>
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
                  <td
                    className={`p-2 text-right text-xs ${pct > 100 ? "text-red-500 font-bold" : "text-muted-foreground"}`}
                  >
                    {row.budgetChf > 0 ? `${pct}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 font-bold">
            <tr>
              <td className="p-2">{t("total")}</td>
              <td className="p-2 text-right">{totalExpenseBudget.toLocaleString("de-CH")}</td>
              <td className="p-2 text-right">{totalSpent.toLocaleString("de-CH")}</td>
              <td className="p-2 text-right">{(totalExpenseBudget - totalSpent).toLocaleString("de-CH")}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
