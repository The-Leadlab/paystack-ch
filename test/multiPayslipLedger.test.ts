import { describe, expect, it } from "vitest";
import { postLedgerFromFinancialData } from "../client/src/cafe/lib/postLedgerFromFinancialData";
import { DocumentType, type Expense, type FinancialData, type Income } from "../client/src/cafe/types";

function multiEmployeePayslip(): FinancialData {
  return {
    documentType: DocumentType.PAY_SLIP,
    date: "2026-03-31",
    issuer: "Cafe de la Place",
    documentNumber: "BATCH",
    totalAmount: 9000,
    originalCurrency: "CHF",
    vatAmount: 0,
    netAmount: 0,
    expenseCategory: "PAYROLL",
    amountInCHF: 9000,
    conversionRateUsed: 1,
    notes: "",
    paySlip: {
      employee: { name: "Alice" },
      employer: { name: "Cafe de la Place" },
      grossPay: 5000,
      netPay: 4200,
      paymentToEmployee: 4200,
      permitType: "C",
      components: [],
    },
    subDocuments: [
      {
        documentType: DocumentType.PAY_SLIP,
        date: "2026-03-31",
        issuer: "Cafe de la Place",
        documentNumber: "P1",
        totalAmount: 5000,
        originalCurrency: "CHF",
        vatAmount: 0,
        netAmount: 4200,
        expenseCategory: "PAYROLL",
        amountInCHF: 5000,
        conversionRateUsed: 1,
        notes: "",
        paySlip: {
          employee: { name: "Alice" },
          employer: { name: "Cafe de la Place" },
          grossPay: 5000,
          netPay: 4200,
          paymentToEmployee: 4200,
          permitType: "C",
          components: [],
        },
      },
      {
        documentType: DocumentType.PAY_SLIP,
        date: "2026-03-31",
        issuer: "Cafe de la Place",
        documentNumber: "P2",
        totalAmount: 4000,
        originalCurrency: "CHF",
        vatAmount: 0,
        netAmount: 3400,
        expenseCategory: "PAYROLL",
        amountInCHF: 4000,
        conversionRateUsed: 1,
        notes: "",
        paySlip: {
          employee: { name: "Bob" },
          employer: { name: "Cafe de la Place" },
          grossPay: 4000,
          netPay: 3400,
          paymentToEmployee: 3400,
          permitType: "C",
          components: [],
        },
      },
    ],
  };
}

describe("multi-employee payslip ledger", () => {
  it("posts one payroll expense per employee in a combined PDF", async () => {
    const expenses: Array<Pick<Expense, "amount" | "description" | "category">> = [];
    const writers = {
      addIncome: async () => null as Income | null,
      addExpense: async (
        _date: string,
        category: Expense["category"],
        amount: number,
        description: string
      ) => {
        expenses.push({ category, amount, description });
        return null;
      },
    };

    const result = await postLedgerFromFinancialData(
      writers,
      multiEmployeePayslip(),
      "salaries.pdf",
      "session-1",
      "doc-1"
    );

    expect(result.expensePosted).toBe(2);
    expect(expenses).toHaveLength(2);
    expect(expenses.map((e) => e.amount).sort()).toEqual([4000, 5000]);
    expect(expenses.every((e) => e.category === "PAYROLL")).toBe(true);
    expect(expenses.some((e) => /Alice/i.test(e.description))).toBe(true);
    expect(expenses.some((e) => /Bob/i.test(e.description))).toBe(true);
  });
});
