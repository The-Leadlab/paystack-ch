/**
 * Deterministic business CSV → FinancialData (every data row → lineItems).
 * Used by Dashboard / Documents instead of Gemini first-row collapse.
 */

import { parseCsvText } from "./revenueImport";
import { mapAiExpenseCategoryToLedger } from "./mapExpenseCategory";
import { DocumentType, type BankTransaction, type FinancialData } from "../types";

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
  const t = (raw || "").trim();
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

function findCol(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const a of aliases) {
    const i = lower.findIndex((h) => h === a || h.includes(a));
    if (i !== -1) return i;
  }
  return -1;
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return (row[idx] || "").trim();
}

function detectFlow(
  rawFlow: string,
  category: string,
  description: string,
  signedAmount: number,
  hasSignedAmountCol: boolean
): "INCOME" | "EXPENSE" {
  const f = rawFlow.toLowerCase();
  if (
    /^(in|income|revenue|credit|cr|entrée|entree|recette|sales|sale|inflow)$/i.test(f) ||
    f.includes("income") ||
    f.includes("revenue") ||
    f.includes("sales")
  ) {
    return "INCOME";
  }
  if (
    /^(out|expense|debit|dr|dépense|depense|sortie|outflow|payment|paid)$/i.test(f) ||
    f.includes("expense") ||
    f.includes("debit") ||
    f.includes("payment")
  ) {
    return "EXPENSE";
  }

  if (hasSignedAmountCol && Number.isFinite(signedAmount) && signedAmount < 0) return "EXPENSE";
  if (hasSignedAmountCol && Number.isFinite(signedAmount) && signedAmount > 0) return "INCOME";

  const blob = `${category} ${description}`.toLowerCase();
  if (
    /salary|salaire|sales|reservation|revenue|pos|z-reading|encaissement|cash in|card settlement/.test(
      blob
    )
  ) {
    return "INCOME";
  }
  if (
    /supplier|bill|payroll|rent|aligro|transgourmet|facture|invoice|purchase|achat|charges|avs/.test(
      blob
    )
  ) {
    return "EXPENSE";
  }
  return "EXPENSE";
}

function mapCategory(flow: "INCOME" | "EXPENSE", rawCat: string, description: string, supplier: string): string {
  if (flow === "INCOME") {
    const c = rawCat.toUpperCase();
    if (c.includes("RESERV")) return "RESERVATION";
    return "SALES";
  }
  return mapAiExpenseCategoryToLedger({
    expenseCategory: rawCat || description,
    issuer: supplier,
    description,
  });
}

export type BusinessCsvParseResult = {
  data: FinancialData;
  rowCount: number;
  incomeCount: number;
  expenseCount: number;
  issues: string[];
};

