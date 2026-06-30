import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type PersonalPlanContextValue = {
  month: string;
  setMonth: (month: string) => void;
  transactionOpen: boolean;
  openTransaction: () => void;
  closeTransaction: () => void;
};

const PersonalPlanContext = createContext<PersonalPlanContextValue | null>(null);

export function PersonalPlanProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonthKey);
  const [transactionOpen, setTransactionOpen] = useState(false);

  const value = useMemo(
    () => ({
      month,
      setMonth,
      transactionOpen,
      openTransaction: () => setTransactionOpen(true),
      closeTransaction: () => setTransactionOpen(false),
    }),
    [month, transactionOpen]
  );

  return <PersonalPlanContext.Provider value={value}>{children}</PersonalPlanContext.Provider>;
}

export function usePersonalPlan() {
  const ctx = useContext(PersonalPlanContext);
  if (!ctx) throw new Error("usePersonalPlan must be used within PersonalPlanProvider");
  return ctx;
}
