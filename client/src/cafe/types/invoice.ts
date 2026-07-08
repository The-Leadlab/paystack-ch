export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
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
  CHF: "CHF",
  EUR: '€',
  USD: '$',
  GBP: '£',
  TRY: '₺',
  JPY: '¥',
};
