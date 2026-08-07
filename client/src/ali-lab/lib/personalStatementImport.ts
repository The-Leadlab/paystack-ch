/** Personal bank-statement CSV/PDF → draft rows (not restaurant Revenue). */

import { parseCsvText } from "@/cafe/lib/revenueImport";
import { analyzeBankStatement, analyzeFinancialDocument } from "@/cafe/services/geminiService";
import {
  PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES,
  type PersonalExpenseCategory,
  type PersonalIncomeCategory,
} from "../personalCategories";
import { PERSONAL_STATEMENT_IMAGE_HINT } from "./personalSwissTaxAi";

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
  source: "csv" | "pdf" | "image";
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

function totalsFromRows(rows: PersonalStatementDraft[]): { income: number; expense: number } {
  return rows.reduce(
    (acc, row) => {
      if (row.kind === "income") acc.income += row.amount;
      else acc.expense += row.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
}

/** Best-effort text pull from simple text PDFs (Tj / TJ operators). */
export async function extractPdfTextRough(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];

  const tjRe = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  for (const m of raw.matchAll(tjRe)) {
    const inner = m[0].replace(/\s*Tj$/, "").slice(1, -1);
    chunks.push(
      inner
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
    );
  }

  const tjArrayRe = /\[(.*?)\]\s*TJ/gs;
  for (const m of raw.matchAll(tjArrayRe)) {
    const parts = m[1].match(/\((?:\\.|[^\\)])*\)/g) || [];
    for (const p of parts) {
      chunks.push(
        p
          .slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\")
      );
    }
  }

  return chunks.join("\n");
}

