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

export type PayrollLineKind =
  | "gross_total"
  | "net_total"
  | "payment"
  | "base_salary"
  | "advance"
  | "other";

/** Strip accents so "chèque salarié" / "salaire général" match reliably. */
export function normalizePayrollLabel(description: string | null | undefined): string {
  return String(description || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Swiss/French payslip row kind.
 * "Salaire général" is base pay (a component). "Salaire brut" is the labeled GROSS TOTAL.
 * "Chèque salarié" is the amount actually paid to the employee — not gross.
 */
export function payrollLineKind(description: string | null | undefined): PayrollLineKind {
  const d = normalizePayrollLabel(description);
  if (!d) return "other";

  if (/(acompte|avance|advance|anticipo)/.test(d) && !/sans acompte/.test(d)) return "advance";

  if (
    /cheque\s*salarie|cheque\s*salaire|net\s*a\s*(payer|verser)|net\s*to\s*pay|montant\s*verse|a\s*payer\s*au\s*salarie|versement(\s*salar)?|lohnauszahlung|\bauszahlung\b|remittance|virement(\s*salar)?|paiement(\s*final|\s*salar)/.test(
      d
    )
  ) {
    return "payment";
  }

  if (
    /salaire\s*brut|brut\s*total|total\s*brut|montant\s*brut|remuneration\s*brute|bruttolohn|brutto\s*lohn|retribuzion[ei]\s*lord|gross\s*pay|gross\s*salary|total\s*gross/.test(
      d
    )
  ) {
    return "gross_total";
  }

  if (
    /salaire\s*net|nettolohn|netto\s*lohn|retribuzion[ei]\s*nett|net\s*pay|net\s*salary|total\s*net/.test(d)
  ) {
    return "net_total";
  }

  if (
    /salaire\s*general|salaire\s*de\s*base|salaire\s*mensuel|salaire\s*horaire|basic\s*salary|base\s*salary|grundlohn|lohnansatz|stipendio\s*base|retribuzione\s*base/.test(
      d
    )
  ) {
    return "base_salary";
  }

  return "other";
}

export function isPayrollSummaryComponent(description: string | null | undefined): boolean {
  const kind = payrollLineKind(description);
  return kind === "gross_total" || kind === "net_total" || kind === "payment";
}

function firstComponentAmount(
  components: BankTransaction[],
  kind: PayrollLineKind
): number {
  for (const c of components) {
    if (payrollLineKind(c.description) !== kind) continue;
    const amt = Math.abs(Number(c.amount) || 0);
    if (amt > 0) return round2(amt);
  }
  return 0;
}

function earningComponents(components: BankTransaction[]): BankTransaction[] {
  return components.filter(
    (c) => c.type === "INCOME" && !isPayrollSummaryComponent(c.description)
  );
}

function deductionComponents(components: BankTransaction[]): BankTransaction[] {
  return components.filter(
    (c) => c.type === "EXPENSE" && !isPayrollSummaryComponent(c.description)
  );
}

/** Net salary paid to employee (dashboard Payroll card). */
export function isNetPayrollCategory(category: string): boolean {
  return category === "PAYROLL";
}

/** Taxes & social contributions paid to the state (counts as expense, not payroll). */
export function isPayrollTaxCategory(category: string): boolean {
  return category === "PAYROLL_TAXES";
}

export function isPayrollCostCategory(category: string): boolean {
  return isNetPayrollCategory(category) || isPayrollTaxCategory(category);
}

/** Amount shown in the analysis table Amount column. */
export function documentTableDisplayAmount(data: FinancialData): number {
  const isPaySlip =
    Boolean(data.paySlip) || /pay\s*slip|payslip|salaire|paie/i.test(String(data.documentType || ""));
  if (!isPaySlip) {
    return Number(data.amountInCHF ?? data.totalAmount ?? 0);
  }
  const settlement = resolvePayrollSettlementMode(data);
  if (settlement === "gross_paid") {
    const gross = resolveGrossPayFromFinancialData(data);
    return gross > 0 ? gross : Number(data.amountInCHF ?? data.totalAmount ?? 0);
  }
  const employeePayment = resolveEmployeePaymentAmount(data);
  return employeePayment > 0 ? employeePayment : Number(data.netAmount ?? data.amountInCHF ?? 0);
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
  const labeledNet = firstComponentAmount(components, "net_total");
  if (labeledNet > 0) return labeledNet;

  const directNet = Number(data.paySlip?.netPay || 0);
  if (directNet > 0) return round2(directNet);

  const netAmount = Number(data.netAmount || 0);
  if (netAmount > 0) return round2(netAmount);

  const earnings = earningComponents(components).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const deductions = deductionComponents(components).reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );
  const netFromComponents = earnings - deductions;
  if (netFromComponents > 0) return round2(netFromComponents);

  const total = Number(data.totalAmount || 0);
  const gross = Number(data.paySlip?.grossPay || 0);
  if (gross > 0 && Math.abs(total - gross) < 0.01) return 0;

  return total > 0 ? round2(total) : 0;
}

export function resolveGrossPayFromFinancialData(data: FinancialData): number {
  const components = data.paySlip?.components ?? [];
  const labeledGross = firstComponentAmount(components, "gross_total");
  if (labeledGross > 0) return labeledGross;

  const printed = Number(data.paySlip?.grossPay || 0);
  const baseSalary = firstComponentAmount(components, "base_salary");
  const labeledPay = firstComponentAmount(components, "payment");
  const explicitPay = Number(data.paySlip?.paymentToEmployee || 0);
  const paymentAmt = labeledPay > 0 ? labeledPay : explicitPay;
  const earningSum = earningComponents(components).reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );

  const printedIsBase =
    printed > 0 && baseSalary > 0 && Math.abs(printed - baseSalary) < 0.02;
  const printedIsPayment =
    printed > 0 && paymentAmt > 0 && Math.abs(printed - paymentAmt) < 0.02;

  // Never keep "salaire général" or "chèque salarié" as salaire brut when real earnings exist.
  if (printed > 0 && !printedIsPayment && !printedIsBase) {
    return round2(printed);
  }
  if (printedIsBase && earningSum > printed + 0.02) {
    return round2(earningSum);
  }
  if (printedIsPayment) {
    if (earningSum > printed + 0.02) return round2(earningSum);
    if (baseSalary > printed + 0.02) return round2(baseSalary);
    if (earningSum > 0) return round2(earningSum);
  }
  if (printed > 0 && !printedIsPayment) return round2(printed);
  if (earningSum > 0) return round2(earningSum);

  const total = Number(data.totalAmount || 0);
  const net = Number(data.paySlip?.netPay || data.netAmount || 0);
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
  const labeledCheque = firstComponentAmount(components, "payment");
  if (explicit > 0 && (gross <= 0 || explicit <= gross + 0.01)) {
    if (
      labeledCheque > 0 &&
      gross > 0 &&
      Math.abs(explicit - gross) < 0.02 &&
      labeledCheque < gross - 0.02
    ) {
      return labeledCheque;
    }
    return round2(explicit);
  }

  if (labeledCheque > 0 && (gross <= 0 || labeledCheque <= gross + 0.01)) {
    return labeledCheque;
  }

  const paymentLines = components.filter(
    (c) =>
      payrollLineKind(c.description) === "payment" ||
      ((/\b(payment|remittance|virement|paiement|überweisung|versamento|vergütung|cheque)\b/i.test(
        c.description || ""
      ) ||
        /^(payment|remittance|virement|paiement)\b/i.test((c.description || "").trim())) &&
        payrollLineKind(c.description) !== "advance")
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

/** Copy labeled Swiss/French totals off component rows, then sync payment fields. */
export function applyPayrollPaymentFields(data: FinancialData): FinancialData {
  if (!data.paySlip) return data;
  const components = data.paySlip.components ?? [];
  const labeledGross = firstComponentAmount(components, "gross_total");
  const labeledNet = firstComponentAmount(components, "net_total");
  const labeledPay = firstComponentAmount(components, "payment");
  const baseSalary = firstComponentAmount(components, "base_salary");

  let grossPay = Number(data.paySlip.grossPay || 0);
  const earningSum = earningComponents(components).reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );
  if (labeledGross > 0) {
    grossPay = labeledGross;
  } else if (earningSum > 0) {
    const looksLikeBase = baseSalary > 0 && Math.abs(grossPay - baseSalary) < 0.02;
    const looksLikeCheque = labeledPay > 0 && Math.abs(grossPay - labeledPay) < 0.02;
    if (grossPay <= 0 || looksLikeBase || looksLikeCheque) {
      if (earningSum > grossPay + 0.02 || grossPay <= 0) grossPay = earningSum;
    }
  }

  const netPay = labeledNet > 0 ? labeledNet : Number(data.paySlip.netPay || 0);
  const withLabels: FinancialData = {
    ...data,
    paySlip: {
      ...data.paySlip,
      grossPay: grossPay > 0 ? grossPay : data.paySlip.grossPay,
      netPay: netPay > 0 ? netPay : data.paySlip.netPay,
      paymentToEmployee:
        labeledPay > 0 ? labeledPay : data.paySlip.paymentToEmployee,
    },
  };

  const employeePayment = resolveEmployeePaymentAmount(withLabels);
  const gross = resolveGrossPayFromFinancialData(withLabels);
  return {
    ...withLabels,
    paySlip: {
      ...withLabels.paySlip!,
      paymentToEmployee:
        employeePayment > 0 ? employeePayment : withLabels.paySlip?.paymentToEmployee,
      grossPay: gross > 0 ? gross : withLabels.paySlip?.grossPay,
      netPay: netPay > 0 ? netPay : withLabels.paySlip?.netPay,
    },
    netAmount: employeePayment > 0 ? employeePayment : withLabels.netAmount,
    totalAmount: gross > 0 ? gross : withLabels.totalAmount,
    amountInCHF: gross > 0 ? gross : withLabels.amountInCHF,
  };
}
