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

  it("posts a single salary when the same employee is duplicated across pages", async () => {
    const expenses: Array<Pick<Expense, "amount" | "description" | "category" | "vat">> = [];
    const writers = {
      addIncome: async () => null as Income | null,
      addExpense: async (
        _date: string,
        category: Expense["category"],
        amount: number,
        description: string,
        _sessionId: string,
        _employeeId?: string,
        _documentId?: string,
        vatAmount?: number
      ) => {
        expenses.push({ category, amount, description, vat: vatAmount });
        return null;
      },
    };

    const dup: FinancialData = {
      documentType: DocumentType.PAY_SLIP,
      date: "2026-02-28",
      issuer: "Cafe de la Place",
      documentNumber: "DUP",
      totalAmount: 5150,
      originalCurrency: "CHF",
      vatAmount: 793.89,
      netAmount: 4356.11,
      expenseCategory: "PAYROLL",
      amountInCHF: 5150,
      conversionRateUsed: 1,
      notes: "",
      paySlip: {
        employee: { name: "Adrian" },
        employer: { name: "Cafe de la Place" },
        grossPay: 5150,
        netPay: 4356.11,
        paymentToEmployee: 4356.11,
        permitType: "B",
        components: [],
      },
      subDocuments: [
        {
          documentType: DocumentType.PAY_SLIP,
          date: "2026-02-28",
          issuer: "Cafe de la Place",
          documentNumber: "P1",
          totalAmount: 5150,
          originalCurrency: "CHF",
          vatAmount: 793.89,
          netAmount: 4356.11,
          expenseCategory: "PAYROLL",
          amountInCHF: 5150,
          conversionRateUsed: 1,
          notes: "",
          paySlip: {
            employee: { name: "Adrian" },
            employer: { name: "Cafe de la Place" },
            grossPay: 5150,
            netPay: 4356.11,
            paymentToEmployee: 4356.11,
            permitType: "B",
            components: [],
          },
        },
        {
          documentType: DocumentType.PAY_SLIP,
          date: "2026-02-28",
          issuer: "Cafe de la Place",
          documentNumber: "P2",
          totalAmount: 5150,
          originalCurrency: "CHF",
          vatAmount: 793.89,
          netAmount: 4356.11,
          expenseCategory: "PAYROLL",
          amountInCHF: 5150,
          conversionRateUsed: 1,
          notes: "",
          paySlip: {
            employee: { name: "Adrian" },
            employer: { name: "Cafe de la Place" },
            grossPay: 5150,
            netPay: 4356.11,
            paymentToEmployee: 4356.11,
            permitType: "B",
            components: [],
          },
        },
      ],
    };

    const result = await postLedgerFromFinancialData(writers, dup, "salaire.pdf", "session-1", "doc-dup");
    // source_tax → employee payment + state payment once (not ×2 pages)
    expect(result.expensePosted).toBe(2);
    expect(expenses).toHaveLength(2);
    expect(expenses.every((e) => e.vat === 0)).toBe(true);
    const payroll = expenses.find((e) => e.category === "PAYROLL");
    expect(payroll?.amount).toBe(4356.11);
  });
});