/** Parse Swiss/EU bank lines: `01.07.2026  Migros ...  -86.40` or ISO + amount. */
export function parsePersonalStatementPlainText(text: string, fileName: string): PersonalStatementPreview {
  const issues: string[] = [];
  const rows: PersonalStatementDraft[] = [];
  const seen = new Set<string>();

  const lineRe =
    /(?:^|\n)\s*(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\d{1,7}(?:[',]\d{3})*(?:[.,]\d{1,2})?)\s*(?=\n|$)/g;

  for (const m of text.matchAll(lineRe)) {
    const dateRaw = m[1];
    let description = m[2].replace(/\s+/g, " ").trim();
    // Drop header-ish fragments
    if (/^(date|description|amount|datum|libell|period|currency|account)\b/i.test(description)) continue;
    if (/^-{2,}/.test(description)) continue;

    const amt = parseAmount(m[3]);
    if (!Number.isFinite(amt) || amt === 0) continue;
    const draft = draftFromParts(dateRaw, description, amt);
    if (!draft) continue;
    const key = `${draft.date}|${draft.description}|${draft.amount}|${draft.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(draft);
  }

  // CSV-like rows embedded in text
  if (!rows.length) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.includes(",")) continue;
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 3) continue;
      if (/^date$/i.test(parts[0])) continue;
      const amt = parseAmount(parts[parts.length - 1]);
      if (!Number.isFinite(amt) || amt === 0) continue;
      const draft = draftFromParts(parts[0], parts.slice(1, -1).join(" "), amt);
      if (draft) rows.push(draft);
    }
  }

  if (!rows.length) {
    issues.push("Could not read transaction lines from PDF text. Try CSV export or a clearer statement.");
  }

  return {
    fileName,
    source: "pdf",
    rows,
    issues,
    totals: totalsFromRows(rows),
  };
}

function draftsFromBankAnalysis(
  fileName: string,
  analysis: { transactions?: Array<{ date?: string; description?: string; amount: number; type?: string }> }
): PersonalStatementPreview {
  const rows: PersonalStatementDraft[] = [];
  for (const tx of analysis.transactions || []) {
    const kind = tx.type === "INCOME" ? "income" : "expense";
    const signed = kind === "expense" ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    const draft = draftFromParts(tx.date || "", tx.description || "", signed, kind);
    if (draft) rows.push(draft);
  }
  return {
    fileName,
    source: "pdf",
    rows,
    issues: rows.length ? [] : ["No transactions extracted from PDF."],
    totals: totalsFromRows(rows),
  };
}

/** Dominant YYYY-MM from draft rows (for month picker jump after import). */
export function dominantMonthFromDrafts(drafts: PersonalStatementDraft[]): string | null {
  const counts = new Map<string, number>();
  for (const d of drafts) {
    if (!/^\d{4}-\d{2}/.test(d.date)) continue;
    const key = d.date.slice(0, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

export async function parsePersonalStatementFile(file: File): Promise<PersonalStatementPreview> {
  const name = file.name || "statement";
  const lower = name.toLowerCase();

  if (lower.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
    const text = await file.text();
    return parsePersonalStatementCsv(text, name);
  }

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    const issues: string[] = [];
    let aiPreview: PersonalStatementPreview | null = null;

    try {
      const analysis = await analyzeBankStatement(file, "CHF", undefined, { preferInline: true });
      aiPreview = draftsFromBankAnalysis(name, analysis);
      if (aiPreview.rows.length) return aiPreview;
      issues.push(...(aiPreview.issues.length ? aiPreview.issues : ["AI returned no transactions."]));
    } catch (e) {
      issues.push(e instanceof Error ? e.message : String(e));
    }

    try {
      const text = await extractPdfTextRough(file);
      const textPreview = parsePersonalStatementPlainText(text, name);
      if (textPreview.rows.length) {
        return {
          ...textPreview,
          issues: [
            ...issues.map((i) => `AI: ${i}`),
            "Used on-device PDF text extraction (AI empty or unavailable).",
          ],
        };
      }
      issues.push(...textPreview.issues);
    } catch (e) {
      issues.push(`PDF text extract: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      fileName: name,
      source: "pdf",
      rows: [],
      issues: issues.length
        ? issues
        : ["No transactions found. Upload a CSV bank export or a text-based PDF."],
      totals: { income: 0, expense: 0 },
    };
  }

  if (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|heic)$/i.test(lower)
  ) {
    try {
      const data = await analyzeFinancialDocument(file, "CHF", PERSONAL_STATEMENT_IMAGE_HINT);
      const rows: PersonalStatementDraft[] = [];
      if (data.lineItems?.length) {
        for (const item of data.lineItems) {
          const kind = item.type === "INCOME" ? "income" : "expense";
          const signed = kind === "expense" ? -Math.abs(item.amount) : Math.abs(item.amount);
          const draft = draftFromParts(item.date || data.date || "", item.description || data.issuer || "", signed, kind);
          if (draft) rows.push(draft);
        }
      } else if ((data.amountInCHF || data.totalAmount || 0) > 0) {
        const amount = data.amountInCHF || data.totalAmount || 0;
        const isIncome =
          data.documentType === "Pay Slip" ||
          (data.expenseCategory || "").toUpperCase().includes("REVENUE") ||
          (data.expenseCategory || "").toUpperCase().includes("SALARY");
        const signed = isIncome ? Math.abs(amount) : -Math.abs(amount);
        const draft = draftFromParts(
          data.date || "",
          data.issuer || data.notes || name,
          signed,
          isIncome ? "income" : "expense"
        );
        if (draft) rows.push(draft);
      }
      return {
        fileName: name,
        source: "image",
        rows,
        issues: rows.length ? [] : ["No amounts found in this photo. Try a clearer shot or a CSV export."],
        totals: totalsFromRows(rows),
      };
    } catch (e) {
      return {
        fileName: name,
        source: "image",
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
    issues: ["Supported formats: CSV, PDF, or a photo of your statement/receipt."],
    totals: { income: 0, expense: 0 },
  };
}

export function personalStatementTemplateCsv(): string {
  return [
    "date,description,amount",
    "2026-07-01,Salary ACME SA,5200.00",
    "2026-07-03,Migros groceries,-86.40",
    "2026-07-05,Swisscom bill,-69.90",
    "2026-07-10,Rent loft Geneva,-1850.00",
    "2026-08-01,Salary ACME SA,5200.00",
    "2026-08-04,Coop Lausanne,-92.10",
    "2026-08-08,Swisscom bill,-69.90",
    "2026-08-10,Rent loft Geneva,-1850.00",
    "2026-08-15,Dividend Swissquote,95.00",
  ].join("\n");
}
