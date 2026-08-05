import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  personalExpenseLabelKey,
  personalIncomeLabelKey,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../../personalCategories";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { parseBudgetAmount } from "../../lib/parseBudgetAmount";
import { formatChfDisplay } from "../formatChfDisplay";

type TxKind = "expense" | "income";

export function PersonalTransactionModal() {
  const { transactionOpen, closeTransaction, transactionPrefill } = usePersonalPlan();
  const { t } = useLabLanguage();
  const ledger = usePersonalBudgetLedger();

  const [kind, setKind] = useState<TxKind>("expense");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseCat, setExpenseCat] = useState<PersonalExpenseCategory>("GROCERIES");
  const [incomeCat, setIncomeCat] = useState<PersonalIncomeCategory>("SALARY");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionOpen) return;
    const p = transactionPrefill;
    if (!p) {
      setDate(new Date().toISOString().slice(0, 10));
      return;
    }
    if (p.kind) setKind(p.kind);
    if (p.date) setDate(p.date);
    if (p.amount != null) setAmount(String(p.amount));
    if (p.description != null) setDescription(p.description);
    if (p.expenseCat) setExpenseCat(p.expenseCat);
    if (p.incomeCat) setIncomeCat(p.incomeCat);
  }, [transactionOpen, transactionPrefill]);

  const reset = () => {
    setAmount("");
    setDescription("");
    setErr(null);
    setKind("expense");
    setDate(new Date().toISOString().slice(0, 10));
    setExpenseCat("GROCERIES");
    setIncomeCat("SALARY");
  };

  const onClose = () => {
    closeTransaction();
    reset();
  };

  const submit = async () => {
    setErr(null);
    const value = parseBudgetAmount(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setErr(t("stmtInvalidAmount"));
      return;
    }
    setBusy(true);
    try {
      await ledger.add({
        date,
        description: description.trim() || (kind === "expense" ? expenseCat : incomeCat),
        amount: value,
        kind,
        expenseCat,
        incomeCat,
        source: "manual",
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={transactionOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="personal-plan-shell bg-[var(--pp-surface-container)] border-[var(--pp-outline-variant)] text-[var(--pp-on-surface)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--pp-primary)]">{t("stmtAddTx")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${
                  kind === k
                    ? "bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)]"
                    : "bg-[var(--pp-surface-highest)] text-[var(--pp-on-surface-variant)]"
                }`}
              >
                {k === "expense" ? t("expenses") : t("income")}
              </button>
            ))}
          </div>

          <label className="block text-xs space-y-1">
            <span className="text-[var(--pp-on-surface-variant)]">{t("stmtDate")}</span>
            <input
              type="date"
              className="pp-input w-full px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <label className="block text-xs space-y-1">
            <span className="text-[var(--pp-on-surface-variant)]">{t("category")}</span>
            <select
              className="pp-input w-full px-3 py-2 text-sm"
              value={kind === "expense" ? expenseCat : incomeCat}
              onChange={(e) =>
                kind === "expense"
                  ? setExpenseCat(e.target.value as PersonalExpenseCategory)
                  : setIncomeCat(e.target.value as PersonalIncomeCategory)
              }
            >
              {(kind === "expense" ? PERSONAL_EXPENSE_CATEGORIES : PERSONAL_INCOME_CATEGORIES).map(
                (c) => (
                  <option key={c} value={c}>
                    {t(
                      kind === "expense"
                        ? personalExpenseLabelKey(c as PersonalExpenseCategory)
                        : personalIncomeLabelKey(c as PersonalIncomeCategory)
                    )}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block text-xs space-y-1">
            <span className="text-[var(--pp-on-surface-variant)]">{t("stmtAmountChf")}</span>
            <input
              type="number"
              min="0"
              step="0.05"
              className="pp-input w-full px-3 py-2 text-sm pp-tabular"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <label className="block text-xs space-y-1">
            <span className="text-[var(--pp-on-surface-variant)]">{t("stmtDescOptional")}</span>
            <input
              type="text"
              className="pp-input w-full px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Migros, rent, salary…"
            />
          </label>

          <p className="text-[11px] text-[var(--pp-on-surface-variant)]">{t("stmtManualNote")}</p>
          {err ? <p className="text-xs text-[var(--pp-error)]">{err}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("stmtCancelPreview")}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="bg-[var(--pp-primary-container)] hover:opacity-90"
          >
            {busy ? t("stmtSaving") : `${t("save")} ${amount ? formatChfDisplay(Number(amount) || 0) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
