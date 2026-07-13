import { describe, expect, it } from 'vitest';
import { applyInvoiceTotals, computeLineTotals } from '../client/src/cafe/lib/invoiceTotals';
import type { InvoiceData, InvoiceItem } from '../client/src/cafe/types/invoice';

function line(partial: Partial<InvoiceItem> & Pick<InvoiceItem, 'quantity' | 'unitPrice'>): InvoiceItem {
  return {
    id: '1',
    description: 'Item',
    discountAmount: 0,
    taxRate: 8.1,
    total: 0,
    ...partial,
  };
}

describe('invoiceTotals', () => {
  it('computes VAT on post-discount line net', () => {
    const result = computeLineTotals({
      quantity: 2,
      unitPrice: 100,
      discountAmount: 20,
      taxRate: 8.1,
    });
    expect(result.lineGross).toBe(200);
    expect(result.lineDiscount).toBe(20);
    expect(result.lineNet).toBe(180);
    expect(result.lineVat).toBe(14.58);
    expect(result.lineTotalInclVat).toBe(194.58);
  });

  it('aggregates mixed VAT rates', () => {
    const invoice: InvoiceData = {
      invoiceNumber: 'INV-1',
      date: '2026-01-01',
      dueDate: '2026-01-31',
      status: 'draft',
      companyName: 'Co',
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyWebsite: '',
      clientName: 'Client',
      clientCompany: '',
      clientAddress: '',
      clientPhone: '',
      clientEmail: '',
      items: [
        line({ id: 'a', quantity: 1, unitPrice: 100, taxRate: 8.1 }),
        line({ id: 'b', quantity: 1, unitPrice: 50, taxRate: 2.6, discountAmount: 10 }),
      ],
      subtotal: 0,
      taxRate: 8.1,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      currency: 'CHF',
      currencySymbol: 'CHF',
      notes: '',
      terms: '',
      paymentTerms: 'Net 30',
    };

    const out = applyInvoiceTotals(invoice);
    expect(out.subtotal).toBe(140);
    expect(out.taxAmount).toBe(9.14);
    expect(out.total).toBe(149.14);
    expect(out.vatBreakdown).toHaveLength(2);
  });
});
