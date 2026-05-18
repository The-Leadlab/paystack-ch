import type { FinancialData } from "../types";

/** Swiss work permit / residency categories affecting payroll settlement. */
export type SwissPermitType = "B" | "C" | "G" | "F" | "CH" | "UNKNOWN";

/**
 * source_tax — employer pays net to employee + deductions to state (B, G, F frontaliers).
 * gross_paid — employee receives full gross; taxes paid yearly (C, Swiss nationals).
 */
export type PayrollSettlementMode = "source_tax" | "gross_paid";

export type PayrollExpenseLine = {
  category: "PAYROLL" | "PAYROLL_TAXES";
  amount: number;
  description: string;
};

export const PAYROLL_COST_CATEGORIES = ["PAYROLL", "PAYROLL_TAXES"] as const;

export function isPayrollCostCategory(category: string): boolean {
  return PAYROLL_COST_CATEGORIES.includes(category as (typeof PAYROLL_COST_CATEGORIES)[number]);
}

export function settlementModeForPermit(permit: SwissPermitType | undefined): PayrollSettlementMode {
  if (permit === "C" || permit === "CH") return "gross_paid";
  return "source_tax";
}

export function resolvePayrollSettlementMode(data: FinancialData): PayrollSettlementMode {
  if (data.payrollSettlementMode === "gross_paid" || data.payrollSettlementMode === "source_tax") {
    return data.payrollSettlementMode;
  }
  return settlementModeForPermit(data.paySlip?.permitType);
}

export function resolveNetPayFromFinancialData(data: FinancialData): number {
  const components = data.paySlip?.components ?? [];
  const grossFromComponents = components
    .filter((c) => c.type === "INCOME")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const deductionsFromComponents = components
    .filter((c) => c.type === "EXPENSE")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const netFromComponents = grossFromComponents - deductionsFromComponents;
  if (netFromComponents > 0) return Math.round(netFromComponents * 100) / 100;

  const directNet = Number(data.paySlip?.netPay || 0);
  if (directNet > 0) return Math.round(directNet * 100) / 100;

  const netAmount = Number(data.netAmount || 0);
  if (netAmount > 0) return Math.round(netAmount * 100) / 100;

  const total = Number(data.totalAmount || 0);
  const gross = Number(data.paySlip?.grossPay || 0);
  if (gross > 0 && Math.abs(total - gross) < 0.01) return 0;

  return total > 0 ? Math.round(total * 100) / 100 : 0;
}

export function resolveGrossPayFromFinancialData(data: FinancialData): number {
  const components = data.paySlip?.components ?? [];
  const grossFromComponents = components
    .filter((c) => c.type === "INCOME")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  if (grossFromComponents > 0) return Math.round(grossFromComponents * 100) / 100;

  const directGross = Number(data.paySlip?.grossPay || 0);
  if (directGross > 0) return Math.round(directGross * 100) / 100;

  const total = Number(data.totalAmount || 0);
  const net = resolveNetPayFromFinancialData(data);
  if (total > 0 && net > 0 && total > net) return Math.round(total * 100) / 100;
  if (total > 0 && net <= 0) return Math.round(total * 100) / 100;

  return 0;
}

export function resolvePayrollAmounts(data: FinancialData): {
  gross: number;
  net: number;
  deductions: number;
} {
  const gross = resolveGrossPayFromFinancialData(data);
  const net = resolveNetPayFromFinancialData(data);
  const deductions =
    gross > 0 && net > 0 ? Math.max(0, Math.round((gross - net) * 100) / 100) : 0;
  return { gross, net, deductions };
}

export function buildPayrollExpenseLines(
  data: FinancialData,
  employeeName: string,
  mode?: PayrollSettlementMode
): PayrollExpenseLine[] {
  const settlement = mode ?? resolvePayrollSettlementMode(data);
  const { gross, net, deductions } = resolvePayrollAmounts(data);
  const name = employeeName.trim() || "Employee";

  if (settlement === "gross_paid") {
    const amount = gross > 0 ? gross : net;
    if (amount <= 0) return [];
    return [
      {
        category: "PAYROLL",
        amount,
        description: `Payslip (gross paid to employee) - ${name}`,
      },
    ];
  }

  const lines: PayrollExpenseLine[] = [];
  if (net > 0) {
    lines.push({
      category: "PAYROLL",
      amount: net,
      description: `Payslip (net to employee) - ${name}`,
    });
  }
  if (deductions > 0.01) {
    lines.push({
      category: "PAYROLL_TAXES",
      amount: deductions,
      description: `Payroll taxes & social contributions (to state) - ${name}`,
    });
  }
  return lines;
}

/** Total employer payroll cost (always gross when known). */
export function totalEmployerPayrollCost(data: FinancialData): number {
  const { gross, net, deductions } = resolvePayrollAmounts(data);
  if (gross > 0) return gross;
  return net + deductions;
}
