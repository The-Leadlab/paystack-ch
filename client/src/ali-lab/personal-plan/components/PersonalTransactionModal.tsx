import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/cafe/context/FinanceContext";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";
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
import {
  personalExpenseToFirestore,
  personalIncomeToFirestore,
} from "../personalLedgerEntry";
import { formatChfDisplay } from "../formatChfDisplay";

type TxKind = "expense" | "income";

export function PersonalTransactionModal() {
  const { transactionOpen, closeTransaction, month } = usePersonalPlan();
  const { t } = useLabLanguage();
  const ledger = useLinkedLedger(month);
  const { addExpense, addIncome } = useFinance();

  const [kind, setKind] = useState<TxKind>("expense");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseCat, setExpenseCat] = useState<PersonalExpenseCategory>("GROCERIES");
  const [incomeCat, setIncomeCat] = useState<PersonalIncomeCategory>("SALARY");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setAmount("");
    setDescription("");
    setErr(null);
    setKind("expense");
  };

  const onClose = () => {
    closeTransaction();
    reset();
  };

  const submit = async () => {
    setErr(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    if (!ledger.sessionReady || !ledger.currentSession?.id) {
      setErr("Select or create a session in Business first.");
      return;
    }
    setBusy(true);
    try {
      if (kind === "expense") {
        const { category, description: desc } = personalExpenseToFirestore(expenseCat, description);
        await addExpense(date, category, value, desc, ledger.currentSession.id);
      } else {
        const { type, description: desc } = personalIncomeToFirestore(incomeCat, description);
        await addIncome(date, type, value, desc, ledger.currentSession.id);
      }
      await ledger.refreshFinances();
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
          <DialogTitle className="text-[var(--pp-primary)]">Add transaction</DialogTitle>
        </DialogHeader>

        {!ledger.sessionReady ? (
          <p className="text-sm text-[var(--pp-error)]">
            No active session. Open Business dashboard and create a session, or select one here in the
            session bar.
          </p>
        ) : (
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
                  {k}
                </button>
              ))}
            </div>

            <label className="block text-xs space-y-1">
              <span className="text-[var(--pp-on-surface-variant)]">Date</span>
              <input
                type="date"
                className="pp-input w-full px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label className="block text-xs space-y-1">
              <span className="text-[var(--pp-on-surface-variant)]">Category</span>
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
              <span className="text-[var(--pp-on-surface-variant)]">Amount (CHF)</span>
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
              <span className="text-[var(--pp-on-surface-variant)]">Description (optional)</span>
              <input
                type="text"
                className="pp-input w-full px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Migros, rent, salary…"
              />
            </label>

            <p className="text-[11px] text-[var(--pp-on-surface-variant)]">
              Saves to the same Firebase ledger as Business · session: {ledger.sessionLabel}
            </p>
            {err ? <p className="text-xs text-[var(--pp-error)]">{err}</p> : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !ledger.sessionReady}
            className="bg-[var(--pp-primary-container)] hover:opacity-90"
          >
            {busy ? "Saving…" : `Save ${amount ? formatChfDisplay(Number(amount) || 0) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
