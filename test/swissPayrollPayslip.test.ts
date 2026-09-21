import { describe, expect, it } from "vitest";
import {
  applyPayrollPaymentFields,
  payrollLineKind,
  resolveEmployeePaymentAmount,
  resolveGrossPayFromFinancialData,
  resolvePayrollAmounts,
} from "../client/src/cafe/services/swissPayrollService";
import { DocumentType, type FinancialData } from "../client/src/cafe/types";

function payslip(partial: Partial<NonNullable<FinancialData["paySlip"]>>): FinancialData {
  return {
    documentType: DocumentType.PAY_SLIP,
    date: "2026-03-31",
    issuer: "Cafe de la Place",
    documentNumber: "BS-03",
    totalAmount: 0,
    originalCurrency: "CHF",
    vatAmount: 0,
    netAmount: 0,
    expenseCategory: "PAYROLL",
    amountInCHF: 0,
    conversionRateUsed: 1,
    notes: "",
    paySlip: {
      employee: { name: "Adrian" },
      employer: { name: "Cafe de la Place" },
      components: [],
      ...partial,
    },
  };
}

describe("French Swiss payslip labels", () => {
  it("does not treat salaire général as salaire brut", () => {
    expect(payrollLineKind("Salaire général")).toBe("base_salary");
    expect(payrollLineKind("Salaire brut")).toBe("gross_total");
    expect(payrollLineKind("Chèque salarié")).toBe("payment");
    expect(payrollLineKind("Salaire net")).toBe("net_total");
  });

  it("copies labeled Salaire brut and Chèque salarié even if Gemini put salaire général in grossPay", () => {
    const data = payslip({
      grossPay: 4200,
      netPay: 3500,
      components: [
        { date: "2026-03-31", description: "Salaire général", amount: 4200, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "Heures supplémentaires", amount: 400, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "Salaire brut", amount: 4600, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "AVS/AI/APG", amount: 250, type: "EXPENSE", category: "PAYROLL_TAXES" },
        { date: "2026-03-31", description: "Chèque salarié", amount: 3800, type: "INCOME", category: "PAYROLL" },
      ],
    });

    const fixed = applyPayrollPaymentFields(data);
    expect(resolveGrossPayFromFinancialData(fixed)).toBe(4600);
    expect(resolveEmployeePaymentAmount(fixed)).toBe(3800);
    expect(fixed.paySlip?.grossPay).toBe(4600);
    expect(fixed.paySlip?.paymentToEmployee).toBe(3800);
    expect(fixed.totalAmount).toBe(4600);

    const amounts = resolvePayrollAmounts(fixed);
    expect(amounts.gross).toBe(4600);
    expect(amounts.employeePayment).toBe(3800);
    expect(amounts.statePayment).toBe(800);
  });

  it("does not sum salaire brut + salaire général + chèque as gross", () => {
    const data = payslip({
      grossPay: 4200,
      components: [
        { date: "2026-03-31", description: "Salaire général", amount: 4200, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "Salaire brut", amount: 4600, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "Chèque salarié", amount: 3800, type: "INCOME", category: "PAYROLL" },
      ],
    });
    expect(resolveGrossPayFromFinancialData(applyPayrollPaymentFields(data))).toBe(4600);
  });

  it("replaces salaire général copied into grossPay when other earnings exist", () => {
    const data = payslip({
      grossPay: 4200,
      components: [
        { date: "2026-03-31", description: "Salaire général", amount: 4200, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "13e salaire", amount: 350, type: "INCOME", category: "PAYROLL" },
      ],
    });
    expect(resolveGrossPayFromFinancialData(applyPayrollPaymentFields(data))).toBe(4550);
  });

  it("does not treat chèque salarié as salaire brut", () => {
    const data = payslip({
      grossPay: 3800,
      paymentToEmployee: 3800,
      components: [
        { date: "2026-03-31", description: "Salaire général", amount: 4200, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "Heures supplémentaires", amount: 400, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "Chèque salarié", amount: 3800, type: "INCOME", category: "PAYROLL" },
      ],
    });
    const fixed = applyPayrollPaymentFields(data);
    expect(resolveGrossPayFromFinancialData(fixed)).toBe(4600);
    expect(resolveEmployeePaymentAmount(fixed)).toBe(3800);
    expect(fixed.paySlip?.grossPay).toBe(4600);
  });
});
