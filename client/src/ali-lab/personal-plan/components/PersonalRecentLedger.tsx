import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import {
  personalExpenseLabelKey,
  personalIncomeLabelKey,
} from "../../personalCategories";
import { formatChfDisplay } from "../formatChfDisplay";
import { GlassCard } from "./GlassCard";

export function PersonalRecentLedger({
  month,
  onChanged,
}: {
  month: string;
  onChanged?: () => void;
}) {
  const { t } = useLabLanguage();
  const ledger = usePersonalBudgetLedger(month);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const rows = ledger.monthRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    date: r.date,
    amount: r.amount,
    description: r.description,
    label:
      r.kind === "income"
        ? t(personalIncomeLabelKey(r.incomeCat))
        : t(personalExpenseLabelKey(r.expenseCat)),
    source: r.source,
  }));

  const startEdit = (row: (typeof rows)[0]) => {
    setEditId(row.id);
    setEditAmount(String(row.amount));
    setEditDesc(row.description);
  };

  const saveEdit = async (row: (typeof rows)[0]) => {
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await ledger.update(row.id, { amount, description: editDesc });
    setEditId(null);
    await ledger.refresh();
    onChanged?.();
  };

  const remove = async (row: (typeof rows)[0]) => {
    if (!confirm(t("stmtDeleteConfirm"))) return;
    await ledger.remove(row.id);
    await ledger.refresh();
    onChanged?.();
  };

  return (
    <GlassCard className="p-4 md:p-5">
      <h3 className="text-sm font-semibold mb-3">{t("stmtTxThisMonth")}</h3>
      {ledger.loading ? (
        <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("loadingLedger")}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[var(--pp-on-surface-variant)]">
          {t("stmtNoTxMonth")} ({month})
        </p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {rows.map((row) => {
            const editing = editId === row.id;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 text-xs px-2 py-2 rounded-md bg-[var(--pp-surface)]/40"
              >
                {editing ? (
                  <>
                    <input
                      className="w-24 px-2 py-1 rounded border border-[var(--pp-outline-variant)] bg-transparent"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                    />
                    <input
                      className="flex-1 min-w-[8rem] px-2 py-1 rounded border border-[var(--pp-outline-variant)] bg-transparent"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                    <button type="button" className="font-bold text-[var(--pp-primary)]" onClick={() => void saveEdit(row)}>
                      {t("save")}
                    </button>
                    <button type="button" onClick={() => setEditId(null)}>
                      {t("stmtCancelPreview")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-20 shrink-0 tabular-nums text-[var(--pp-on-surface-variant)]">{row.date}</span>
                    <span className="flex-1 min-w-0 truncate">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-[var(--pp-on-surface-variant)]"> · {row.description}</span>
                    </span>
                    <span
                      className={`shrink-0 tabular-nums font-semibold ${
                        row.kind === "income" ? "text-[var(--pp-secondary)]" : ""
                      }`}
                    >
                      {row.kind === "income" ? "+" : "−"}
                      {formatChfDisplay(row.amount)}
                    </span>
                    <button type="button" aria-label="Edit" onClick={() => startEdit(row)}>
                      <Pencil className="size-3.5 text-[var(--pp-on-surface-variant)]" />
                    </button>
                    <button type="button" aria-label="Delete" onClick={() => void remove(row)}>
                      <Trash2 className="size-3.5 text-[var(--pp-error)]" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
