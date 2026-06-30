import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useFinance } from "@/cafe/context/FinanceContext";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";
import { useLabLanguage } from "../../context/LabLanguageContext";
import {
  classifyPersonalExpense,
  classifyPersonalIncome,
  personalExpenseLabelKey,
  personalIncomeLabelKey,
} from "../../personalCategories";
import { formatChfDisplay } from "../formatChfDisplay";
import { GlassCard } from "./GlassCard";

export function PersonalRecentLedger({ month }: { month: string }) {
  const { t } = useLabLanguage();
  const ledger = useLinkedLedger(month);
  const { updateExpense, updateIncome, deleteExpense, deleteIncome } = useFinance();
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const rows = [
    ...ledger.monthIncome.map((i) => ({
      id: i.id,
      kind: "income" as const,
      date: i.date,
      amount: i.amount,
      description: i.description || i.type,
      label: t(personalIncomeLabelKey(classifyPersonalIncome(i))),
    })),
    ...ledger.monthExpenses.map((e) => ({
      id: e.id,
      kind: "expense" as const,
      date: e.date,
      amount: e.amount,
      description: e.description || e.category,
      label: t(personalExpenseLabelKey(classifyPersonalExpense(e))),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const startEdit = (row: (typeof rows)[0]) => {
    setEditId(`${row.kind}:${row.id}`);
    setEditAmount(String(row.amount));
    setEditDesc(row.description);
  };

  const saveEdit = async (row: (typeof rows)[0]) => {
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (row.kind === "income") {
      await updateIncome(row.id, { amount, description: editDesc });
    } else {
      await updateExpense(row.id, { amount, description: editDesc });
    }
    setEditId(null);
    await ledger.refreshFinances();
  };

  const remove = async (row: (typeof rows)[0]) => {
    if (!confirm("Delete this transaction?")) return;
    if (row.kind === "income") await deleteIncome(row.id);
    else await deleteExpense(row.id);
    await ledger.refreshFinances();
  };

  return (
    <GlassCard className="p-4 md:p-5">
      <h3 className="text-sm font-semibold mb-3">Transactions this month</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--pp-on-surface-variant)]">
          No transactions in {month}. Add one above — it appears in Business too.
        </p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {rows.map((row) => {
            const key = `${row.kind}:${row.id}`;
            const editing = editId === key;
            return (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--pp-border)] text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{row.label}</p>
                  <p className="text-[11px] text-[var(--pp-on-surface-variant)]">{row.date}</p>
                  {editing ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <input
                        type="number"
                        className="pp-input w-24 px-2 py-1 text-xs"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                      <input
                        type="text"
                        className="pp-input flex-1 min-w-[120px] px-2 py-1 text-xs"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      <button
                        type="button"
                        className="text-xs text-[var(--pp-secondary)] font-bold"
                        onClick={() => void saveEdit(row)}
                      >
                        Save
                      </button>
                      <button type="button" className="text-xs" onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] truncate text-[var(--pp-on-surface-variant)]">
                      {row.description}
                    </p>
                  )}
                </div>
                {!editing && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`pp-tabular font-semibold ${row.kind === "income" ? "text-[var(--pp-secondary)]" : ""}`}
                    >
                      {row.kind === "expense" ? "−" : "+"}
                      {formatChfDisplay(row.amount, { prefix: false })}
                    </span>
                    <button
                      type="button"
                      className="p-1 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)]"
                      onClick={() => startEdit(row)}
                      aria-label="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-error)]"
                      onClick={() => void remove(row)}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
