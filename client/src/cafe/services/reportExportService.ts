import * as XLSX from 'xlsx';
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
  csvContent += `${L.date},${L.type},${L.amountChf},${L.description}\n`;
  income.forEach((item) => {
    csvContent += `${item.date},${incType(item.type)},${item.amount.toFixed(2)},"${item.description || ''}"\n`;
  });
  csvContent += `\n`;

  csvContent += `${L.expenseDetails}\n`;
  csvContent += `${L.date},${L.category},${L.amountChf},${L.description}\n`;
  expenses.forEach((item) => {
    csvContent += `${item.date},${cat(item.category)},${item.amount.toFixed(2)},"${item.description}"\n`;
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
  const { income, expenses, monthlyData, supplierData, dateFrom, dateTo, sessionName } = data;
  const locale = data.locale ?? 'en';
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const cat = data.labelCategory ?? ((c: string) => c);
  const incType = data.labelIncomeType ?? ((t: string) => t);
  
  // Calculate summary
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;
  
  // Calculate VAT
  const vatReceived = income.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
  const vatPaid = expenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
  const vatBalance = vatReceived - vatPaid;
  
  // Calculate expense breakdown by category
  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
  
  const suppliersTotal = expensesByCategory['SUPPLIERS'] || 0;
  const billsTotal = expensesByCategory['BILLS'] || 0;
  const payrollTotal = expensesByCategory['PAYROLL'] || 0;
  const payrollTaxesTotal = expensesByCategory['PAYROLL_TAXES'] || 0;
  const otherTotal = expensesByCategory['OTHER'] || 0;
  
  // Employee breakdown from net salary lines only
  const payrollExpenses = expenses.filter((e) => e.category === 'PAYROLL');
  const employeePayroll = payrollExpenses.reduce((acc, exp) => {
    const employeeName = exp.description
      .replace(/^Payslip\s*[—-]\s*salary payment to employee\s*[—-]\s*/i, '')
      .replace(/^Payslip\s*\(gross paid to employee\)\s*[—-]\s*/i, '')
      .replace(/^Payslip\s*[—-]\s*/i, '')
      .replace(/^Payslip\s*-\s*/i, '')
      .trim();
    acc[employeeName] = (acc[employeeName] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
  
  const formatCHF = (num: number) =>
    num.toLocaleString(chfLoc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #1a1a1a;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #d4af37;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #d4af37;
          margin: 0;
          font-size: 28px;
        }
        .header p {
          color: #666;
          margin: 5px 0;
        }
        .summary {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .summary-value {
          font-size: 24px;
          font-weight: bold;
        }
        .summary-value.positive { color: #10b981; }
        .summary-value.negative { color: #ef4444; }
        .summary-value.neutral { color: #d4af37; }
        .summary-value.blue { color: #3b82f6; }
        .summary-value.orange { color: #f97316; }
        .summary-value.purple { color: #a855f7; }
        
        .vat-section {
          background: #e0f2fe;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .vat-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }
        
        .expense-breakdown {
          background: #fef3c7;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .expense-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }
        
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-title {
          color: #d4af37;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          border-bottom: 2px solid #d4af37;
          padding-bottom: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #d4af37;
          color: white;
          padding: 10px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e5e5e5;
          font-size: 11px;
        }
        tr:hover {
          background: #f9f9f9;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #999;
          font-size: 10px;
          border-top: 1px solid #e5e5e5;
          padding-top: 20px;
        }
        @media print {
          body { padding: 20px; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PAYSTACK</h1>
        <p>${L.financialReport} - ${sessionName || L.allSessions}</p>
        ${dateFrom && dateTo ? `<p>${L.period}: ${dateFrom} ${L.periodTo} ${dateTo}</p>` : ''}
        <p>${L.generated}: ${new Date().toLocaleString(chfLoc)}</p>
      </div>
      
      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">${L.totalIncome}</div>
            <div class="summary-value positive">${formatCHF(totalIncome)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.totalExpenses}</div>
            <div class="summary-value negative">${formatCHF(totalExpenses)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.balance}</div>
            <div class="summary-value ${balance >= 0 ? 'positive' : 'negative'}">${formatCHF(balance)} CHF</div>
          </div>
        </div>
      </div>
      
      <div class="vat-section">
        <div class="section-title" style="color: #0284c7; border-color: #0284c7;">${L.vatSummary}</div>
        <div class="vat-grid">
          <div class="summary-item">
            <div class="summary-label">${L.vatReceived}</div>
            <div class="summary-value blue">${formatCHF(vatReceived)} CHF</div>
            <div class="summary-label">${L.fromCustomers}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.vatPaid}</div>
            <div class="summary-value orange">${formatCHF(vatPaid)} CHF</div>
            <div class="summary-label">${L.onExpenses}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.vatBalance}</div>
            <div class="summary-value ${vatBalance >= 0 ? 'purple' : 'negative'}">${formatCHF(vatBalance)} CHF</div>
            <div class="summary-label">${vatBalance >= 0 ? L.toPay : L.refund}</div>
          </div>
        </div>
      </div>
      
      <div class="expense-breakdown">
        <div class="section-title" style="color: #ca8a04; border-color: #ca8a04;">${L.expenseBreakdown}</div>
        <div class="expense-grid">
          <div class="summary-item">
            <div class="summary-label">${L.suppliers}</div>
            <div class="summary-value neutral">${formatCHF(suppliersTotal)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.bills}</div>
            <div class="summary-value neutral">${formatCHF(billsTotal)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.payroll}</div>
            <div class="summary-value neutral">${formatCHF(payrollTotal)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${L.other}</div>
            <div class="summary-value neutral">${formatCHF(otherTotal)} CHF</div>
          </div>
        </div>
      </div>
      
      ${Object.keys(employeePayroll).length > 0 ? `
        <div class="section">
          <div class="section-title">${L.employeePayroll}</div>
          <table>
            <thead>
              <tr>
                <th>${L.employeeName}</th>
                <th class="text-right">${L.totalPaid}</th>
                <th class="text-center">${L.payments}</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(employeePayroll).map(([name, amount]) => {
                const paymentCount = payrollExpenses.filter(e => e.description.includes(name)).length;
                return `
                  <tr>
                    <td>${name}</td>
                    <td class="text-right">${formatCHF(amount)}</td>
                    <td class="text-center">${paymentCount}</td>
                  </tr>
                `;
              }).join('')}
              <tr style="background: #fef3c7; font-weight: bold;">
                <td>${L.totalPayroll}</td>
                <td class="text-right">${formatCHF(payrollTotal)}</td>
                <td class="text-center">${payrollExpenses.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">${L.monthlyBreakdown}</div>
        <table>
          <thead>
            <tr>
              <th>${L.month}</th>
              <th class="text-right">${L.incomeChf}</th>
              <th class="text-right">${L.expensesChf}</th>
              <th class="text-right">${L.balanceChf}</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.map(([month, data]) => {
              const monthName = new Date(month + '-01').toLocaleDateString(chfLoc, { year: 'numeric', month: 'long' });
              return `
                <tr>
                  <td>${monthName}</td>
                  <td class="text-right">${formatCHF(data.income)}</td>
                  <td class="text-right">${formatCHF(data.expenses)}</td>
                  <td class="text-right">${formatCHF(data.balance)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      ${supplierData.length > 0 ? `
        <div class="section">
          <div class="section-title">${L.topSuppliers}</div>
          <table>
            <thead>
              <tr>
                <th>${L.supplier}</th>
                <th class="text-right">${L.amountChf}</th>
                <th class="text-right">${L.pctOfSuppliers}</th>
              </tr>
            </thead>
            <tbody>
              ${supplierData.map(([supplier, amount]) => `
                <tr>
                  <td>${supplier}</td>
                  <td class="text-right">${formatCHF(amount)}</td>
                  <td class="text-right">${suppliersTotal > 0 ? ((amount / suppliersTotal) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">${L.incomeDetailsN.replace('{n}', String(income.length))}</div>
        <table>
          <thead>
            <tr>
              <th>${L.date}</th>
              <th>${L.type}</th>
              <th class="text-right">${L.amountChf}</th>
              <th class="text-right">${L.vatChf}</th>
              <th>${L.description}</th>
            </tr>
          </thead>
          <tbody>
            ${income.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${incType(item.type)}</td>
                <td class="text-right">${formatCHF(item.amount)}</td>
                <td class="text-right">${formatCHF(item.vat_amount || 0)}</td>
                <td>${item.description || '-'}</td>
              </tr>
            `).join('')}
            <tr style="background: #f0fdf4; font-weight: bold;">
              <td colspan="2">${L.totalIncomeRow}</td>
              <td class="text-right">${formatCHF(totalIncome)}</td>
              <td class="text-right">${formatCHF(vatReceived)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">${L.expenseDetailsN.replace('{n}', String(expenses.length))}</div>
        <table>
          <thead>
            <tr>
              <th>${L.date}</th>
              <th>${L.category}</th>
              <th class="text-right">${L.amountChf}</th>
              <th class="text-right">${L.vatChf}</th>
              <th>${L.description}</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${cat(item.category)}</td>
                <td class="text-right">${formatCHF(item.amount)}</td>
                <td class="text-right">${formatCHF(item.vat_amount || 0)}</td>
                <td>${item.description || '-'}</td>
              </tr>
            `).join('')}
            <tr style="background: #fef2f2; font-weight: bold;">
              <td colspan="2">${L.totalExpensesRow}</td>
              <td class="text-right">${formatCHF(totalExpenses)}</td>
              <td class="text-right">${formatCHF(vatPaid)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>${L.footerGenerated}</p>
        <p>© ${new Date().getFullYear()} Paystack.ch</p>
      </div>
    </body>
    </html>
  `;
  
  // Create a new window with the HTML content
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
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
