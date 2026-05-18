import type { BankTransaction, FinancialData } from "../types";

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
  if (netFromComponents > 0) return round2(netFromComponents);

  const directNet = Number(data.paySlip?.netPay || 0);
  if (directNet > 0) return round2(directNet);

  const netAmount = Number(data.netAmount || 0);
  if (netAmount > 0) return round2(netAmount);

  const total = Number(data.totalAmount || 0);
  const gross = Number(data.paySlip?.grossPay || 0);
  if (gross > 0 && Math.abs(total - gross) < 0.01) return 0;

  return total > 0 ? round2(total) : 0;
}

export function resolveGrossPayFromFinancialData(data: FinancialData): number {
  const components = data.paySlip?.components ?? [];
  const grossFromComponents = components
    .filter((c) => c.type === "INCOME")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  if (grossFromComponents > 0) return round2(grossFromComponents);

  const directGross = Number(data.paySlip?.grossPay || 0);
  if (directGross > 0) return round2(directGross);

  const total = Number(data.totalAmount || 0);
  const net = resolveNetPayFromFinancialData(data);
  if (total > 0 && net > 0 && total > net) return round2(total);
  if (total > 0 && net <= 0) return round2(total);

  return 0;
}

function advanceTotalFromComponents(components: BankTransaction[]): number {
  return components
    .filter((c) => /advance|acompte|avance|anticipo/i.test(c.description || ""))
    .reduce((sum, c) => sum + Math.abs(Number(c.amount) || 0), 0);
}

/**
 * Amount that leaves the company to the employee (Payment / Remittance).
 * Falls back to net salary when no separate payment line exists.
 */
export function resolveEmployeePaymentAmount(data: FinancialData): number {
  const ps = data.paySlip;
  const gross = resolveGrossPayFromFinancialData(data);
  const components = ps?.components ?? [];

  const explicit = Number(ps?.paymentToEmployee ?? 0);
  if (explicit > 0 && (gross <= 0 || explicit <= gross + 0.01)) {
    return round2(explicit);
  }

  const paymentLines = components.filter(
    (c) =>
      (/\b(payment|remittance|virement|paiement|überweisung|versamento|vergütung)\b/i.test(
        c.description || ""
      ) ||
        /^(payment|remittance|virement|paiement)\b/i.test((c.description || "").trim())) &&
      !/advance|acompte|avance/i.test(c.description || "")
  );
  if (paymentLines.length > 0) {
    const amt = Math.abs(Number(paymentLines[paymentLines.length - 1].amount) || 0);
    if (amt > 0 && (gross <= 0 || amt <= gross + 0.01)) return round2(amt);
  }

  const netPay = Number(ps?.netPay || 0) || resolveNetPayFromFinancialData(data);
  const advances = advanceTotalFromComponents(components);
  if (netPay > 0 && advances > 0.01) {
    const afterAdvance = round2(netPay - advances);
    if (afterAdvance > 0 && (gross <= 0 || afterAdvance <= gross + 0.01)) {
      return afterAdvance;
    }
  }

  if (netPay > 0 && (gross <= 0 || netPay <= gross + 0.01)) return round2(netPay);

  const netAmount = Number(data.netAmount || 0);
  if (netAmount > 0 && gross > 0 && netAmount < gross - 0.01) {
    return round2(netAmount);
  }

  return 0;
}

export function resolvePayrollAmounts(data: FinancialData): {
  gross: number;
  /** Payment 1 — to employee */
  net: number;
  employeePayment: number;
  netSalary: number;
  /** Payment 2 — to state (gross − employee payment) */
  deductions: number;
  statePayment: number;
} {
  const gross = resolveGrossPayFromFinancialData(data);
  const netSalary = resolveNetPayFromFinancialData(data);
  const employeePayment = resolveEmployeePaymentAmount(data);
  const statePayment =
    gross > 0 && employeePayment > 0
      ? round2(Math.max(0, gross - employeePayment))
      : 0;

  return {
    gross,
    net: employeePayment,
    employeePayment,
    netSalary,
    deductions: statePayment,
    statePayment,
  };
}

export function buildPayrollExpenseLines(
  data: FinancialData,
  employeeName: string,
  mode?: PayrollSettlementMode
): PayrollExpenseLine[] {
  const settlement = mode ?? resolvePayrollSettlementMode(data);
  const { gross, employeePayment, statePayment } = resolvePayrollAmounts(data);
  const name = employeeName.trim() || "Employee";

  if (settlement === "gross_paid") {
    const amount = gross > 0 ? gross : employeePayment;
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
  if (employeePayment > 0) {
    lines.push({
      category: "PAYROLL",
      amount: employeePayment,
      description: `Payslip — salary payment to employee - ${name}`,
    });
  }
  if (statePayment > 0.01) {
    lines.push({
      category: "PAYROLL_TAXES",
      amount: statePayment,
      description: `Payslip — 2nd payment: taxes & contributions to state (gross − employee payment) - ${name}`,
    });
  }
  return lines;
}

/** Total employer payroll cost (always gross when known). */
export function totalEmployerPayrollCost(data: FinancialData): number {
  const { gross, employeePayment, statePayment } = resolvePayrollAmounts(data);
  if (gross > 0) return gross;
  return employeePayment + statePayment;
}

/** Sync paySlip.paymentToEmployee and netAmount from extracted components. */
export function applyPayrollPaymentFields(data: FinancialData): FinancialData {
  if (!data.paySlip) return data;
  const employeePayment = resolveEmployeePaymentAmount(data);
  const gross = resolveGrossPayFromFinancialData(data);
  return {
    ...data,
    paySlip: {
      ...data.paySlip,
      paymentToEmployee: employeePayment > 0 ? employeePayment : data.paySlip.paymentToEmployee,
      grossPay: data.paySlip.grossPay ?? (gross > 0 ? gross : undefined),
    },
    netAmount: employeePayment > 0 ? employeePayment : data.netAmount,
    totalAmount: gross > 0 ? gross : data.totalAmount,
    amountInCHF: gross > 0 ? gross : data.amountInCHF,
  };
}
