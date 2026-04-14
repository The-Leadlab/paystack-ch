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
          margin-bottom: 30px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
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
        .section {
          margin-bottom: 30px;
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
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #999;
          font-size: 10px;
          border-top: 1px solid #e5e5e5;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CAFÉ DE LA PLACE</h1>
        <p>Financial Report - ${sessionName || 'All Sessions'}</p>
        ${dateFrom && dateTo ? `<p>Period: ${dateFrom} to ${dateTo}</p>` : ''}
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Income</div>
            <div class="summary-value positive">${totalIncome.toFixed(2)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Expenses</div>
            <div class="summary-value negative">${totalExpenses.toFixed(2)} CHF</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Balance</div>
            <div class="summary-value ${balance >= 0 ? 'positive' : 'negative'}">${balance.toFixed(2)} CHF</div>
          </div>
        </div>
      </div>
      
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
                  <td class="text-right">${data.income.toFixed(2)}</td>
                  <td class="text-right">${data.expenses.toFixed(2)}</td>
                  <td class="text-right">${data.balance.toFixed(2)}</td>
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
              </tr>
            </thead>
            <tbody>
              ${supplierData.map(([supplier, amount]) => `
                <tr>
                  <td>${supplier}</td>
                  <td class="text-right">${amount.toFixed(2)}</td>
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
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${income.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${item.type}</td>
                <td class="text-right">${item.amount.toFixed(2)}</td>
                <td>${item.description || '-'}</td>
              </tr>
            `).join('')}
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
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${item.category}</td>
                <td class="text-right">${item.amount.toFixed(2)}</td>
                <td>${item.description || '-'}</td>
              </tr>
            `).join('')}
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
