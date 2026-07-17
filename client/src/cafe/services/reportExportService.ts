import * as XLSX from 'xlsx';
import { buildFinancialReportHtml } from '@shared/financialReportHtml';
import { Income, Expense } from '../types';
import {
  chfLocaleFor,
  getReportExportLabels,
  type ReportExportLocale,
} from '../i18n/reportExportTranslations';

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
    buckets[key].turnover += Number(i.amount || 0);
    buckets[key].vatCollected += Number(i.vat_amount || 0);
    if (Number(i.amount || 0) > 0 && Number(i.vat_amount || 0) <= 0) {
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
    buckets[key].purchases += Number(e.amount || 0);
    buckets[key].vatPaid += Number(e.vat_amount || 0);
    if (Number(e.amount || 0) > 0 && Number(e.vat_amount || 0) <= 0) {
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
    }),
    {
      periodKey: 'TOTAL',
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
 * Export report data to CSV format
 */
export const exportToCSV = (data: ReportData) => {
  const { income, expenses, monthlyData, supplierData, dateFrom, dateTo, sessionName } = data;
  const locale = data.locale ?? 'en';
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const cat = data.labelCategory ?? ((c: string) => c);
  const incType = data.labelIncomeType ?? ((t: string) => t);

  let csvContent = '';

  csvContent += `${L.financialReport} - ${sessionName || L.allSessions}\n`;
  if (dateFrom && dateTo) {
    csvContent += `${L.period}: ${dateFrom} ${L.periodTo} ${dateTo}\n`;
  }
  csvContent += `${L.generated}: ${new Date().toLocaleString(chfLoc)}\n\n`;

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  csvContent += `${L.summary}\n`;
  csvContent += `${L.totalIncome},${totalIncome.toFixed(2)} CHF\n`;
  csvContent += `${L.totalExpenses},${totalExpenses.toFixed(2)} CHF\n`;
  csvContent += `${L.balance},${balance.toFixed(2)} CHF\n\n`;

  csvContent += `${L.monthlyBreakdown}\n`;
  csvContent += `${L.month},${L.incomeChf},${L.expensesChf},${L.balanceChf}\n`;
  monthlyData.forEach(([month, row]) => {
    const monthName = new Date(month + '-01').toLocaleDateString(chfLoc, { year: 'numeric', month: 'long' });
    csvContent += `${monthName},${row.income.toFixed(2)},${row.expenses.toFixed(2)},${row.balance.toFixed(2)}\n`;
  });
  csvContent += `\n`;

  if (supplierData.length > 0) {
    csvContent += `${L.topSuppliers}\n`;
    csvContent += `${L.supplier},${L.amountChf}\n`;
    supplierData.forEach(([supplier, amount]) => {
      csvContent += `"${supplier}",${amount.toFixed(2)}\n`;
    });
    csvContent += `\n`;
  }

  csvContent += `${L.incomeDetails}\n`;
  csvContent += `${L.date},${L.vendor},${L.type},${L.accountCode},${L.amountChf},${L.vatChf},${L.description}\n`;
  income.forEach((item) => {
    csvContent += `${item.date},"${item.description || ''}",${incType(item.type)},${item.account_code || ''},${item.amount.toFixed(2)},${(item.vat_amount || 0).toFixed(2)},"${item.description || ''}"\n`;
  });
  csvContent += `\n`;

  csvContent += `${L.expenseDetails}\n`;
  csvContent += `${L.date},${L.vendor},${L.category},${L.accountCode},${L.amountChf},${L.vatChf},${L.description}\n`;
  expenses.forEach((item) => {
    csvContent += `${item.date},"${item.description || ''}",${cat(item.category)},${item.account_code || ''},${item.amount.toFixed(2)},${(item.vat_amount || 0).toFixed(2)},"${item.description}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${L.csvFilenameReport}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export report data to PDF format using HTML canvas
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

  let csvContent = '';
  csvContent += `${L.swissVatReport} - ${data.sessionName || L.allSessions}\n`;
  csvContent += `${L.mode},${modeLabel}\n`;
  if (data.dateFrom && data.dateTo)
    csvContent += `${L.filteredPeriod},${data.dateFrom} ${L.periodTo} ${data.dateTo}\n`;
  csvContent += `${L.generated},${new Date().toLocaleString(chfLoc)}\n\n`;
  csvContent += `${L.periodCol},${L.turnoverClients},${L.purchases},${L.tvaCollected},${L.tvaPaid},${L.netTvaDue},${L.salesMissingTva},${L.purchasesMissingTva}\n`;

  statement.rows.forEach((row) => {
    csvContent += `${row.periodLabel},${row.turnover.toFixed(2)},${row.purchases.toFixed(2)},${row.vatCollected.toFixed(2)},${row.vatPaid.toFixed(2)},${row.netVatDue.toFixed(2)},${row.salesWithoutVatCount},${row.purchasesWithoutVatCount}\n`;
  });

  csvContent += `${L.total},${statement.totals.turnover.toFixed(2)},${statement.totals.purchases.toFixed(2)},${statement.totals.vatCollected.toFixed(2)},${statement.totals.vatPaid.toFixed(2)},${statement.totals.netVatDue.toFixed(2)},${statement.totals.salesWithoutVatCount},${statement.totals.purchasesWithoutVatCount}\n`;
  csvContent += `\n`;
  csvContent += `${L.formMappingTitle}\n`;
  csvContent += `${L.formCode},${L.formDescription},${L.amountChf}\n`;
  csvContent += `200,${L.form200},${mapping.code200_taxableTurnover.toFixed(2)}\n`;
  csvContent += `220,${L.form220},${mapping.code220_outputVat.toFixed(2)}\n`;
  csvContent += `400,${L.form400},${mapping.code400_inputVat.toFixed(2)}\n`;
  csvContent += `500,${L.form500},${mapping.code500_netVatPayable.toFixed(2)}\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${L.csvFilenameVat}_${modeLabel}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
            </tr>
          `
            )
            .join('')}
          <tr class="total-row">
            <td>${statement.totals.periodLabel}</td>
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
      <h2 style="margin-top: 20px;">${L.formMappingTitle}</h2>
      <table>
        <thead>
          <tr>
            <th>${L.formCode}</th>
            <th>${L.formDescription}</th>
            <th class="num">${L.amountChf}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>200</td>
            <td>${L.form200}</td>
            <td class="num">${formatCHF(mapping.code200_taxableTurnover)}</td>
          </tr>
          <tr>
            <td>220</td>
            <td>${L.form220}</td>
            <td class="num">${formatCHF(mapping.code220_outputVat)}</td>
          </tr>
          <tr>
            <td>400</td>
            <td>${L.form400}</td>
            <td class="num">${formatCHF(mapping.code400_inputVat)}</td>
          </tr>
          <tr class="total-row">
            <td>500</td>
            <td>${L.form500}</td>
            <td class="num">${formatCHF(mapping.code500_netVatPayable)}</td>
          </tr>
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
