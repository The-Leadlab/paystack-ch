/** Personal bank-statement CSV/PDF → draft rows (not restaurant Revenue). */

import { parseCsvText } from "@/cafe/lib/revenueImport";
import { analyzeBankStatement } from "@/cafe/services/geminiService";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../personalCategories";

export type PersonalStatementDraft = {
  id: string;
  date: string;
  description: string;
  amount: number;
  kind: "income" | "expense";
  expenseCat: PersonalExpenseCategory;
  incomeCat: PersonalIncomeCategory;
  selected: boolean;
};

export type PersonalStatementPreview = {
  fileName: string;
  source: "csv" | "pdf";
  rows: PersonalStatementDraft[];
  issues: string[];
  totals: { income: number; expense: number };
};

const EXPENSE_KEYWORDS: Record<PersonalExpenseCategory, string[]> = {
  BILLS: ["bill", "swisscom", "sunrise", "salt", "serafe", "insurance", "electric", "gas", "water", "internet", "krankenkasse", "facture", "rechnung"],
  RENT: ["rent", "loyer", "miete", "mortgage", "hypothek", "housing"],
  GROCERIES: ["migros", "coop", "denner", "aldi", "lidl", "grocery", "supermarket", "épicerie"],
  GOING_OUT: ["restaurant", "bar", "cafe", "café", "cinema", "uber", "deliveroo", "sortie", "concert", "gym"],
  SHOPPING_OTHER: ["amazon", "zalando", "shopping", "ikea", "decathlon"],
  SAVINGS_INVEST: ["savings", "invest", "etf", "pillar", "3a", "swissquote", "viac", "frankly", "depot"],
};

const INCOME_KEYWORDS: Record<PersonalIncomeCategory, string[]> = {
  SALARY: ["salary", "salaire", "lohn", "wage", "payroll", "gehalt"],
  ASSET_REVENUE: ["dividend", "interest", "rental", "coupon", "portfolio"],
  CONTRIBUTIONS: ["gift", "contribution", "family", "cadeau", "allowance", "apport"],
};

