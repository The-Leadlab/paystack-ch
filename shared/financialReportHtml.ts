import {
  buildLedgerRows,
  type ReportExpenseRow,
  type ReportIncomeRow,
} from "./financialReportAggregates.js";
import {
  chfLocaleFor,
  getReportExportLabels,
  type ReportExportLocale,
} from "./reportExportLabels.js";

export type FinancialReportInput = {
  income: ReportIncomeRow[];
  expenses: ReportExpenseRow[];
  monthlyData: [string, { income: number; expenses: number; balance: number }][];
  supplierData: [string, number][];
  dateFrom?: string;
  dateTo?: string;
  sessionName?: string;
  locale?: ReportExportLocale;
  labelCategory?: (category: string) => string;
  labelIncomeType?: (type: string) => string;
  includeLedger?: boolean;
};

export function buildFinancialReportHtml(data: FinancialReportInput): string {
  const {
    income,
    expenses,
    monthlyData,
    supplierData,
    dateFrom,
    dateTo,
    sessionName,
    includeLedger = false,
  } = data;
  const locale = data.locale ?? "en";
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const cat = data.labelCategory ?? ((c: string) => c);
  const incType = data.labelIncomeType ?? ((t: string) => t);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpenses;
  const vatReceived = income.reduce((sum, i) => sum + (i.vat_amount || 0), 0);
  const vatPaid = expenses.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
  const vatBalance = vatReceived - vatPaid;

  const expensesByCategory = expenses.reduce(
    (acc, exp) => {
      const key = exp.category || "OTHER";
      acc[key] = (acc[key] || 0) + exp.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const suppliersTotal = expensesByCategory["SUPPLIERS"] || 0;
  const billsTotal = expensesByCategory["BILLS"] || 0;
  const payrollTotal = expensesByCategory["PAYROLL"] || 0;
  const otherTotal = expensesByCategory["OTHER"] || 0;

  const payrollExpenses = expenses.filter((e) => e.category === "PAYROLL");
  const employeePayroll = payrollExpenses.reduce(
    (acc, exp) => {
      const employeeName = (exp.description || "")
        .replace(/^Payslip\s*[—-]\s*salary payment to employee\s*[—-]\s*/i, "")
        .replace(/^Payslip\s*\(gross paid to employee\)\s*[—-]\s*/i, "")
        .replace(/^Payslip\s*[—-]\s*/i, "")
        .replace(/^Payslip\s*-\s*/i, "")
        .trim();
      acc[employeeName] = (acc[employeeName] || 0) + exp.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const formatCHF = (num: number) =>
    num.toLocaleString(chfLoc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ledgerRows = includeLedger
    ? buildLedgerRows(income, expenses, cat, incType)
    : [];

    includeLedger && ledgerRows.length > 0
      ? `
      <div class="section">
        <div class="section-title">${L.ledgerTitle}</div>
        <p style="font-size:11px;color:#666;margin-bottom:12px;">${L.ledgerDesc}</p>
        <table>
          <thead>
            <tr>
              <th>${L.date}</th>
              <th>${L.vendor}</th>
              <th>${L.category}</th>
              <th>${L.accountCode}</th>
              <th class="text-right">${L.amountChf}</th>
              <th class="text-right">${L.vatChf}</th>
              <th>${L.description}</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows
              .map(
                (row) => `
              <tr>
                <td>${row.date}</td>
                <td>${row.vendor}</td>
                <td>${row.category}</td>
                <td>${row.account}</td>
                <td class="text-right" style="color:${row.tone === "income" ? "#059669" : "#E8423F"}">${formatCHF(row.amount)}</td>
                <td class="text-right">${formatCHF(row.vat)}</td>
                <td>${row.description}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #E8423F; padding-bottom: 20px; }
    .header h1 { color: #2B2B2B; margin: 0; font-size: 28px; }
    .header p { color: #666; margin: 5px 0; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
    .summary-item { text-align: center; }
    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .summary-value { font-size: 24px; font-weight: bold; }
    .summary-value.positive { color: #059669; }
    .summary-value.negative { color: #E8423F; }
    .summary-value.neutral { color: #2B2B2B; }
    .summary-value.accent { color: #E8423F; }
    .vat-section { background: #FFF5F4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E8E2E0; }
    .vat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .expense-breakdown { background: #f7f7f7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E8E2E0; }
    .expense-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section-title { color: #2B2B2B; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #E8423F; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #2B2B2B; color: white; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #e5e5e5; padding-top: 20px; }
    @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>PAYSTACK</h1>
    <p>${L.financialReport} - ${sessionName || L.allSessions}</p>
    ${dateFrom && dateTo ? `<p>${L.period}: ${dateFrom} ${L.periodTo} ${dateTo}</p>` : ""}
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
        <div class="summary-value ${balance >= 0 ? "positive" : "negative"}">${formatCHF(balance)} CHF</div>
      </div>
    </div>
  </div>

  <div class="vat-section">
    <div class="section-title">${L.vatSummary}</div>
    <div class="vat-grid">
      <div class="summary-item">
        <div class="summary-label">${L.vatReceived}</div>
        <div class="summary-value accent">${formatCHF(vatReceived)} CHF</div>
        <div class="summary-label">${L.fromCustomers}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">${L.vatPaid}</div>
        <div class="summary-value neutral">${formatCHF(vatPaid)} CHF</div>
        <div class="summary-label">${L.onExpenses}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">${L.vatBalance}</div>
        <div class="summary-value ${vatBalance >= 0 ? "accent" : "negative"}">${formatCHF(vatBalance)} CHF</div>
        <div class="summary-label">${vatBalance >= 0 ? L.toPay : L.refund}</div>
      </div>
    </div>
  </div>

  <div class="expense-breakdown">
    <div class="section-title">${L.expenseBreakdown}</div>
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

  ${
    Object.keys(employeePayroll).length > 0
      ? `
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
          ${Object.entries(employeePayroll)
            .map(([name, amount]) => {
              const paymentCount = payrollExpenses.filter((e) =>
                (e.description || "").includes(name)
              ).length;
              return `
                <tr>
                  <td>${name}</td>
                  <td class="text-right">${formatCHF(amount)}</td>
                  <td class="text-center">${paymentCount}</td>
                </tr>
              `;
            })
            .join("")}
          <tr style="background: #FFF5F4; font-weight: bold;">
            <td>${L.totalPayroll}</td>
            <td class="text-right">${formatCHF(payrollTotal)}</td>
            <td class="text-center">${payrollExpenses.length}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `
      : ""
  }

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
        ${monthlyData
          .map(([month, row]) => {
            const monthName = new Date(`${month}-01`).toLocaleDateString(chfLoc, {
              year: "numeric",
              month: "long",
            });
            return `
              <tr>
                <td>${monthName}</td>
                <td class="text-right">${formatCHF(row.income)}</td>
                <td class="text-right">${formatCHF(row.expenses)}</td>
                <td class="text-right">${formatCHF(row.balance)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  </div>

  ${
    supplierData.length > 0
      ? `
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
          ${supplierData
            .map(
              ([supplier, amount]) => `
            <tr>
              <td>${supplier}</td>
              <td class="text-right">${formatCHF(amount)}</td>
              <td class="text-right">${suppliersTotal > 0 ? ((amount / suppliersTotal) * 100).toFixed(1) : "0.0"}%</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `
      : ""
  }

  <div class="section">
    <div class="section-title">${L.incomeDetailsN.replace("{n}", String(income.length))}</div>
    <table>
      <thead>
        <tr>
          <th>${L.date}</th>
          <th>${L.vendor}</th>
          <th>${L.type}</th>
          <th>${L.accountCode}</th>
          <th class="text-right">${L.amountChf}</th>
          <th class="text-right">${L.vatChf}</th>
          <th>${L.description}</th>
        </tr>
      </thead>
      <tbody>
        ${income
          .map(
            (item) => `
          <tr>
            <td>${item.date}</td>
            <td>${item.description || "-"}</td>
            <td>${incType(item.type || "")}</td>
            <td>${item.account_code || "-"}</td>
            <td class="text-right">${formatCHF(item.amount)}</td>
            <td class="text-right">${formatCHF(item.vat_amount || 0)}</td>
            <td>${item.description || "-"}</td>
          </tr>
        `
          )
          .join("")}
        <tr style="background: #FFF5F4; font-weight: bold;">
          <td colspan="4">${L.totalIncomeRow}</td>
          <td class="text-right">${formatCHF(totalIncome)}</td>
          <td class="text-right">${formatCHF(vatReceived)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">${L.expenseDetailsN.replace("{n}", String(expenses.length))}</div>
    <table>
      <thead>
        <tr>
          <th>${L.date}</th>
          <th>${L.vendor}</th>
          <th>${L.category}</th>
          <th>${L.accountCode}</th>
          <th class="text-right">${L.amountChf}</th>
          <th class="text-right">${L.vatChf}</th>
          <th>${L.description}</th>
        </tr>
      </thead>
      <tbody>
        ${expenses
          .map(
            (item) => `
          <tr>
            <td>${item.date}</td>
            <td>${item.description || "-"}</td>
            <td>${cat(item.category || "")}</td>
            <td>${item.account_code || "-"}</td>
            <td class="text-right">${formatCHF(item.amount)}</td>
            <td class="text-right">${formatCHF(item.vat_amount || 0)}</td>
            <td>${item.description || "-"}</td>
          </tr>
        `
          )
          .join("")}
        <tr style="background: #FFF5F4; font-weight: bold;">
          <td colspan="4">${L.totalExpensesRow}</td>
          <td class="text-right">${formatCHF(totalExpenses)}</td>
          <td class="text-right">${formatCHF(vatPaid)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${ledgerHtml}

  <div class="footer">
    <p>${L.footerGenerated}</p>
    <p>© ${new Date().getFullYear()} Paystack.ch</p>
  </div>
</body>
</html>`;
}
