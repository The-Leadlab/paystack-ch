import type { Expense, Income } from "@/cafe/types";

/** Household budget expense buckets (individual / family — not company). */
export type PersonalExpenseCategory =
  | "BILLS"
  | "RENT"
  | "GROCERIES"
  | "GOING_OUT"
  | "SHOPPING_OTHER"
  | "SAVINGS_INVEST";

export type PersonalIncomeCategory = "SALARY" | "ASSET_REVENUE" | "CONTRIBUTIONS";

export const PERSONAL_EXPENSE_CATEGORIES: PersonalExpenseCategory[] = [
  "BILLS",
  "RENT",
  "GROCERIES",
  "GOING_OUT",
  "SHOPPING_OTHER",
  "SAVINGS_INVEST",
];

export const PERSONAL_INCOME_CATEGORIES: PersonalIncomeCategory[] = [
  "SALARY",
  "ASSET_REVENUE",
  "CONTRIBUTIONS",
];

const KEYWORDS: Record<PersonalExpenseCategory, string[]> = {
  BILLS: [
    "bill",
    "swisscom",
    "sunrise",
    "salt",
    "serafe",
    "insurance",
    "assurance",
    "electric",
    "electricity",
    "gas",
    "water",
    "internet",
    "telecom",
    "health",
    "krankenkasse",
    "facture",
    "rechnung",
  ],
  RENT: ["rent", "loyer", "miete", "housing", "lease", "hypothek", "mortgage", "logement"],
  GROCERIES: [
    "migros",
    "coop",
    "denner",
    "aldi",
    "lidl",
    "manor food",
    "grocery",
    "groceries",
    "supermarket",
    "supermarché",
    "supermarkt",
    "épicerie",
  ],
  GOING_OUT: [
    "restaurant",
    "bar",
    "cafe",
    "café",
    "cinema",
    "kino",
    "uber eats",
    "deliveroo",
    "just eat",
    "night out",
    "sortie",
    "ausgang",
    "concert",
    "sport",
    "gym",
  ],
  SHOPPING_OTHER: ["amazon", "zalando", "shopping", "clothes", "mode", "decathlon", "ikea"],
  SAVINGS_INVEST: [
    "savings",
    "invest",
    "etf",
    "pillar",
    "3a",
    "3b",
    "pension",
    "depot",
    "broker",
    "swissquote",
    "viac",
    "frankly",
  ],
};

const INCOME_KEYWORDS: Record<PersonalIncomeCategory, string[]> = {
  SALARY: ["salary", "salaire", "lohn", "wage", "payroll", "employer", "employeur", "gehalt"],
  ASSET_REVENUE: [
    "dividend",
    "interest",
    "rental income",
    "rent received",
    "loyer perçu",
    "mieteinnahme",
    "asset",
    "portfolio",
    "coupon",
  ],
  CONTRIBUTIONS: [
    "gift",
    "contribution",
    "family",
    "support",
    "cadeau",
    "apport",
    "schenkung",
    "beitrag",
    "allowance",
  ],
};

const LEGACY_EXPENSE_MAP: Record<Expense["category"], PersonalExpenseCategory> = {
  BILLS: "BILLS",
  SUPPLIERS: "RENT",
  PAYROLL: "GROCERIES",
  PAYROLL_TAXES: "GOING_OUT",
  OTHER: "SHOPPING_OTHER",
};

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export function classifyPersonalExpense(expense: Expense): PersonalExpenseCategory {
  const text = `${expense.description || ""} ${expense.category}`;
  for (const cat of PERSONAL_EXPENSE_CATEGORIES) {
    if (matchesKeywords(text, KEYWORDS[cat])) return cat;
  }
  return LEGACY_EXPENSE_MAP[expense.category] ?? "SHOPPING_OTHER";
}

export function classifyPersonalIncome(income: Income): PersonalIncomeCategory {
  const text = `${income.description || ""} ${income.type}`;
  for (const cat of PERSONAL_INCOME_CATEGORIES) {
    if (matchesKeywords(text, INCOME_KEYWORDS[cat])) return cat;
  }
  return "SALARY";
}

export function personalExpenseLabelKey(cat: PersonalExpenseCategory): string {
  const map: Record<PersonalExpenseCategory, string> = {
    BILLS: "catBills",
    RENT: "catRent",
    GROCERIES: "catGroceries",
    GOING_OUT: "catGoingOut",
    SHOPPING_OTHER: "catShoppingOther",
    SAVINGS_INVEST: "catSavingsInvest",
  };
  return map[cat];
}

export function personalIncomeLabelKey(cat: PersonalIncomeCategory): string {
  const map: Record<PersonalIncomeCategory, string> = {
    SALARY: "incSalary",
    ASSET_REVENUE: "incAssetRevenue",
    CONTRIBUTIONS: "incContributions",
  };
  return map[cat];
}
