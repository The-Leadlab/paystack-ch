/** Adapt personal IndexedDB rows to Income/Expense shapes for shared forecast helpers. */

import type { Expense, Income } from "@/cafe/types";
import type { PersonalBudgetTx } from "./personalBudgetStore";
import { personalExpenseToFirestore, personalIncomeToFirestore } from "../personal-plan/personalLedgerEntry";

export function personalTxToIncome(tx: PersonalBudgetTx): Income {
  const mapped = personalIncomeToFirestore(tx.incomeCat, tx.description);
  return {
    id: tx.id,
    restaurant_id: "personal",
    session_id: "personal",
    date: tx.date,
    type: mapped.type,
    amount: tx.amount,
    description: mapped.description,
    created_at: tx.createdAt,
  };
}

export function personalTxToExpense(tx: PersonalBudgetTx): Expense {
  const mapped = personalExpenseToFirestore(tx.expenseCat, tx.description);
  return {
    id: tx.id,
    restaurant_id: "personal",
    session_id: "personal",
    date: tx.date,
    category: mapped.category,
    amount: tx.amount,
    description: mapped.description,
    created_at: tx.createdAt,
  };
}

export function personalRowsToLedger(rows: PersonalBudgetTx[]): {
  income: Income[];
  expenses: Expense[];
} {
  return {
    income: rows.filter((r) => r.kind === "income").map(personalTxToIncome),
    expenses: rows.filter((r) => r.kind === "expense").map(personalTxToExpense),
  };
}