/** Parse a business CSV File into Bank Statement FinancialData with one lineItem per row. */
export async function parseBusinessCsvFile(
  file: File,
  targetCurrency = "CHF"
): Promise<BusinessCsvParseResult> {
  const text = await file.text();
  const matrix = parseCsvText(text);
  if (matrix.length < 2) {
    throw new Error(`CSV "${file.name}" has no data rows (need a header + at least one row).`);
  }

  const headers = matrix[0].map((h) => h.trim());
  const dateIdx = findCol(headers, ["date", "booking_date", "value_date", "transaction_date", "jour"]);
  const descIdx = findCol(headers, [
    "description",
    "desc",
    "libelle",
    "libellé",
    "memo",
    "label",
    "details",
  ]);
  const supplierIdx = findCol(headers, [
    "supplier",
    "vendor",
    "issuer",
    "merchant",
    "counterparty",
    "payee",
    "fournisseur",
  ]);
  const catIdx = findCol(headers, ["category", "cat", "expense_category", "type_cat", "account"]);
  const flowIdx = findCol(headers, [
    "flow",
    "direction",
    "side",
    "entry_type",
    "transaction_type",
    "type",
    "kind",
    "inout",
  ]);
  const amountIdx = findCol(headers, [
    "gross_chf",
    "gross",
    "amount",
    "total",
    "montant",
    "value",
    "sum",
  ]);
  const netIdx = findCol(headers, ["net_chf", "net", "ht", "amount_net"]);
  const vatIdx = findCol(headers, ["vat_chf", "vat", "tva", "tax"]);
  const debitIdx = findCol(headers, ["debit", "sortie", "outflow", "expense_amount"]);
  const creditIdx = findCol(headers, ["credit", "entrée", "entree", "inflow", "income_amount"]);
  const paymentIdx = findCol(headers, [
    "payment_method",
    "payment",
    "method",
    "tender",
    "moyen_paiement",
  ]);
  const invIdx = findCol(headers, ["invoice_number", "document_number", "reference", "ref", "n°", "no"]);
  const currencyIdx = findCol(headers, ["currency", "devise", "ccy"]);
  const notesIdx = findCol(headers, ["notes", "note", "comment", "remarks"]);

  const hasDebitCredit = debitIdx >= 0 || creditIdx >= 0;
  if (amountIdx < 0 && netIdx < 0 && !hasDebitCredit) {
    throw new Error(
      `CSV "${file.name}" needs an amount column (amount / gross_chf / net_chf / debit+credit).`
    );
  }

  const lineItems: BankTransaction[] = [];
  const issues: string[] = [];
  let incomeSum = 0;
  let expenseSum = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let firstDate = "";
  let lastDate = "";
  let firstIssuer = "";
  let currency = targetCurrency;

  for (let r = 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    if (!row.some((c) => (c || "").trim())) continue;

    const debit = debitIdx >= 0 ? parseAmount(cell(row, debitIdx)) : NaN;
    const credit = creditIdx >= 0 ? parseAmount(cell(row, creditIdx)) : NaN;
    let signed = NaN;
    let hasSignedCol = false;

    if (Number.isFinite(debit) && debit !== 0 && !(Number.isFinite(credit) && credit !== 0)) {
      signed = -Math.abs(debit);
      hasSignedCol = true;
    } else if (Number.isFinite(credit) && credit !== 0 && !(Number.isFinite(debit) && debit !== 0)) {
      signed = Math.abs(credit);
      hasSignedCol = true;
    } else {
      const gross = amountIdx >= 0 ? parseAmount(cell(row, amountIdx)) : NaN;
      const net = netIdx >= 0 ? parseAmount(cell(row, netIdx)) : NaN;
      signed = Number.isFinite(gross) && gross !== 0 ? gross : net;
    }

    if (!Number.isFinite(signed) || signed === 0) {
      issues.push(`Row ${r + 1}: skipped (no amount)`);
      continue;
    }

    const abs = Math.abs(signed);
    const date = normalizeDate(cell(row, dateIdx) || new Date().toISOString().slice(0, 10));
    const supplier = cell(row, supplierIdx);
    const description =
      cell(row, descIdx) ||
      supplier ||
      cell(row, invIdx) ||
      `CSV row ${r}`;
    const rawCat = cell(row, catIdx);
    const rawFlow = cell(row, flowIdx);
    // Prefer dedicated flow column; if `type` was mapped as flow but looks like a category, fall through
    const flowLooksLikeCategory =
      flowIdx >= 0 &&
      /^(bills|suppliers|payroll|other|food|rent|utilit)/i.test(rawFlow) &&
      !/income|expense|in|out|debit|credit/i.test(rawFlow);
    const flow = detectFlow(
      flowLooksLikeCategory ? "" : rawFlow,
      rawCat || (flowLooksLikeCategory ? rawFlow : ""),
      description,
      signed,
      hasSignedCol || (amountIdx >= 0 && signed < 0)
    );
    const category = mapCategory(
      flow,
      rawCat || (flowLooksLikeCategory ? rawFlow : ""),
      description,
      supplier
    );
    const payment = cell(row, paymentIdx);
    const inv = cell(row, invIdx);
    const extraNote = cell(row, notesIdx);
    const noteParts = [
      supplier ? `Supplier: ${supplier}` : "",
      inv ? `Ref: ${inv}` : "",
      payment ? `Payment: ${payment}` : "",
      // Keep sidecar/Firestore lean — ignore long fixture padding notes.
      extraNote && extraNote.length <= 80 ? extraNote : "",
    ].filter(Boolean);

    const vatRaw = vatIdx >= 0 ? parseAmount(cell(row, vatIdx)) : NaN;
    if (Number.isFinite(vatRaw) && vatRaw > 0) {
      noteParts.push(`VAT: ${vatRaw.toFixed(2)}`);
    }

    lineItems.push({
      date,
      description: (supplier ? `${description} — ${supplier}` : description).slice(0, 160),
      amount: abs,
      type: flow,
      category,
      notes: noteParts.join(" · ").slice(0, 160),
    });

    if (flow === "INCOME") {
      incomeSum += abs;
      incomeCount += 1;
    } else {
      expenseSum += abs;
      expenseCount += 1;
    }

    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
    if (!firstIssuer && supplier) firstIssuer = supplier;

    const rowCcy = cell(row, currencyIdx);
    if (rowCcy) currency = rowCcy.toUpperCase().slice(0, 3);
  }

  if (lineItems.length === 0) {
    throw new Error(`CSV "${file.name}" produced 0 usable rows.`);
  }

  const totalAmount = Math.round((incomeSum + expenseSum) * 100) / 100;
  const data: FinancialData = {
    documentType: DocumentType.BANK_STATEMENT,
    date: lastDate || firstDate || new Date().toISOString().slice(0, 10),
    issuer: firstIssuer || file.name.replace(/\.csv$/i, "") || "CSV import",
    documentNumber: `CSV-${lineItems.length}`,
    totalAmount,
    vatAmount: 0,
    netAmount: totalAmount,
    originalCurrency: currency || targetCurrency,
    expenseCategory: expenseCount >= incomeCount ? "OTHER" : "SALES",
    amountInCHF: totalAmount,
    conversionRateUsed: 1,
    notes: `Imported ${lineItems.length} CSV rows (${incomeCount} income, ${expenseCount} expense).`,
    lineItems,
    openingBalance: 0,
    calculatedTotalIncome: Math.round(incomeSum * 100) / 100,
    calculatedTotalExpense: Math.round(expenseSum * 100) / 100,
    finalBalance: Math.round((incomeSum - expenseSum) * 100) / 100,
    aiInterpretation: `Deterministic CSV parse: ${lineItems.length} transactions from ${file.name} (${firstDate} → ${lastDate}).`,
    forensicAlerts:
      issues.length > 0
        ? [`Skipped ${issues.length} incomplete row(s) during CSV import.`]
        : undefined,
  };

  return {
    data,
    rowCount: lineItems.length,
    incomeCount,
    expenseCount,
    issues,
  };
}
