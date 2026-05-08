import * as XLSX from 'xlsx';
import { Income, Expense } from '../types';

interface ReportData {
  income: Income[];
  expenses: Expense[];
  monthlyData: [string, { income: number; expenses: number; balance: number }][];
  supplierData: [string, number][];
  dateFrom?: string;
  dateTo?: string;
  sessionName?: string;
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

function toPeriodLabel(periodKey: string, mode: SwissVatPeriodMode): string {
  if (mode === 'month') {
    return new Date(`${periodKey}-01`).toLocaleDateString('en-CH', { year: 'numeric', month: 'long' });
  }
  if (mode === 'semester') {
    const [year, half] = periodKey.split('-');
    return `${half === 'H1' ? 'Jan-Jun' : 'Jul-Dec'} ${year}`;
  }
  return periodKey;
}

function buildSwissVatStatement(
  income: Income[],
  expenses: Expense[],
  mode: SwissVatPeriodMode
): SwissVatStatementData {
  const normalizedMode: SwissVatPeriodMode = mode === 'allYears' ? 'year' : mode;
  const buckets: Record<string, SwissVatPeriodRow> = {};

  for (const i of income) {
    const key = toPeriodKey(i.date, normalizedMode);
    if (!buckets[key]) {
      buckets[key] = {
        periodKey: key,
        periodLabel: toPeriodLabel(key, normalizedMode),
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
        periodLabel: toPeriodLabel(key, normalizedMode),
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
      periodLabel: 'TOTAL',
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
  
  let csvContent = '';
  
  // Header
  csvContent += `Financial Report - ${sessionName || 'All Sessions'}\n`;
  if (dateFrom && dateTo) {
    csvContent += `Period: ${dateFrom} to ${dateTo}\n`;
  }
  csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  // Summary
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;
  
  csvContent += `SUMMARY\n`;
  csvContent += `Total Income,${totalIncome.toFixed(2)} CHF\n`;
  csvContent += `Total Expenses,${totalExpenses.toFixed(2)} CHF\n`;
  csvContent += `Balance,${balance.toFixed(2)} CHF\n\n`;
  
  // Monthly Breakdown
  csvContent += `MONTHLY BREAKDOWN\n`;
  csvContent += `Month,Income (CHF),Expenses (CHF),Balance (CHF)\n`;
  monthlyData.forEach(([month, data]) => {
    const monthName = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    csvContent += `${monthName},${data.income.toFixed(2)},${data.expenses.toFixed(2)},${data.balance.toFixed(2)}\n`;
  });
  csvContent += `\n`;
  
  // Top Suppliers
  if (supplierData.length > 0) {
    csvContent += `TOP SUPPLIERS\n`;
    csvContent += `Supplier,Amount (CHF)\n`;
    supplierData.forEach(([supplier, amount]) => {
      csvContent += `"${supplier}",${amount.toFixed(2)}\n`;
    });
    csvContent += `\n`;
  }
  
  // Income Details
  csvContent += `INCOME DETAILS\n`;
  csvContent += `Date,Type,Amount (CHF),Description\n`;
  income.forEach(item => {
    csvContent += `${item.date},${item.type},${item.amount.toFixed(2)},"${item.description || ''}"\n`;
  });
  csvContent += `\n`;
  
  // Expense Details
  csvContent += `EXPENSE DETAILS\n`;
  csvContent += `Date,Category,Amount (CHF),Description\n`;
  expenses.forEach(item => {
    csvContent += `${item.date},${item.category},${item.amount.toFixed(2)},"${item.description}"\n`;
  });
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `Financial_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
  const otherTotal = expensesByCategory['OTHER'] || 0;
  
  // Get payroll details (employee breakdown)
  const payrollExpenses = expenses.filter(e => e.category === 'PAYROLL');
  const employeePayroll = payrollExpenses.reduce((acc, exp) => {
    const employeeName = exp.description.replace('Payslip - ', '');
    acc[employeeName] = (acc[employeeName] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
  
  // Format number with Swiss locale
  const formatCHF = (num: number) => num.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
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
        <p>Financial Report - ${sessionName || 'All Sessions'}</p>
        ${dateFrom && dateTo ? `<p>Period: ${dateFrom} to ${dateTo}</p>` : ''}
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Income</div>
            <div class="summary-value positive">${formatCHF(totalIncome)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Expenses</div>
            <div class="summary-value negative">${formatCHF(totalExpenses)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Balance</div>
            <div class="summary-value ${balance >= 0 ? 'positive' : 'negative'}">${formatCHF(balance)} CHF</div>
          </div>
        </div>
      </div>
      
      <div class="vat-section">
        <div class="section-title" style="color: #0284c7; border-color: #0284c7;">VAT Summary</div>
        <div class="vat-grid">
          <div class="summary-item">
            <div class="summary-label">VAT Received</div>
            <div class="summary-value blue">${formatCHF(vatReceived)} CHF</div>
            <div class="summary-label">From customers</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">VAT Paid</div>
            <div class="summary-value orange">${formatCHF(vatPaid)} CHF</div>
            <div class="summary-label">On expenses</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">VAT Balance</div>
            <div class="summary-value ${vatBalance >= 0 ? 'purple' : 'negative'}">${formatCHF(vatBalance)} CHF</div>
            <div class="summary-label">${vatBalance >= 0 ? 'To pay' : 'Refund'}</div>
          </div>
        </div>
      </div>
      
      <div class="expense-breakdown">
        <div class="section-title" style="color: #ca8a04; border-color: #ca8a04;">Expense Breakdown by Category</div>
        <div class="expense-grid">
          <div class="summary-item">
            <div class="summary-label">Suppliers</div>
            <div class="summary-value neutral">${formatCHF(suppliersTotal)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Bills</div>
            <div class="summary-value neutral">${formatCHF(billsTotal)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Payroll</div>
            <div class="summary-value neutral">${formatCHF(payrollTotal)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Other</div>
            <div class="summary-value neutral">${formatCHF(otherTotal)} CHF</div>
          </div>
        </div>
      </div>
      
      ${Object.keys(employeePayroll).length > 0 ? `
        <div class="section">
          <div class="section-title">Employee Payroll Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th class="text-right">Total Paid (CHF)</th>
                <th class="text-center">Payments</th>
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
                <td>TOTAL PAYROLL</td>
                <td class="text-right">${formatCHF(payrollTotal)}</td>
                <td class="text-center">${payrollExpenses.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">Monthly Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th class="text-right">Income (CHF)</th>
              <th class="text-right">Expenses (CHF)</th>
              <th class="text-right">Balance (CHF)</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.map(([month, data]) => {
              const monthName = new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
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
          <div class="section-title">Top Suppliers</div>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th class="text-right">Amount (CHF)</th>
                <th class="text-right">% of Total Suppliers</th>
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
        <div class="section-title">Income Details (${income.length} entries)</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th class="text-right">Amount (CHF)</th>
              <th class="text-right">VAT (CHF)</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${income.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${item.type}</td>
                <td class="text-right">${formatCHF(item.amount)}</td>
                <td class="text-right">${formatCHF(item.vat_amount || 0)}</td>
                <td>${item.description || '-'}</td>
              </tr>
            `).join('')}
            <tr style="background: #f0fdf4; font-weight: bold;">
              <td colspan="2">TOTAL INCOME</td>
              <td class="text-right">${formatCHF(totalIncome)}</td>
              <td class="text-right">${formatCHF(vatReceived)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">Expense Details (${expenses.length} entries)</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th class="text-right">Amount (CHF)</th>
              <th class="text-right">VAT (CHF)</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${item.category}</td>
                <td class="text-right">${formatCHF(item.amount)}</td>
                <td class="text-right">${formatCHF(item.vat_amount || 0)}</td>
                <td>${item.description || '-'}</td>
              </tr>
            `).join('')}
            <tr style="background: #fef2f2; font-weight: bold;">
              <td colspan="2">TOTAL EXPENSES</td>
              <td class="text-right">${formatCHF(totalExpenses)}</td>
              <td class="text-right">${formatCHF(vatPaid)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>This report was generated automatically by Café de la Place Financial Management System</p>
        <p>© ${new Date().getFullYear()} Café de la Place - All rights reserved</p>
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
    alert('Please allow pop-ups to download PDF');
  }
};

export const exportSwissVatCSV = (data: ReportData, mode: SwissVatPeriodMode) => {
  const statement = buildSwissVatStatement(data.income, data.expenses, mode);
  const mapping = buildSwissVatFormMapping(statement.totals);
  const modeLabel = mode === 'month' ? 'Monthly' : mode === 'semester' ? 'Semiannual' : 'Yearly';

  let csvContent = '';
  csvContent += `Swiss TVA Report - ${data.sessionName || 'All Sessions'}\n`;
  csvContent += `Mode,${modeLabel}\n`;
  if (data.dateFrom && data.dateTo) csvContent += `Filtered Period,${data.dateFrom} to ${data.dateTo}\n`;
  csvContent += `Generated,${new Date().toLocaleString()}\n\n`;
  csvContent += `Period,Turnover CHF (Sales),Purchases CHF,TVA Collected CHF (Clients),TVA Paid CHF (Suppliers),Net TVA Due CHF,Sales Missing TVA,Purchases Missing TVA\n`;

  statement.rows.forEach((row) => {
    csvContent += `${row.periodLabel},${row.turnover.toFixed(2)},${row.purchases.toFixed(2)},${row.vatCollected.toFixed(2)},${row.vatPaid.toFixed(2)},${row.netVatDue.toFixed(2)},${row.salesWithoutVatCount},${row.purchasesWithoutVatCount}\n`;
  });

  csvContent += `TOTAL,${statement.totals.turnover.toFixed(2)},${statement.totals.purchases.toFixed(2)},${statement.totals.vatCollected.toFixed(2)},${statement.totals.vatPaid.toFixed(2)},${statement.totals.netVatDue.toFixed(2)},${statement.totals.salesWithoutVatCount},${statement.totals.purchasesWithoutVatCount}\n`;
  csvContent += `\n`;
  csvContent += `SWISS VAT RETURN MAPPING (ACCOUNTANT REVIEW)\n`;
  csvContent += `Form code,Description,Amount CHF\n`;
  csvContent += `200,Taxable turnover (domestic supplies),${mapping.code200_taxableTurnover.toFixed(2)}\n`;
  csvContent += `220,Output tax / TVA collected on clients,${mapping.code220_outputVat.toFixed(2)}\n`;
  csvContent += `400,Input tax / TVA paid on suppliers,${mapping.code400_inputVat.toFixed(2)}\n`;
  csvContent += `500,Net VAT payable (220 - 400),${mapping.code500_netVatPayable.toFixed(2)}\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `Swiss_TVA_${modeLabel}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportSwissVatPDF = async (data: ReportData, mode: SwissVatPeriodMode) => {
  const statement = buildSwissVatStatement(data.income, data.expenses, mode);
  const mapping = buildSwissVatFormMapping(statement.totals);
  const modeLabel = mode === 'month' ? 'Monthly' : mode === 'semester' ? 'Semiannual' : 'Yearly';

  const formatCHF = (num: number) =>
    num.toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      <h1>Swiss TVA Statement</h1>
      <div class="meta">
        Session: ${data.sessionName || 'All Sessions'}<br/>
        Mode: ${modeLabel}<br/>
        ${data.dateFrom && data.dateTo ? `Filtered period: ${data.dateFrom} to ${data.dateTo}<br/>` : ''}
        Generated: ${new Date().toLocaleString()}
      </div>
      ${
        statement.totals.salesWithoutVatCount > 0 || statement.totals.purchasesWithoutVatCount > 0
          ? `<div class="warn"><strong>Warning:</strong> Missing TVA detected on ${statement.totals.salesWithoutVatCount} sales entries and ${statement.totals.purchasesWithoutVatCount} purchase entries.</div>`
          : ''
      }
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th class="num">Turnover (Clients)</th>
            <th class="num">Purchases</th>
            <th class="num">TVA Collected</th>
            <th class="num">TVA Paid</th>
            <th class="num">Net TVA Due</th>
            <th class="num">Sales w/o TVA</th>
            <th class="num">Purchases w/o TVA</th>
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
      <h2 style="margin-top: 20px;">Swiss VAT Return Mapping (Accountant Review)</h2>
      <table>
        <thead>
          <tr>
            <th>Form Code</th>
            <th>Description</th>
            <th class="num">Amount CHF</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>200</td>
            <td>Taxable turnover (domestic supplies)</td>
            <td class="num">${formatCHF(mapping.code200_taxableTurnover)}</td>
          </tr>
          <tr>
            <td>220</td>
            <td>Output tax / TVA collected on clients</td>
            <td class="num">${formatCHF(mapping.code220_outputVat)}</td>
          </tr>
          <tr>
            <td>400</td>
            <td>Input tax / TVA paid on suppliers</td>
            <td class="num">${formatCHF(mapping.code400_inputVat)}</td>
          </tr>
          <tr class="total-row">
            <td>500</td>
            <td>Net VAT payable (220 - 400)</td>
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
    alert('Please allow pop-ups to download PDF');
  }
};
