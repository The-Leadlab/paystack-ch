import type { InvoiceData } from '../types/invoice';
import { DocumentType, type BankTransaction, type FinancialData, type SwissVatRateLine } from '../types';
import { applyInvoiceTotals } from './invoiceTotals';

/** Our invoice to a client → dashboard income. Supplier/client invoice to us → expense. */
export type InvoiceLedgerDirection = 'outgoing' | 'incoming';

export function invoiceFileName(invoice: InvoiceData): string {
  const party =
    invoice.direction === 'incoming'
      ? invoice.clientCompany || invoice.clientName || 'Supplier'
      : invoice.clientCompany || invoice.clientName || 'Client';
  const safe = String(party)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim()
    .slice(0, 48);
  return `Invoice ${invoice.invoiceNumber} — ${safe || 'draft'}.pdf`;
}

/**
 * Map Invoice Maker data into FinancialData so Documents / Verification / ledger
 * stay in sync without re-running Gemini on numbers the user already entered.
 */
export function invoiceToFinancialData(
  raw: InvoiceData,
  opts?: { sourceNotice?: string }
): FinancialData {
  const invoice = applyInvoiceTotals(raw);
  const direction: InvoiceLedgerDirection = invoice.direction === 'incoming' ? 'incoming' : 'outgoing';
  const isOutgoing = direction === 'outgoing';
  const flow = isOutgoing ? ('INCOME' as const) : ('EXPENSE' as const);

  const ourName = invoice.companyName.trim() || 'Paystack.ch';
  const theirName =
    (invoice.clientCompany || invoice.clientName || '').trim() ||
    (isOutgoing ? 'Client' : 'Supplier');

  const issuer = isOutgoing ? ourName : theirName;
  const recipient = isOutgoing ? theirName : ourName;

  const lineItems: BankTransaction[] = invoice.items.map((item) => ({
    date: invoice.date,
    description: item.description || 'Item',
    amount: Number(item.total) || 0,
    type: flow,
    category: isOutgoing ? 'SALES' : 'SUPPLIERS',
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    notes:
      item.discountAmount > 0
        ? `Discount ${item.discountAmount.toFixed(2)} · VAT ${item.taxRate}%`
        : `VAT ${item.taxRate}%`,
  }));

  const swissVatBreakdown: SwissVatRateLine[] | undefined =
    invoice.vatBreakdown && invoice.vatBreakdown.length > 0
      ? invoice.vatBreakdown.map((line) => ({
          ratePercent: line.ratePercent,
          baseExclusive: line.baseAmount,
          vatAmount: line.vatAmount,
        }))
      : undefined;

  const sourceNotice =
    opts?.sourceNotice ||
    'Created from the Invoice tab — review lines in Verification Center if needed.';

  const currency = (invoice.currency || 'CHF').toUpperCase();
  const total = Number(invoice.total) || 0;
  const vat = Number(invoice.taxAmount) || 0;
  const net = Number(invoice.subtotal) || Math.max(0, total - vat);

  return {
    documentType: DocumentType.INVOICE,
    date: invoice.date || new Date().toISOString().slice(0, 10),
    issuer,
    recipient,
    documentNumber: invoice.invoiceNumber,
    totalAmount: total,
    originalCurrency: currency,
    vatAmount: vat,
    netAmount: net,
    vatRate: invoice.taxRate,
    vatConfirmed: true,
    expenseCategory: isOutgoing ? 'SALES' : 'SUPPLIERS',
    amountInCHF: total,
    conversionRateUsed: 1,
    notes: [invoice.notes, sourceNotice].filter(Boolean).join('\n\n'),
    lineItems,
    swissVatBreakdown,
    aiInterpretation: sourceNotice,
    confidenceScore: 1,
    isHumanVerified: false,
    userFlowOverride: flow,
    uploadIntent: isOutgoing ? 'revenue' : 'expense',
    aiFlowHint: flow,
    sourceFileName: invoiceFileName(invoice),
  };
}
