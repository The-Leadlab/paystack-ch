import * as XLSX from 'xlsx';
import { buildFinancialReportHtml } from '@shared/financialReportHtml';
import { buildUkVatReturn, type UkVatStagger, ukVatQuarterBounds } from '@shared/ukVatReturn';
import { buildUkIncomeTaxEstimate, type UkTaxYearId } from '@shared/ukIncomeTaxEstimate';
import { Income, Expense, type ProcessedDocument } from '../types';
import {
  chfLocaleFor,
  getReportExportLabels,
  type ReportExportLocale,
} from '../i18n/reportExportTranslations';
import { canonicalizeSupplierName } from '../lib/swissDocumentNormalize';
import { collectProductLinesFromDocument } from '../lib/documentProductLines';

function money(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeName, { bookType: 'xlsx', compression: true });
}

function autosizeSheet(sheet: XLSX.WorkSheet, rows: Array<Array<string | number>>, min = 10, max = 48) {
  sheet['!cols'] = rows[0]?.map((_, colIdx) => {
    let width = min;
    for (const row of rows) {
      const cell = row[colIdx];
      const len = String(cell ?? '').length;
      if (len > width) width = len;
    }
    return { wch: Math.min(max, width + 2) };
  });
}

/**
 * Split stored ledger text into vendor vs product/service detail.
 * Older rows often only stored the vendor name in `description`.
 */
export function splitVendorAndProductDetail(
  raw: string | undefined,
  fallbackDetail: string
): { vendor: string; detail: string } {
  const text = String(raw || '').trim();
  if (!text) {
    return { vendor: '—', detail: fallbackDetail };
  }

  const canonical = canonicalizeSupplierName(text, '');
  const dashSplit = text.split(/\s*[—–\-|:]\s+/).map((p) => p.trim()).filter(Boolean);

  let vendor = canonical || dashSplit[0] || text;
  let detail = '';

  if (dashSplit.length >= 2) {
    vendor = canonicalizeSupplierName(dashSplit[0], '') || dashSplit[0];
    detail = dashSplit.slice(1).join(' — ');
  } else if (canonical && text.toLowerCase().startsWith(canonical.toLowerCase())) {
    detail = text.slice(canonical.length).replace(/^[\s\-–—:|]+/, '').trim();
    vendor = canonical;
  } else {
    detail = '';
  }

  if (!detail || detail.toLowerCase() === vendor.toLowerCase()) {
    detail = fallbackDetail;
  }

  return { vendor: vendor || '—', detail };
}

export interface ReportData {
  income: Income[];
  expenses: Expense[];
  monthlyData: [string, { income: number; expenses: number; balance: number }][];
  supplierData: [string, number][];
  dateFrom?: string;
  dateTo?: string;
  sessionName?: string;
  locale?: ReportExportLocale;
  labelCategory?: (category: string) => string;
  labelIncomeType?: (type: string) => string;
  includeLedger?: boolean;
  /** Reporting currency label (CHF / GBP). Defaults to CHF. */
  currency?: string;
  /** Completed documents — used to build the Invoice items sheet (qty, products, etc.). */
  documents?: ProcessedDocument[];
}

export type SwissVatPeriodMode = 'month' | 'semester' | 'year' | 'allYears';

type SwissVatPeriodRow = {
  periodKey: string;
  periodLabel: string;
  turnover: number;
  purchases: number;
  vatCollected: number;
  vatPaid: number;
  netVatDue: number;
  salesWithoutVatCount: number;
  purchasesWithoutVatCount: number;
};

type SwissVatStatementData = {
  rows: SwissVatPeriodRow[];
  totals: SwissVatPeriodRow;
};

