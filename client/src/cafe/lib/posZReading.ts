import type { FinancialData } from "../types";

export const Z_READING_AI_HINT = `This is a Swiss restaurant POS end-of-day Z-reading (Z-Bon / clôture caisse).
Extract: gross sales (TTC), net sales (HT), total VAT, cash (espèces), card (carte/carte de crédit), TWINT/other payments, tips, discounts, refunds, and business date.
Use swissVatReceiptTotals when printed. Payment method lines belong in lineItems with clear descriptions (Cash, Card, TWINT, etc.).`;

export type ZReadingDraft = {
  date: string;
  gross_sales: number;
  net_sales: number;
  vat_amount: number;
  cash: number;
  card: number;
  other_payment: number;
  tips: number;
  discounts: number;
  refunds: number;
  notes: string;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function matchPaymentAmount(
  lineItems: FinancialData["lineItems"],
  patterns: RegExp[]
): number {
  if (!lineItems?.length) return 0;
  for (const item of lineItems) {
    const desc = `${item.description || ""} ${item.category || ""}`.toLowerCase();
    if (patterns.some((p) => p.test(desc))) return Math.abs(num(item.amount));
  }
  return 0;
}

export function parseZReadingFromFinancialData(
  result: FinancialData,
  fallbackDate: string
): ZReadingDraft {
  const receipt = result.swissVatReceiptTotals;
  const gross =
    num(receipt?.totalInclVat) ||
    num(result.totalAmount) ||
    num(result.calculatedTotalIncome);
  const vat =
    num(receipt?.vatTotal) ||
    num(result.vatAmount) ||
    (result.swissVatBreakdown?.reduce((s, row) => s + num(row.vatAmount), 0) ?? 0);
  const net =
    num(receipt?.merchandiseSubtotal) ||
    num(result.netAmount) ||
    (gross > 0 && vat > 0 ? gross - vat : gross);

  let cash = matchPaymentAmount(result.lineItems, [
    /\bcash\b/,
    /\besp[eè]ces\b/,
    /\bbar\b/,
    /\bliquide\b/,
  ]);
  let card = matchPaymentAmount(result.lineItems, [
    /\bcard\b/,
    /\bcarte\b/,
    /\bvisa\b/,
    /\bmastercard\b/,
    /\bpostfinance\b/,
    /\bdebit\b/,
  ]);
  let other = matchPaymentAmount(result.lineItems, [
    /\btwint\b/,
    /\bother\b/,
    /\bautre\b/,
    /\bvoucher\b/,
    /\bbon\b/,
  ]);

  const paymentTotal = cash + card + other;
  if (gross > 0 && paymentTotal <= 0) {
    cash = gross * 0.4;
    card = gross * 0.6;
  } else if (gross > 0 && paymentTotal > 0 && Math.abs(paymentTotal - gross) > 0.05) {
    const scale = gross / paymentTotal;
    cash *= scale;
    card *= scale;
    other *= scale;
  }

  const tips = matchPaymentAmount(result.lineItems, [/\btip\b/, /\bpourboire\b/, /\btrinkgeld\b/]);
  const discounts = matchPaymentAmount(result.lineItems, [/\bdiscount\b/, /\brabais\b/, /\bremise\b/]);
  const refunds = matchPaymentAmount(result.lineItems, [/\brefund\b/, /\bremboursement\b/]);

  return {
    date: result.date || fallbackDate,
    gross_sales: round2(gross),
    net_sales: round2(net),
    vat_amount: round2(vat),
    cash: round2(cash),
    card: round2(card),
    other_payment: round2(other),
    tips: round2(tips),
    discounts: round2(discounts),
    refunds: round2(refunds),
    notes: result.notes || result.aiInterpretation || "",
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
