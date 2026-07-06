import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PersonalExpenseCategory, PersonalIncomeCategory } from "../../personalCategories";
import type { PersonalPlanSurface } from "../personalPlanNav";

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type TransactionPrefill = {
  kind?: "expense" | "income";
  date?: string;
  amount?: number;
  description?: string;
  expenseCat?: PersonalExpenseCategory;
  incomeCat?: PersonalIncomeCategory;
};

type PersonalPlanContextValue = {
  month: string;
  setMonth: (month: string) => void;
  surface: PersonalPlanSurface;
  transactionOpen: boolean;
  transactionPrefill: TransactionPrefill | null;
  openTransaction: (prefill?: TransactionPrefill) => void;
  closeTransaction: () => void;
};

const PersonalPlanContext = createContext<PersonalPlanContextValue | null>(null);

export function PersonalPlanProvider({
  children,
  surface = "lab",
}: {
  children: ReactNode;
  surface?: PersonalPlanSurface;
}) {
  const [month, setMonth] = useState(currentMonthKey);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionPrefill, setTransactionPrefill] = useState<TransactionPrefill | null>(null);

  const openTransaction = useCallback((prefill?: TransactionPrefill) => {
    setTransactionPrefill(prefill ?? null);
    setTransactionOpen(true);
  }, []);

  const closeTransaction = useCallback(() => {
    setTransactionOpen(false);
    setTransactionPrefill(null);
  }, []);

  const value = useMemo(
    () => ({
      month,
      setMonth,
      surface,
      transactionOpen,
      transactionPrefill,
      openTransaction,
      closeTransaction,
    }),
    [month, surface, transactionOpen, transactionPrefill, openTransaction, closeTransaction]
  );

  return <PersonalPlanContext.Provider value={value}>{children}</PersonalPlanContext.Provider>;
}

export function usePersonalPlan() {
  const ctx = useContext(PersonalPlanContext);
  if (!ctx) throw new Error("usePersonalPlan must be used within PersonalPlanProvider");
  return ctx;
}
