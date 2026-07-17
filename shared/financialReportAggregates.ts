export type ReportIncomeRow = {
  date: string;
  amount: number;
  vat_amount?: number;
  description?: string;
  type?: string;
  account_code?: string;
};

export type ReportExpenseRow = {
  date: string;
  amount: number;
  vat_amount?: number;
  description?: string;
  category?: string;
  account_code?: string;
};

export type MonthlyBucket = { income: number; expenses: number; balance: number };

function parseMonthKey(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date.slice(0, 7);
}

export function buildMonthlyData(
  income: ReportIncomeRow[],
  expenses: ReportExpenseRow[]
): [string, MonthlyBucket][] {
  const months: Record<string, MonthlyBucket> = {};

  for (const item of income) {
    const month = parseMonthKey(item.date);
    if (!month) continue;
    if (!months[month]) months[month] = { income: 0, expenses: 0, balance: 0 };
    months[month].income += Number(item.amount || 0);
  }

  for (const item of expenses) {
    const month = parseMonthKey(item.date);
    if (!month) continue;
    if (!months[month]) months[month] = { income: 0, expenses: 0, balance: 0 };
    months[month].expenses += Number(item.amount || 0);
  }

  for (const month of Object.keys(months)) {
    months[month].balance = months[month].income - months[month].expenses;
  }

  return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
}

export function buildSupplierData(
  expenses: ReportExpenseRow[],
  unknownLabel = "Unknown"
): [string, number][] {
  const suppliers: Record<string, number> = {};

  for (const item of expenses) {
    if (item.category !== "SUPPLIERS") continue;
    const supplier = item.description?.trim() || unknownLabel;
    suppliers[supplier] = (suppliers[supplier] || 0) + Number(item.amount || 0);
  }

  return Object.entries(suppliers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export type LedgerRow = {
  id: string;
  date: string;
  vendor: string;
  category: string;
  account: string;
  amount: number;
  vat: number;
  description: string;
  tone: "income" | "expense";
};

export function buildLedgerRows(
  income: ReportIncomeRow[],
  expenses: ReportExpenseRow[],
  labelCategory: (category: string) => string,
  labelIncomeType: (type: string) => string
): LedgerRow[] {
  return [
    ...income.map((item) => ({
      id: `in-${item.date}-${item.description}-${item.amount}`,
      date: item.date,
      vendor: item.description || "—",
      category: labelIncomeType(item.type || "SALES"),
      account: item.account_code || "—",
      amount: Number(item.amount || 0),
      vat: Number(item.vat_amount || 0),
      description: item.description || "—",
      tone: "income" as const,
    })),
    ...expenses.map((item) => ({
      id: `ex-${item.date}-${item.description}-${item.amount}`,
      date: item.date,
      vendor: item.description || "—",
      category: labelCategory(item.category || "OTHER"),
      account: item.account_code || "—",
      amount: -Number(item.amount || 0),
      vat: Number(item.vat_amount || 0),
      description: item.description || "—",
      tone: "expense" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