type SwissVatFormMapping = {
  code200_taxableTurnover: number;
  code220_outputVat: number;
  code400_inputVat: number;
  code500_netVatPayable: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toPeriodKey(date: string, mode: SwissVatPeriodMode): string {
  const year = date.substring(0, 4);
  const month = Number(date.substring(5, 7));
  if (mode === 'month') return `${year}-${String(month).padStart(2, '0')}`;
  if (mode === 'semester') return `${year}-H${month <= 6 ? 1 : 2}`;
  return year;
}

function toPeriodLabel(periodKey: string, mode: SwissVatPeriodMode, locale: ReportExportLocale): string {
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  if (mode === 'month') {
    return new Date(`${periodKey}-01`).toLocaleDateString(chfLoc, { year: 'numeric', month: 'long' });
  }
  if (mode === 'semester') {
    const [year, half] = periodKey.split('-');
    return `${half === 'H1' ? L.semesterH1 : L.semesterH2} ${year}`;
  }
  return periodKey;
}

function buildSwissVatStatement(
  income: Income[],
  expenses: Expense[],
  mode: SwissVatPeriodMode,
  locale: ReportExportLocale = 'en'
): SwissVatStatementData {
  const L = getReportExportLabels(locale);
  const normalizedMode: SwissVatPeriodMode = mode === 'allYears' ? 'year' : mode;
  const buckets: Record<string, SwissVatPeriodRow> = {};

  for (const i of income) {
    const key = toPeriodKey(i.date, normalizedMode);
    if (!buckets[key]) {
      buckets[key] = {
        periodKey: key,
        periodLabel: toPeriodLabel(key, normalizedMode, locale),
        turnover: 0,
        purchases: 0,
        vatCollected: 0,
        vatPaid: 0,
        netVatDue: 0,
        salesWithoutVatCount: 0,
        purchasesWithoutVatCount: 0,
      };
    }
    buckets[key].turnover += money(i.amount);
    buckets[key].vatCollected += money(i.vat_amount);
    if (money(i.amount) > 0 && money(i.vat_amount) <= 0) {
      buckets[key].salesWithoutVatCount += 1;
    }
  }

  for (const e of expenses) {
    const key = toPeriodKey(e.date, normalizedMode);
    if (!buckets[key]) {
      buckets[key] = {
        periodKey: key,
        periodLabel: toPeriodLabel(key, normalizedMode, locale),
        turnover: 0,
        purchases: 0,
        vatCollected: 0,
        vatPaid: 0,
        netVatDue: 0,
        salesWithoutVatCount: 0,
        purchasesWithoutVatCount: 0,
      };
    }
    buckets[key].purchases += money(e.amount);
    buckets[key].vatPaid += money(e.vat_amount);
    if (money(e.amount) > 0 && money(e.vat_amount) <= 0) {
      buckets[key].purchasesWithoutVatCount += 1;
    }
  }

  const rows = Object.values(buckets)
    .map((row) => ({
      ...row,
      turnover: round2(row.turnover),
      purchases: round2(row.purchases),
      vatCollected: round2(row.vatCollected),
      vatPaid: round2(row.vatPaid),
      netVatDue: round2(row.vatCollected - row.vatPaid),
    }))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  const totals = rows.reduce<SwissVatPeriodRow>(
    (acc, row) => ({
      ...acc,
      turnover: round2(acc.turnover + row.turnover),
      purchases: round2(acc.purchases + row.purchases),
      vatCollected: round2(acc.vatCollected + row.vatCollected),
      vatPaid: round2(acc.vatPaid + row.vatPaid),
      netVatDue: round2(acc.netVatDue + row.netVatDue),
      salesWithoutVatCount: acc.salesWithoutVatCount + row.salesWithoutVatCount,
      purchasesWithoutVatCount: acc.purchasesWithoutVatCount + row.purchasesWithoutVatCount,
      periodKey: 'total',
      periodLabel: L.total,
    }),
    {
      periodKey: 'total',
      periodLabel: L.total,
      turnover: 0,
      purchases: 0,
      vatCollected: 0,
      vatPaid: 0,
      netVatDue: 0,
      salesWithoutVatCount: 0,
      purchasesWithoutVatCount: 0,
    }
  );

  return { rows, totals };
}

function buildSwissVatFormMapping(totals: SwissVatPeriodRow): SwissVatFormMapping {
  return {
    code200_taxableTurnover: round2(totals.turnover),
    code220_outputVat: round2(totals.vatCollected),
    code400_inputVat: round2(totals.vatPaid),
    code500_netVatPayable: round2(totals.netVatDue),
  };
}

/**
 * Export financial report as a real Excel workbook (.xlsx).
 * Works the same on Mac and Windows (no CSV delimiter issues).
 */
export const exportToCSV = (data: ReportData) => {
  exportFinancialReportExcel(data);
};

export const exportFinancialReportExcel = (data: ReportData) => {
  const { income, expenses, monthlyData, supplierData, dateFrom, dateTo, sessionName } = data;
  const locale = data.locale ?? 'en';
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const currency = data.currency || 'CHF';
  const cat = data.labelCategory ?? ((c: string) => c);
  const incType = data.labelIncomeType ?? ((t: string) => t);

  const totalIncome = income.reduce((sum, i) => sum + money(i.amount), 0);
  const operatingExpenses = expenses.filter((e) => e.category !== 'PAYROLL');
  const totalExpenses = operatingExpenses.reduce((sum, e) => sum + money(e.amount), 0);
  const totalPayroll = expenses
    .filter((e) => e.category === 'PAYROLL')
    .reduce((sum, e) => sum + money(e.amount), 0);
  const balance = totalIncome - totalExpenses - totalPayroll;

  const summaryRows: Array<Array<string | number>> = [
    [L.financialReport, sessionName || L.allSessions],
    ...(dateFrom && dateTo ? [[L.period, `${dateFrom} ${L.periodTo} ${dateTo}`]] : []),
    [L.generated, new Date().toLocaleString(chfLoc)],
    [],
    [L.summary, ''],
    [L.totalIncome, round2(totalIncome), currency],
    [L.totalExpenses, round2(totalExpenses), currency],
    ['Payroll (net)', round2(totalPayroll), currency],
    [L.balance, round2(balance), currency],
  ];

  const monthlyRows: Array<Array<string | number>> = [
    [L.month, `${L.incomeChf.replace('(CHF)', `(${currency})`)}`, `${L.expensesChf.replace('(CHF)', `(${currency})`)}`, `${L.balanceChf.replace('(CHF)', `(${currency})`)}`],
  ];
  monthlyData.forEach(([month, row]) => {
    const monthName = new Date(month + '-01').toLocaleDateString(chfLoc, {
      year: 'numeric',
      month: 'long',
    });
    monthlyRows.push([
      monthName,
      round2(money(row.income)),
      round2(money(row.expenses)),
      round2(money(row.balance)),
    ]);
  });

  const supplierRows: Array<Array<string | number>> = [
    [L.supplier, `${L.amountChf.replace('(CHF)', `(${currency})`)}`],
  ];
  supplierData.forEach(([supplier, amount]) => {
    supplierRows.push([supplier, round2(money(amount))]);
  });

  const incomeRows: Array<Array<string | number>> = [
    [
      L.date,
      L.vendor,
      L.type,
      L.accountCode,
      `${L.amountChf.replace('(CHF)', `(${currency})`)}`,
      `${L.vatChf.replace('(CHF)', `(${currency})`)}`,
      L.description,
    ],
  ];
  income.forEach((item) => {
    const typeLabel = incType(item.type);
    const { vendor, detail } = splitVendorAndProductDetail(
      item.description,
      item.type === 'RESERVATION'
        ? `${typeLabel} — reservation / booking`
        : `${typeLabel} — product / service sale`
    );
    incomeRows.push([
      item.date,
      vendor,
      typeLabel,
      item.account_code || '',
      round2(money(item.amount)),
      round2(money(item.vat_amount)),
      detail,
    ]);
  });

  const expenseRows: Array<Array<string | number>> = [
    [
      L.date,
      L.vendor,
      L.category,
      L.accountCode,
      `${L.amountChf.replace('(CHF)', `(${currency})`)}`,
      `${L.vatChf.replace('(CHF)', `(${currency})`)}`,
      L.description,
    ],
  ];
  expenses.forEach((item) => {
    const categoryLabel = cat(item.category);
    const { vendor, detail } = splitVendorAndProductDetail(
      item.description,
      `${categoryLabel} — purchase / expense`
    );
    expenseRows.push([
      item.date,
      vendor,
      categoryLabel,
      item.account_code || '',
      round2(money(item.amount)),
      round2(money(item.vat_amount)),
      detail,
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  autosizeSheet(summarySheet, summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, L.summary.slice(0, 31));

  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyRows);
  autosizeSheet(monthlySheet, monthlyRows);
  XLSX.utils.book_append_sheet(workbook, monthlySheet, L.monthlyBreakdown.slice(0, 31));

  if (supplierData.length > 0) {
    const supplierSheet = XLSX.utils.aoa_to_sheet(supplierRows);
    autosizeSheet(supplierSheet, supplierRows);
    XLSX.utils.book_append_sheet(workbook, supplierSheet, L.topSuppliers.slice(0, 31));
  }

  const incomeSheet = XLSX.utils.aoa_to_sheet(incomeRows);
  autosizeSheet(incomeSheet, incomeRows);
  XLSX.utils.book_append_sheet(workbook, incomeSheet, L.incomeDetails.slice(0, 31));

  const expenseSheet = XLSX.utils.aoa_to_sheet(expenseRows);
  autosizeSheet(expenseSheet, expenseRows);
  XLSX.utils.book_append_sheet(workbook, expenseSheet, L.expenseDetails.slice(0, 31));

  // Per-invoice product/service lines (Verification Center item detail)
  const docs = Array.isArray(data.documents) ? data.documents : [];
  const itemRows: Array<Array<string | number>> = [
    [
      L.sourceFile,
      L.vendor,
      L.invoiceLabel,
      L.date,
      L.description,
      L.quantity,
      L.unitPrice,
      L.lineAmount,
      L.type,
      L.category,
    ],
  ];
  for (const doc of docs) {
    if (!doc?.data) continue;
    const lines = collectProductLinesFromDocument(doc);
    for (const line of lines) {
      if (dateFrom && line.date && line.date < dateFrom) continue;
      if (dateTo && line.date && line.date > dateTo) continue;
      itemRows.push([
        line.fileName,
        line.issuer,
        line.invoiceLabel,
        line.date || '',
        line.description,
        line.quantity ?? '',
        line.unitPrice != null ? round2(line.unitPrice) : '',
        round2(line.amount),
        line.type || '',
        line.category || '',
      ]);
    }
  }
  if (itemRows.length > 1) {
    const itemsSheet = XLSX.utils.aoa_to_sheet(itemRows);
    autosizeSheet(itemsSheet, itemRows, 8, 42);
    XLSX.utils.book_append_sheet(workbook, itemsSheet, L.invoiceItems.slice(0, 31));
  }

  downloadWorkbook(
    workbook,
    `${L.csvFilenameReport}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

/**
 * Export report data to PDF format using HTML print window
 */
export const exportToPDF = async (data: ReportData) => {
  const locale = data.locale ?? 'en';
  const L = getReportExportLabels(locale);

  const htmlContent = buildFinancialReportHtml({
    income: data.income,
    expenses: data.expenses,
    monthlyData: data.monthlyData,
    supplierData: data.supplierData,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    sessionName: data.sessionName,
    locale,
    labelCategory: data.labelCategory,
    labelIncomeType: data.labelIncomeType,
    includeLedger: data.includeLedger,
  });

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    alert(L.allowPopups);
  }
};

export const exportSwissVatCSV = (data: ReportData, mode: SwissVatPeriodMode) => {
  const locale = data.locale ?? 'en';
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const statement = buildSwissVatStatement(data.income, data.expenses, mode, locale);
  const mapping = buildSwissVatFormMapping(statement.totals);
  const modeLabel =
    mode === 'month' ? L.modeMonthly : mode === 'semester' ? L.modeSemiannual : L.modeYearly;

  const periodRows: Array<Array<string | number>> = [
    [
      L.periodCol,
      L.turnoverClients,
      L.purchases,
      L.tvaCollected,
      L.tvaPaid,
      L.netTvaDue,
      L.salesMissingTva,
      L.purchasesMissingTva,
    ],
    ...statement.rows.map((row) => [
      row.periodLabel,
      row.turnover,
      row.purchases,
      row.vatCollected,
      row.vatPaid,
      row.netVatDue,
      row.salesWithoutVatCount,
      row.purchasesWithoutVatCount,
    ]),
    [
      L.total,
      statement.totals.turnover,
      statement.totals.purchases,
      statement.totals.vatCollected,
      statement.totals.vatPaid,
      statement.totals.netVatDue,
      statement.totals.salesWithoutVatCount,
      statement.totals.purchasesWithoutVatCount,
    ],
  ];

  const mappingRows: Array<Array<string | number>> = [
    [L.formCode, L.formDescription, L.amountChf],
    ['200', L.form200, mapping.code200_taxableTurnover],
    ['220', L.form220, mapping.code220_outputVat],
    ['400', L.form400, mapping.code400_inputVat],
    ['500', L.form500, mapping.code500_netVatPayable],
  ];

  const metaRows: Array<Array<string | number>> = [
    [L.swissVatReport, data.sessionName || L.allSessions],
    [L.mode, modeLabel],
    ...(data.dateFrom && data.dateTo
      ? [[L.filteredPeriod, `${data.dateFrom} ${L.periodTo} ${data.dateTo}`]]
      : []),
    [L.generated, new Date().toLocaleString(chfLoc)],
  ];

  const workbook = XLSX.utils.book_new();
  const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
  autosizeSheet(metaSheet, metaRows);
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Info');
  const periodSheet = XLSX.utils.aoa_to_sheet(periodRows);
  autosizeSheet(periodSheet, periodRows);
  XLSX.utils.book_append_sheet(workbook, periodSheet, 'VAT periods');
  const mapSheet = XLSX.utils.aoa_to_sheet(mappingRows);
  autosizeSheet(mapSheet, mappingRows);
  XLSX.utils.book_append_sheet(workbook, mapSheet, 'Form mapping');

  downloadWorkbook(
    workbook,
    `${L.csvFilenameVat}_${modeLabel}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

export const exportSwissVatPDF = async (data: ReportData, mode: SwissVatPeriodMode) => {
  const locale = data.locale ?? 'en';
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const statement = buildSwissVatStatement(data.income, data.expenses, mode, locale);
  const mapping = buildSwissVatFormMapping(statement.totals);
  const modeLabel =
    mode === 'month' ? L.modeMonthly : mode === 'semester' ? L.modeSemiannual : L.modeYearly;

  const formatCHF = (num: number) =>
    num.toLocaleString(chfLoc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1 { margin: 0 0 4px 0; color: #0f172a; }
        .meta { color: #475569; font-size: 12px; margin-bottom: 16px; }
        .warn { background: #fff7ed; border: 1px solid #fdba74; padding: 10px; border-radius: 6px; margin: 12px 0; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; }
        th { background: #f8fafc; text-transform: uppercase; font-size: 11px; text-align: left; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .total-row td { font-weight: bold; background: #f1f5f9; }
      </style>
    </head>
    <body>
      <h1>${L.swissTvaStatement}</h1>
      <div class="meta">
        ${L.session}: ${data.sessionName || L.allSessions}<br/>
        ${L.mode}: ${modeLabel}<br/>
        ${data.dateFrom && data.dateTo ? `${L.filteredPeriod}: ${data.dateFrom} ${L.periodTo} ${data.dateTo}<br/>` : ''}
        ${L.generated}: ${new Date().toLocaleString(chfLoc)}
      </div>
      ${
        statement.totals.salesWithoutVatCount > 0 || statement.totals.purchasesWithoutVatCount > 0
          ? `<div class="warn"><strong>${L.warningMissingTva}:</strong> ${L.warningMissingTvaDetail.replace('{sales}', String(statement.totals.salesWithoutVatCount)).replace('{purchases}', String(statement.totals.purchasesWithoutVatCount))}</div>`
          : ''
      }
      <table>
        <thead>
          <tr>
            <th>${L.periodCol}</th>
            <th class="num">${L.turnoverClients}</th>
            <th class="num">${L.purchases}</th>
            <th class="num">${L.tvaCollected}</th>
            <th class="num">${L.tvaPaid}</th>
            <th class="num">${L.netTvaDue}</th>
            <th class="num">${L.salesMissingTva}</th>
            <th class="num">${L.purchasesMissingTva}</th>
          </tr>
        </thead>
        <tbody>
          ${statement.rows
            .map(
              (row) => `
            <tr>
              <td>${row.periodLabel}</td>
              <td class="num">${formatCHF(row.turnover)}</td>
              <td class="num">${formatCHF(row.purchases)}</td>
              <td class="num">${formatCHF(row.vatCollected)}</td>
              <td class="num">${formatCHF(row.vatPaid)}</td>
              <td class="num">${formatCHF(row.netVatDue)}</td>
              <td class="num">${row.salesWithoutVatCount}</td>
              <td class="num">${row.purchasesWithoutVatCount}</td>
            </tr>`
            )
            .join('')}
          <tr class="total-row">
            <td>${L.total}</td>
            <td class="num">${formatCHF(statement.totals.turnover)}</td>
            <td class="num">${formatCHF(statement.totals.purchases)}</td>
            <td class="num">${formatCHF(statement.totals.vatCollected)}</td>
            <td class="num">${formatCHF(statement.totals.vatPaid)}</td>
            <td class="num">${formatCHF(statement.totals.netVatDue)}</td>
            <td class="num">${statement.totals.salesWithoutVatCount}</td>
            <td class="num">${statement.totals.purchasesWithoutVatCount}</td>
          </tr>
        </tbody>
      </table>
      <h2 style="margin-top:24px;font-size:16px">${L.formMappingTitle}</h2>
      <table>
        <thead><tr><th>${L.formCode}</th><th>${L.formDescription}</th><th class="num">${L.amountChf}</th></tr></thead>
        <tbody>
          <tr><td>200</td><td>${L.form200}</td><td class="num">${formatCHF(mapping.code200_taxableTurnover)}</td></tr>
          <tr><td>220</td><td>${L.form220}</td><td class="num">${formatCHF(mapping.code220_outputVat)}</td></tr>
          <tr><td>400</td><td>${L.form400}</td><td class="num">${formatCHF(mapping.code400_inputVat)}</td></tr>
          <tr><td>500</td><td>${L.form500}</td><td class="num">${formatCHF(mapping.code500_netVatPayable)}</td></tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    alert(L.allowPopups);
  }
};

export type UkVatExportOpts = {
  year: number;
  quarterIndex: 0 | 1 | 2 | 3;
  stagger: UkVatStagger;
};

export const exportUkVatCSV = (data: ReportData, opts: UkVatExportOpts) => {
  const { start, end } = ukVatQuarterBounds(opts.year, opts.quarterIndex, opts.stagger);
  const boxes = buildUkVatReturn(data.income, data.expenses, { start, end });
  const rows: Array<Array<string | number>> = [
    ['UK VAT return (9-box)', data.sessionName || 'All sessions'],
    ['Period', `${boxes.periodStart} to ${boxes.periodEnd}`],
    ['Disclaimer', 'Figures prepared from documents in Paystack. Review before filing.'],
    [],
    ['Box', 'Description', 'Amount'],
    [1, 'VAT due on sales', boxes.box1_vatDueSales],
    [2, 'VAT due on acquisitions', boxes.box2_vatDueAcquisitions],
    [3, 'Total VAT due', boxes.box3_totalVatDue],
    [4, 'VAT reclaimed', boxes.box4_vatReclaimedCurrPeriod],
    [5, `Net VAT (${boxes.box5_direction})`, boxes.box5_netVatDue],
    [6, 'Total value of sales ex VAT', boxes.box6_totalValueSalesExVAT],
    [7, 'Total value of purchases ex VAT', boxes.box7_totalValuePurchasesExVAT],
    [8, 'Total value of supplies ex VAT', boxes.box8_totalValueSuppliesExVAT],
    [9, 'Total value of acquisitions ex VAT', boxes.box9_totalValueAcquisitionsExVAT],
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  autosizeSheet(sheet, rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'UK VAT');
  downloadWorkbook(workbook, `UK_VAT_return_${boxes.periodStart}_${boxes.periodEnd}.xlsx`);
};

export const exportUkVatPDF = async (data: ReportData, opts: UkVatExportOpts) => {
  const { start, end } = ukVatQuarterBounds(opts.year, opts.quarterIndex, opts.stagger);
  const boxes = buildUkVatReturn(data.income, data.expenses, { start, end });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>UK VAT return</title>
  <style>body{font-family:Arial,sans-serif;padding:32px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}.num{text-align:right}.meta{color:#555;font-size:12px;margin-bottom:16px}</style>
  </head><body>
  <h1>UK VAT return (9-box)</h1>
  <div class="meta">${boxes.periodStart} – ${boxes.periodEnd}<br/>Figures prepared from documents in Paystack. Review before filing.</div>
  <table><thead><tr><th>Box</th><th>Description</th><th class="num">GBP</th></tr></thead><tbody>
  <tr><td>1</td><td>VAT due on sales</td><td class="num">${boxes.box1_vatDueSales.toFixed(2)}</td></tr>
  <tr><td>2</td><td>VAT due on acquisitions</td><td class="num">${boxes.box2_vatDueAcquisitions.toFixed(2)}</td></tr>
  <tr><td>3</td><td>Total VAT due</td><td class="num">${boxes.box3_totalVatDue.toFixed(2)}</td></tr>
  <tr><td>4</td><td>VAT reclaimed</td><td class="num">${boxes.box4_vatReclaimedCurrPeriod.toFixed(2)}</td></tr>
  <tr><td>5</td><td>Net VAT (${boxes.box5_direction})</td><td class="num">${boxes.box5_netVatDue.toFixed(2)}</td></tr>
  <tr><td>6</td><td>Sales ex VAT</td><td class="num">${boxes.box6_totalValueSalesExVAT}</td></tr>
  <tr><td>7</td><td>Purchases ex VAT</td><td class="num">${boxes.box7_totalValuePurchasesExVAT}</td></tr>
  <tr><td>8</td><td>Supplies ex VAT</td><td class="num">${boxes.box8_totalValueSuppliesExVAT}</td></tr>
  <tr><td>9</td><td>Acquisitions ex VAT</td><td class="num">${boxes.box9_totalValueAcquisitionsExVAT}</td></tr>
  </tbody></table></body></html>`;
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => printWindow.print(), 250);
  } else {
    alert('Please allow popups to export the PDF.');
  }
};

export const exportUkIncomeTaxCSV = (
  data: ReportData,
  taxYear: UkTaxYearId,
  opts?: { useExVat?: boolean }
) => {
  const useExVat = opts?.useExVat !== false;
  const turnover = data.income.reduce((s, r) => {
    const gross = money(r.amount);
    const vat = money(r.vat_amount);
    return s + (useExVat ? gross - vat : gross);
  }, 0);
  const allowableExpenses = data.expenses.reduce((s, r) => {
    const gross = money(r.amount);
    const vat = money(r.vat_amount);
    return s + (useExVat ? gross - vat : gross);
  }, 0);
  const est = buildUkIncomeTaxEstimate({ taxYear, turnover, allowableExpenses });
  const rows: Array<Array<string | number>> = [
    ['UK income tax estimate', taxYear],
    ['Period', `${est.taxYearStart} to ${est.taxYearEnd}`],
    ['Disclaimer', est.disclaimer],
    [],
    ['Metric', 'Amount GBP'],
    ['Turnover', est.turnover],
    ['Allowable expenses', est.allowableExpenses],
    ['Net profit', est.netProfit],
    ['Personal allowance', est.personalAllowance],
    ['Taxable income', est.taxableIncome],
    ['Income tax (estimate)', est.incomeTaxEstimate],
    ['Class 4 NI (estimate)', est.class4NiEstimate],
    ['Total estimate', est.totalEstimate],
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  autosizeSheet(sheet, rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Income tax');
  downloadWorkbook(workbook, `UK_income_tax_estimate_${taxYear}.xlsx`);
};
