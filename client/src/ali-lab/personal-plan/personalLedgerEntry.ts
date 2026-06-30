import type { Expense } from "@/cafe/types";
import type { PersonalExpenseCategory, PersonalIncomeCategory } from "../personalCategories";

const EXPENSE_LABEL: Record<PersonalExpenseCategory, string> = {
  BILLS: "Bills",
  RENT: "Rent",
  GROCERIES: "Groceries",
  GOING_OUT: "Going out",
  SHOPPING_OTHER: "Shopping",
  SAVINGS_INVEST: "Savings & invest",
};

/** Maps personal bucket → Firestore expense row (same collections as /app). */
export function personalExpenseToFirestore(
  cat: PersonalExpenseCategory,
  userDescription: string
): { category: Expense["category"]; description: string } {
  const label = EXPENSE_LABEL[cat];
  const description = userDescription.trim()
    ? `${label}: ${userDescription.trim()}`
    : label;
  const category: Expense["category"] =
    cat === "BILLS" ? "BILLS" : cat === "RENT" ? "SUPPLIERS" : "OTHER";
  return { category, description };
}

const INCOME_LABEL: Record<PersonalIncomeCategory, string> = {
  SALARY: "Salary",
  ASSET_REVENUE: "Asset revenue",
  CONTRIBUTIONS: "Contributions",
};

export function personalIncomeToFirestore(
  cat: PersonalIncomeCategory,
  userDescription: string
): { type: "SALES" | "RESERVATION"; description: string } {
  const label = INCOME_LABEL[cat];
  const description = userDescription.trim()
    ? `${label}: ${userDescription.trim()}`
    : label;
  return { type: cat === "SALARY" ? "SALES" : "RESERVATION", description };
}
