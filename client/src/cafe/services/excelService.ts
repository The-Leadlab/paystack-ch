import * as XLSX from 'xlsx';
import { FinancialData, DocumentType } from '../types';

/**
 * Exports financial audit data to an Excel ledger with accurate currency formatting.
 */
export const exportToExcel = (data: FinancialData[], fileNamePrefix: string, reportingCurrency: string = 'CHF') => {
  if (data.length === 0) return;

  const rows: any[] = [];
  let grandTotal = 0;

  data.forEach(item => {
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
      'Diagnostic Notes': item.notes || 'AI Verified'
    });
  });

  // Footer Row
  rows.push({});
  rows.push({
    'Issuer Entity': 'CUMULATIVE AUDIT TOTAL',
    [`Audited Total (${reportingCurrency})`]: `${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${reportingCurrency}`
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Financial_Audit_Ledger");

  // Aesthetic column sizing
  worksheet['!cols'] = [
    { wch: 15 }, // Date
    { wch: 35 }, // Issuer
    { wch: 20 }, // Ref
    { wch: 22 }, // Original
    { wch: 15 }, // VAT
    { wch: 25 }, // Rate
    { wch: 25 }, // Total
    { wch: 35 }  // Notes
  ];

  XLSX.writeFile(workbook, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
};