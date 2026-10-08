import type { BankTransaction, FinancialData, ProcessedDocument } from '../types';

export type DocumentProductLine = {
  documentId: string;
  fileName: string;
  issuer: string;
  invoiceLabel: string;
  date: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  type: string;
  category: string;
};

function isLikelyRollupOnly(items: BankTransaction[], invoiceCount: number): boolean {
  if (invoiceCount <= 1) return false;
  // Top-level lineItems that match invoice count are usually one rollup row per invoice.
  return items.length > 0 && items.length <= invoiceCount && items.every((i) => !i.quantity && !i.unitPrice);
}

/**
 * Collect product/service lines from a processed document for reports and dashboard preview.
 * Prefers nested `subDocuments[].lineItems` for multi-invoice PDFs.
 */
export function collectProductLinesFromFinancialData(
  data: FinancialData | undefined,
  meta: { documentId: string; fileName: string }
): DocumentProductLine[] {
  if (!data) return [];
  const subs = Array.isArray(data.subDocuments) ? data.subDocuments.filter(Boolean) : [];
  const rows: DocumentProductLine[] = [];

  if (subs.length > 0) {
    subs.forEach((sub, idx) => {
      const nested = Array.isArray(sub.lineItems) ? sub.lineItems : [];
      const issuer = String(sub.issuer || data.issuer || '').trim() || '—';
      const invoiceLabel = `Invoice ${idx + 1}`;
      if (nested.length > 0) {
        for (const item of nested) {
          const amount = Number(item.amount) || 0;
          if (!item.description && amount === 0) continue;
          rows.push({
            documentId: meta.documentId,
            fileName: meta.fileName,
            issuer,
            invoiceLabel,
            date: item.date || sub.date || data.date || '',
            description: String(item.description || '').trim() || '—',
            quantity: item.quantity != null && Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
            unitPrice:
              item.unitPrice != null && Number.isFinite(Number(item.unitPrice))
                ? Number(item.unitPrice)
                : null,
            amount,
            type: String(item.type || ''),
            category: String(item.category || sub.expenseCategory || data.expenseCategory || ''),
          });
        }
      } else {
        // No nested products — still emit one row for the invoice total so reports aren't empty.
        const amount = Number(sub.amountInCHF ?? sub.totalAmount ?? 0) || 0;
        if (amount > 0 || sub.issuer) {
          rows.push({
            documentId: meta.documentId,
            fileName: meta.fileName,
            issuer,
            invoiceLabel,
            date: sub.date || data.date || '',
            description: String(sub.notes || sub.issuer || invoiceLabel).trim() || invoiceLabel,
            quantity: null,
            unitPrice: null,
            amount,
            type: 'INCOME',
            category: String(sub.expenseCategory || data.expenseCategory || ''),
          });
        }
      }
    });
    return rows;
  }

  const top = Array.isArray(data.lineItems) ? data.lineItems : [];
  const issuer = String(data.issuer || '').trim() || '—';
  for (const item of top) {
    const amount = Number(item.amount) || 0;
    if (!item.description && amount === 0) continue;
    rows.push({
      documentId: meta.documentId,
      fileName: meta.fileName,
      issuer,
      invoiceLabel: 'Invoice 1',
      date: item.date || data.date || '',
      description: String(item.description || '').trim() || '—',
      quantity: item.quantity != null && Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
      unitPrice:
        item.unitPrice != null && Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : null,
      amount,
      type: String(item.type || ''),
      category: String(item.category || data.expenseCategory || ''),
    });
  }
  return rows;
}

export function collectProductLinesFromDocument(doc: ProcessedDocument): DocumentProductLine[] {
  return collectProductLinesFromFinancialData(doc.data, {
    documentId: doc.id,
    fileName: doc.fileName || doc.id,
  });
}

/** Short preview for dashboard rows (e.g. "4× Sangria · Planche · +5 more"). */
export function formatProductLinesPreview(
  lines: DocumentProductLine[],
  maxNames = 3
): string {
  if (!lines.length) return '';
  const names = lines
    .map((l) => {
      const qty = l.quantity && l.quantity > 1 ? `${l.quantity}× ` : '';
      return `${qty}${l.description}`.trim();
    })
    .filter(Boolean);
  if (!names.length) return '';
  const shown = names.slice(0, maxNames);
  const extra = names.length - shown.length;
  return extra > 0 ? `${shown.join(' · ')} · +${extra} more` : shown.join(' · ');
}

export function productLinesForLedgerDocument(
  documents: ProcessedDocument[],
  documentId: string | undefined
): DocumentProductLine[] {
  if (!documentId) return [];
  const doc = documents.find(
    (d) => d.id === documentId || d.persistedDocumentId === documentId
  );
  if (!doc) return [];
  const lines = collectProductLinesFromDocument(doc);
  const subCount = doc.data?.subDocuments?.length || 0;
  if (subCount > 1 && isLikelyRollupOnly(doc.data?.lineItems || [], subCount)) {
    // Prefer nested lines only — already handled in collectProductLinesFromDocument.
    return lines;
  }
  return lines;
}

/**
 * Prefer the invoice block that matches this ledger row (amount / date),
 * so multi-ticket PDFs don't dump every item under every row.
 */
export function productLinesForLedgerEntry(
  documents: ProcessedDocument[],
  documentId: string | undefined,
  opts?: { amount?: number; date?: string }
): DocumentProductLine[] {
  const all = productLinesForLedgerDocument(documents, documentId);
  if (!all.length) return [];

  const byInvoice = new Map<string, DocumentProductLine[]>();
  for (const line of all) {
    const key = line.invoiceLabel || 'Invoice 1';
    if (!byInvoice.has(key)) byInvoice.set(key, []);
    byInvoice.get(key)!.push(line);
  }
  if (byInvoice.size <= 1) return all;

  if (opts?.amount != null && Number.isFinite(opts.amount)) {
    const target = Math.round(Number(opts.amount) * 100) / 100;
    for (const [, lines] of byInvoice) {
      const sum = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100;
      if (Math.abs(sum - target) < 0.06) return lines;
    }
  }

  if (opts?.date) {
    const matching = [...byInvoice.entries()].filter(([, lines]) =>
      lines.some((l) => l.date === opts.date)
    );
    if (matching.length === 1) return matching[0][1];
  }

  return all.slice(0, 8);
}
