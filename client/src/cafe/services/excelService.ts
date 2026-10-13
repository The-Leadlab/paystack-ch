import * as XLSX from 'xlsx';
import { FinancialData } from '../types';
import { collectProductLinesFromFinancialData } from '../lib/documentProductLines';

/**
 * Exports financial audit data to an Excel ledger with accurate currency formatting,
 * plus a second sheet of per-invoice product/service line items.
 */
export const exportToExcel = (data: FinancialData[], fileNamePrefix: string, reportingCurrency: string = 'CHF') => {
  if (data.length === 0) return;

  const rows: any[] = [];
  let grandTotal = 0;

  data.forEach((item) => {
    const totalTarget = item.amountInCHF;
    grandTotal += totalTarget;

    rows.push({
      'Audit Date': item.date,
      'Issuer Entity': item.issuer,
      'Document Ref #': item.documentNumber || 'N/A',
      'Original Amount': `${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${item.originalCurrency}`,
      'VAT Amount': item.vatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00',
      'Historical Exchange Rate': item.conversionRateUsed?.toFixed(4) || '1.0000',
      [`Audited Total (${reportingCurrency})`]: totalTarget.toFixed(2),
      'Diagnostic Notes': item.notes || 'AI Verified',
    });
  });

  rows.push({});
  rows.push({
    'Issuer Entity': 'CUMULATIVE AUDIT TOTAL',
    [`Audited Total (${reportingCurrency})`]: `${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${reportingCurrency}`,
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial_Audit_Ledger');

  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 35 },
    { wch: 20 },
    { wch: 22 },
    { wch: 15 },
    { wch: 25 },
    { wch: 25 },
    { wch: 35 },
  ];

  const itemRows: any[] = [];
  data.forEach((item, idx) => {
    const lines = collectProductLinesFromFinancialData(item, {
      documentId: `doc-${idx}`,
      fileName: item.issuer || item.documentNumber || `Document ${idx + 1}`,
    });
    for (const line of lines) {
      const docVat = Number(item.vatAmount) || 0;
      const linesTotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const lineVat =
        linesTotal > 0 && docVat > 0
          ? ((Number(line.amount) || 0) / linesTotal) * docVat
          : 0;
      itemRows.push({
        'Source / Issuer': line.issuer,
        Invoice: line.invoiceLabel,
        Date: line.date || item.date || '',
        Description: line.description,
        Qty: line.quantity ?? '',
        'Unit price': line.unitPrice != null ? Number(line.unitPrice).toFixed(2) : '',
        [`Line amount (${reportingCurrency})`]: Number(line.amount).toFixed(2),
        [`VAT Amount (${reportingCurrency})`]: lineVat.toFixed(2),
        Type: line.type || '',
        Category: line.category || '',
      });
    }
  });

  if (itemRows.length > 0) {
    const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
    itemsSheet['!cols'] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 36 },
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Invoice_Items');
  }

  XLSX.writeFile(workbook, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