function uid(): string {
  return `pst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseAmount(raw: string): number {
  if (!raw?.trim()) return NaN;
  let t = raw.trim();
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[^\d.,\-]/g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (t.includes(",") && !t.includes(".")) {
    t = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  }
  const n = parseFloat(t);
  return neg ? -n : n;
}

function normalizeDate(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const dmY = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (dmY) {
    const d = dmY[1].padStart(2, "0");
    const m = dmY[2].padStart(2, "0");
    let y = dmY[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function guessExpenseCat(text: string): PersonalExpenseCategory {
  const lower = text.toLowerCase();
  for (const cat of PERSONAL_EXPENSE_CATEGORIES) {
    if (EXPENSE_KEYWORDS[cat].some((k) => lower.includes(k))) return cat;
  }
  return "SHOPPING_OTHER";
}

function guessIncomeCat(text: string): PersonalIncomeCategory {
  const lower = text.toLowerCase();
  for (const cat of PERSONAL_INCOME_CATEGORIES) {
    if (INCOME_KEYWORDS[cat].some((k) => lower.includes(k))) return cat;
  }
  return "SALARY";
}

function findCol(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const a of aliases) {
    const i = lower.findIndex((h) => h === a || h.includes(a));
    if (i !== -1) return i;
  }
  return -1;
}

function draftFromParts(
  date: string,
  description: string,
  signedAmount: number,
  forcedKind?: "income" | "expense"
): PersonalStatementDraft | null {
  const abs = Math.abs(signedAmount);
  if (!Number.isFinite(abs) || abs <= 0) return null;
  const kind =
    forcedKind ??
    (signedAmount < 0 ? "expense" : "income");
  return {
    id: uid(),
    date: normalizeDate(date),
    description: description.trim() || "Bank transaction",
    amount: abs,
    kind,
    expenseCat: guessExpenseCat(description),
    incomeCat: guessIncomeCat(description),
    selected: true,
  };
}

export function parsePersonalStatementCsv(text: string, fileName: string): PersonalStatementPreview {
  const matrix = parseCsvText(text);
  const issues: string[] = [];
  if (matrix.length < 2) {
    return {
      fileName,
      source: "csv",
      rows: [],
      issues: ["CSV needs a header row and at least one data row."],
      totals: { income: 0, expense: 0 },
    };
  }

  const headers = matrix[0];
  const dateIdx = findCol(headers, ["date", "booking", "value date", "datum", "date comptable"]);
  const descIdx = findCol(headers, ["description", "desc", "libelle", "libellé", "text", "memo", "booking text", "label"]);
  const amountIdx = findCol(headers, ["amount", "montant", "betrag", "value"]);
  const debitIdx = findCol(headers, ["debit", "withdrawal", "sortie", "débit"]);
  const creditIdx = findCol(headers, ["credit", "deposit", "entrée", "crédit"]);

  if (descIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1)) {
    issues.push("Could not map description + amount (or debit/credit) columns.");
  }

  const rows: PersonalStatementDraft[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    const description = descIdx >= 0 ? row[descIdx] || "" : "";
    const date = dateIdx >= 0 ? row[dateIdx] || "" : new Date().toISOString().slice(0, 10);

    let draft: PersonalStatementDraft | null = null;
    if (amountIdx >= 0) {
      const amt = parseAmount(row[amountIdx] || "");
      draft = draftFromParts(date, description, amt);
    } else {
      const debit = debitIdx >= 0 ? parseAmount(row[debitIdx] || "") : 0;
      const credit = creditIdx >= 0 ? parseAmount(row[creditIdx] || "") : 0;
      if (Number.isFinite(debit) && debit > 0) draft = draftFromParts(date, description, -debit, "expense");
      else if (Number.isFinite(credit) && credit > 0) draft = draftFromParts(date, description, credit, "income");
    }

    if (!draft) {
      issues.push(`Row ${r + 1}: skipped (invalid amount).`);
      continue;
    }
    rows.push(draft);
  }

  const totals = rows.reduce(
    (acc, row) => {
      if (row.kind === "income") acc.income += row.amount;
      else acc.expense += row.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return { fileName, source: "csv", rows, issues, totals };
}

export async function parsePersonalStatementFile(file: File): Promise<PersonalStatementPreview> {
  const name = file.name || "statement";
  const lower = name.toLowerCase();

  if (lower.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
    const text = await file.text();
    return parsePersonalStatementCsv(text, name);
  }

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    try {
      const analysis = await analyzeBankStatement(file, "CHF");
      const rows: PersonalStatementDraft[] = [];
      for (const tx of analysis.transactions || []) {
        const kind = tx.type === "INCOME" ? "income" : "expense";
        const signed = kind === "expense" ? -Math.abs(tx.amount) : Math.abs(tx.amount);
        const draft = draftFromParts(tx.date || "", tx.description || "", signed, kind);
        if (draft) rows.push(draft);
      }
      const totals = rows.reduce(
        (acc, row) => {
          if (row.kind === "income") acc.income += row.amount;
          else acc.expense += row.amount;
          return acc;
        },
        { income: 0, expense: 0 }
      );
      return {
        fileName: name,
        source: "pdf",
        rows,
        issues: rows.length ? [] : ["No transactions extracted from PDF."],
        totals,
      };
    } catch (e) {
      return {
        fileName: name,
        source: "pdf",
        rows: [],
        issues: [e instanceof Error ? e.message : String(e)],
        totals: { income: 0, expense: 0 },
      };
    }
  }

  return {
    fileName: name,
    source: "csv",
    rows: [],
    issues: ["Supported formats: CSV or PDF bank statement."],
    totals: { income: 0, expense: 0 },
  };
}

export function personalStatementTemplateCsv(): string {
  return [
    "date,description,amount",
    "2026-07-01,Salary ACME,5200.00",
    "2026-07-03,Migros groceries,-86.40",
    "2026-07-05,Swisscom bill,-69.90",
    "2026-07-10,Rent loft,-1850.00",
  ].join("\n");
}
