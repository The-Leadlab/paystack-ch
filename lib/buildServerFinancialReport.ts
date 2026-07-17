import {
  buildMonthlyData,
  buildSupplierData,
  type ReportExpenseRow,
  type ReportIncomeRow,
} from "../shared/financialReportAggregates.js";
import { buildFinancialReportHtml } from "../shared/financialReportHtml.js";
import {
  type ReportExportLocale,
} from "../shared/reportExportLabels.js";

export type ServerReportInput = {
  income: ReportIncomeRow[];
  expenses: ReportExpenseRow[];
  dateFrom: string;
  dateTo: string;
  sessionName: string;
  locale: ReportExportLocale;
  includeLedger?: boolean;
};

export function buildServerFinancialReportHtml(input: ServerReportInput): string {
  const monthlyData = buildMonthlyData(input.income, input.expenses);
  const supplierData = buildSupplierData(input.expenses, "Unknown");

  return buildFinancialReportHtml({
    income: input.income,
    expenses: input.expenses,
    monthlyData,
    supplierData,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    sessionName: input.sessionName,
    locale: input.locale,
    labelCategory: (cat) => cat,
    labelIncomeType: (type) => type,
    includeLedger: input.includeLedger ?? false,
  });
}
