export type ReportIncomeRow = {
  id?: string;
  date: string;
  amount: number;
  vat_amount?: number;
  description?: string;
  type?: string;
  account_code?: string;
  document_id?: string;
};

export type ReportExpenseRow = {
  id?: string;
  date: string;
  amount: number;
  vat_amount?: number;
  description?: string;
  category?: string;
  account_code?: string;
  document_id?: string;
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
  const supplierCats = new Set([
    "SUPPLIERS",
    "FOOD_SUPPLIES",
    "BEVERAGES",
    "RESTAURANT_SUPPLIES",
    "PACKAGING",
    "CLEANING",
  ]);

  for (const item of expenses) {
    if (!supplierCats.has(String(item.category || ""))) continue;
    const supplier = canonicalizeSupplierKey(item.description, unknownLabel);
    suppliers[supplier] = (suppliers[supplier] || 0) + Number(item.amount || 0);
  }

  return Object.entries(suppliers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

/** Shared light canonicalization (kept in shared/ for Node report exports). */
function canonicalizeSupplierKey(raw: string | undefined, unknownLabel: string): string {
  let s = (raw || "").trim();
  if (!s) return unknownLabel;
  s = s.replace(/\s*\|\s*.*$/, "");
  s = s.replace(/\s*[-–—]\s*(ref\.?|n[°o]?|nr\.?|facture|invoice|beleg)\s*[:#]?\s*[\w./-]+$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  const upper = s.toUpperCase();
  if (/\b(TALIGRO|ALIGRO|DEMAUREX)\b/.test(upper)) return "TALIGRO DEMAUREX & CIE SA";
  if (/\bTRANSGOURMET\b/.test(upper)) return "TRANSGOURMET";
  if (/\bPRODEGA\b/.test(upper)) return "PRODEGA";
  if (/\bMIGROS\b/.test(upper)) return "MIGROS";
  if (/\bCOOP\b/.test(upper)) return "COOP";
  if (/\bSWISSCOM\b/.test(upper)) return "SWISSCOM";
  const stripped = upper
    .replace(/\b(S\.?\s*A\.?|SA|SÀRL|SARL|AG|GMBH|LTD|LLC|INC)\b\.?/g, "")
    .replace(/[&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length >= 3) {
    return stripped
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
  }
  return s || unknownLabel;
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
  documentId?: string;
};

export function buildLedgerRows(
  income: ReportIncomeRow[],
  expenses: ReportExpenseRow[],
  labelCategory: (category: string) => string,
  labelIncomeType: (type: string) => string
): LedgerRow[] {
  return [
    ...income.map((item, idx) => ({
      id: item.id ? `in-${item.id}` : `in-${item.date}-${item.description}-${item.amount}-${idx}`,
      date: item.date,
      vendor: canonicalizeSupplierKey(item.description, "—"),
      category: labelIncomeType(item.type || "SALES"),
      account: item.account_code || "—",
      amount: Number(item.amount || 0),
      vat: Number(item.vat_amount || 0),
      description: item.description || "—",
      tone: "income" as const,
      documentId: item.document_id || undefined,
    })),
    ...expenses.map((item, idx) => ({
      id: item.id ? `ex-${item.id}` : `ex-${item.date}-${item.description}-${item.amount}-${idx}`,
      date: item.date,
      vendor: canonicalizeSupplierKey(item.description, "—"),
      category: labelCategory(item.category || "OTHER"),
      account: item.account_code || "—",
      amount: -Number(item.amount || 0),
      vat: Number(item.vat_amount || 0),
      description: item.description || "—",
      tone: "expense" as const,
      documentId: item.document_id || undefined,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
