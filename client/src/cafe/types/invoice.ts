export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Per-line discount (subtracted before VAT). */
  discountAmount: number;
  /** Per-line VAT rate (%). */
  taxRate: number;
  /** Line net total (HT, after discount) — computed. */
  total: number;
}

export interface InvoiceVatBreakdownLine {
  ratePercent: number;
  baseAmount: number;
  vatAmount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  /** Default VAT % for new lines + bulk "apply to all". */
  taxRate: number;
  taxAmount: number;
  /** Optional invoice-wide discount applied after VAT (legacy / extra). */
  discountAmount: number;
  vatBreakdown?: InvoiceVatBreakdownLine[];
  total: number;
  currency: string;
  currencySymbol: string;
  notes: string;
  terms: string;
  paymentTerms: string;
  createdAt?: string;
  updatedAt?: string;
}

export const INVOICE_CURRENCY_SYMBOLS: Record<string, string> = {
  CHF: 'CHF',
  EUR: '€',
  USD: '$',
  GBP: '£',
  TRY: '₺',
  JPY: '¥',
};
