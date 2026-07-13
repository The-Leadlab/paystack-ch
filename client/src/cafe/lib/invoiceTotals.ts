import { DEFAULT_SWISS_VAT_RATE } from '@shared/swissVatRates';
import type { InvoiceData, InvoiceItem, InvoiceVatBreakdownLine } from '../types/invoice';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ComputedLine = {
  lineGross: number;
  lineDiscount: number;
  lineNet: number;
  lineVat: number;
  lineTotalInclVat: number;
};

/** VAT is calculated on the line net amount (after per-line discount). */
export function computeLineTotals(
  item: Pick<InvoiceItem, 'quantity' | 'unitPrice' | 'discountAmount' | 'taxRate'>
): ComputedLine {
  const lineGross = round2(Number(item.quantity) * Number(item.unitPrice));
  const lineDiscount = round2(Math.min(Math.max(0, Number(item.discountAmount) || 0), lineGross));
  const lineNet = round2(lineGross - lineDiscount);
  const lineVat = round2(lineNet * (Number(item.taxRate) || 0) / 100);
  const lineTotalInclVat = round2(lineNet + lineVat);
  return { lineGross, lineDiscount, lineNet, lineVat, lineTotalInclVat };
}

export function normalizeInvoiceItem(item: InvoiceItem, defaultTaxRate = DEFAULT_SWISS_VAT_RATE): InvoiceItem {
  const taxRate = typeof item.taxRate === 'number' ? item.taxRate : defaultTaxRate;
  const discountAmount = typeof item.discountAmount === 'number' ? item.discountAmount : 0;
  const { lineNet } = computeLineTotals({ ...item, taxRate, discountAmount });
  return { ...item, taxRate, discountAmount, total: lineNet };
}

export function normalizeInvoice(invoice: InvoiceData): InvoiceData {
  const defaultTaxRate = typeof invoice.taxRate === 'number' ? invoice.taxRate : DEFAULT_SWISS_VAT_RATE;
  const items = invoice.items.map((item) => normalizeInvoiceItem(item, defaultTaxRate));
  return applyInvoiceTotals({ ...invoice, items });
}

export function applyInvoiceTotals(invoice: InvoiceData): InvoiceData {
  const items = invoice.items.map((item) => {
    const normalized = normalizeInvoiceItem(item, invoice.taxRate);
    const { lineNet } = computeLineTotals(normalized);
    return { ...normalized, total: lineNet };
  });

  let subtotal = 0;
  let taxAmount = 0;
  const breakdownMap = new Map<number, { baseAmount: number; vatAmount: number }>();

  for (const item of items) {
    const line = computeLineTotals(item);
    subtotal += line.lineNet;
    taxAmount += line.lineVat;
    const rate = Number(item.taxRate) || 0;
    const bucket = breakdownMap.get(rate) ?? { baseAmount: 0, vatAmount: 0 };
    bucket.baseAmount += line.lineNet;
    bucket.vatAmount += line.lineVat;
    breakdownMap.set(rate, bucket);
  }

  subtotal = round2(subtotal);
  taxAmount = round2(taxAmount);
  const invoiceDiscount = round2(Math.max(0, Number(invoice.discountAmount) || 0));
  const total = round2(Math.max(0, subtotal + taxAmount - invoiceDiscount));

  const vatBreakdown: InvoiceVatBreakdownLine[] = Array.from(breakdownMap.entries())
    .filter(([, v]) => v.baseAmount > 0 || v.vatAmount > 0)
    .sort(([a], [b]) => a - b)
    .map(([ratePercent, v]) => ({
      ratePercent,
      baseAmount: round2(v.baseAmount),
      vatAmount: round2(v.vatAmount),
    }));

  return {
    ...invoice,
    items,
    subtotal,
    taxAmount,
    total,
    vatBreakdown,
  };
}
