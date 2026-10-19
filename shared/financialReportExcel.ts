/**
 * Server-safe Excel builder for emailed financial reports (income + expenses sheets).
 * Client download uses a richer workbook in reportExportService; this covers email/cron.
 */
import * as XLSX from "xlsx";
import {
  buildMonthlyData,
  buildSupplierData,
  type ReportExpenseRow,
  type ReportIncomeRow,
} from "./financialReportAggregates.js";
import {
  chfLocaleFor,
  getReportExportLabels,
  type ReportExportLocale,
} from "./reportExportLabels.js";

export type ServerExcelReportInput = {
  income: ReportIncomeRow[];
  expenses: ReportExpenseRow[];
  dateFrom: string;
  dateTo: string;
  sessionName: string;
  locale: ReportExportLocale;
  currency?: string;
};

function money(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function autosizeSheet(
  sheet: XLSX.WorkSheet,
  rows: Array<Array<string | number>>,
  min = 10,
  max = 48
) {
  sheet["!cols"] = rows[0]?.map((_, colIdx) => {
    let width = min;
    for (const row of rows) {
      const cell = row[colIdx];
      const len = String(cell ?? "").length;
      if (len > width) width = len;
    }
    return { wch: Math.min(max, width + 2) };
  });
}

function splitVendor(raw: string | undefined, fallback: string): { vendor: string; detail: string } {
  const text = String(raw || "").trim();
  if (!text) return { vendor: "—", detail: fallback };
  const parts = text.split(/\s*[—–\-|:]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { vendor: parts[0], detail: parts.slice(1).join(" — ") };
  }
  return { vendor: text, detail: fallback };
}

/** Build a .xlsx workbook as a Node Buffer (for Resend attachments). */
export function buildFinancialReportExcelBuffer(input: ServerExcelReportInput): Buffer {
  const locale = input.locale ?? "en";
  const L = getReportExportLabels(locale);
  const chfLoc = chfLocaleFor(locale);
  const currency = input.currency || "CHF";
  const income = input.income ?? [];
  const expenses = input.expenses ?? [];
  const monthlyData = buildMonthlyData(income, expenses);
  const supplierData = buildSupplierData(expenses, "Unknown");

  const totalIncome = income.reduce((sum, i) => sum + money(i.amount), 0);
  const operatingExpenses = expenses.filter((e) => e.category !== "PAYROLL");
  const totalExpenses = operatingExpenses.reduce((sum, e) => sum + money(e.amount), 0);
  const totalPayroll = expenses
    .filter((e) => e.category === "PAYROLL")
    .reduce((sum, e) => sum + money(e.amount), 0);
  const balance = totalIncome - totalExpenses - totalPayroll;
  const vatReceived = income.reduce((sum, i) => sum + money(i.vat_amount), 0);
  const vatPaid = expenses.reduce((sum, e) => sum + money(e.vat_amount), 0);
  const vatBalance = vatReceived - vatPaid;

  const summaryRows: Array<Array<string | number>> = [
    [L.financialReport, input.sessionName || L.allSessions],
    ...(input.dateFrom && input.dateTo
      ? [[L.period, `${input.dateFrom} ${L.periodTo} ${input.dateTo}`]]
      : []),
    [L.generated, new Date().toLocaleString(chfLoc)],
    [],
    [L.summary, ""],
    [L.totalIncome, round2(totalIncome), currency],
    [L.totalExpenses, round2(totalExpenses), currency],
    ["Payroll (net)", round2(totalPayroll), currency],
    [L.balance, round2(balance), currency],
    [],
    [L.vatSummary, ""],
    [L.vatReceived, round2(vatReceived), currency, L.fromCustomers],
    [L.vatPaid, round2(vatPaid), currency, L.onExpenses],
    [L.vatBalance, round2(vatBalance), currency, vatBalance >= 0 ? L.toPay : L.refund],
  ];

  const monthlyRows: Array<Array<string | number>> = [
    [
      L.month,
      L.incomeChf.replace("(CHF)", `(${currency})`),
      L.expensesChf.replace("(CHF)", `(${currency})`),
      L.balanceChf.replace("(CHF)", `(${currency})`),
    ],
  ];
  for (const [month, row] of monthlyData) {
    const monthName = new Date(month + "-01").toLocaleDateString(chfLoc, {
      year: "numeric",
      month: "long",
    });
    monthlyRows.push([
      monthName,
      round2(money(row.income)),
      round2(money(row.expenses)),
      round2(money(row.balance)),
    ]);
  }

  const supplierRows: Array<Array<string | number>> = [
    [L.supplier, L.amountChf.replace("(CHF)", `(${currency})`)],
  ];
  for (const [supplier, amount] of supplierData) {
    supplierRows.push([supplier, round2(money(amount))]);
  }

  const incomeRows: Array<Array<string | number>> = [
    [
      L.date,
      L.vendor,
      L.type,
      L.accountCode,
      L.amountChf.replace("(CHF)", `(${currency})`),
      L.vatChf.replace("(CHF)", `(${currency})`),
      L.description,
    ],
  ];
  for (const item of income) {
    const { vendor, detail } = splitVendor(item.description, String(item.type || "INCOME"));
    incomeRows.push([
      item.date,
      vendor,
      String(item.type || ""),
      item.account_code || "",
      round2(money(item.amount)),
      round2(money(item.vat_amount)),
      detail,
    ]);
  }

  const expenseRows: Array<Array<string | number>> = [
    [
      L.date,
      L.vendor,
      L.category,
      L.accountCode,
      L.amountChf.replace("(CHF)", `(${currency})`),
      L.vatChf.replace("(CHF)", `(${currency})`),
      L.description,
    ],
  ];
  for (const item of expenses) {
    const cat = item.ai_category || item.category || "OTHER";
    const { vendor, detail } = splitVendor(item.description, String(cat));
    expenseRows.push([
      item.date,
      vendor,
      String(cat),
      item.account_code || "",
      round2(money(item.amount)),
      round2(money(item.vat_amount)),
      detail,
    ]);
  }

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

  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  return Buffer.from(raw);
}
