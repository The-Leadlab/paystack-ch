import type { InvoiceData } from '../types/invoice';

const STORAGE_PREFIX = 'paystack_invoices';

export function invoiceStorageKey(userId: string | undefined): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : `${STORAGE_PREFIX}_guest`;
}

export function loadSavedInvoices(userId: string | undefined): InvoiceData[] {
  try {
    const raw = localStorage.getItem(invoiceStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InvoiceData[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistInvoices(userId: string | undefined, invoices: InvoiceData[]): void {
  localStorage.setItem(invoiceStorageKey(userId), JSON.stringify(invoices));
}

export function upsertInvoice(userId: string | undefined, invoice: InvoiceData): InvoiceData[] {
  const saved = loadSavedInvoices(userId);
  const idx = saved.findIndex((inv) => inv.invoiceNumber === invoice.invoiceNumber);
  const stamped = { ...invoice, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    saved[idx] = { ...stamped, createdAt: saved[idx].createdAt ?? stamped.updatedAt };
  } else {
    saved.push({ ...stamped, createdAt: new Date().toISOString() });
  }
  persistInvoices(userId, saved);
  return saved;
}
