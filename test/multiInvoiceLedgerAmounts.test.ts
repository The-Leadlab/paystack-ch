import { describe, expect, it } from "vitest";
import { postLedgerFromFinancialData } from "../client/src/cafe/lib/postLedgerFromFinancialData";
import { DocumentType, type Expense, type FinancialData, type Income } from "../client/src/cafe/types";

function multiInvoiceBinder(): FinancialData {
  return {
    documentType: DocumentType.INVOICE,
    date: "2026-09-01",
    issuer: "7 invoices detected",
    documentNumber: "BINDER",
    totalAmount: 3613.47,
    originalCurrency: "CHF",
    vatAmount: 280,
    netAmount: 3333.47,
    expenseCategory: "SUPPLIERS",
    // Parent binder total — must NOT be copied onto every sub ledger row
    amountInCHF: 3613.47,
    conversionRateUsed: 1,
    notes: "",
    subDocuments: [
      {
        documentType: DocumentType.INVOICE,
        date: "2026-08-28",
        issuer: "Bar à tapas - Facture 1",
        totalAmount: 500,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 460,
        expenseCategory: "SUPPLIERS",
        amountInCHF: 0,
        conversionRateUsed: 1,
        notes: "",
      },
      {
        documentType: DocumentType.INVOICE,
        date: "2026-08-29",
        issuer: "Bar à tapas - Facture 2",
        totalAmount: 510,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 470,
        expenseCategory: "SUPPLIERS",
        // Missing amountInCHF — previously inherited parent 3613.47 via object spread
        conversionRateUsed: 1,
        notes: "",
      } as FinancialData,
      {
        documentType: DocumentType.INVOICE,
        date: "2026-08-30",
        issuer: "Bar à tapas - Facture 3",
        totalAmount: 520,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 480,
        expenseCategory: "SUPPLIERS",
        // Leaked binder total on the sub (AI / merge bug)
        amountInCHF: 3613.47,
        conversionRateUsed: 1,
        notes: "",
      },
      {
        documentType: DocumentType.INVOICE,
        date: "2026-08-31",
        issuer: "Bar à tapas - Facture 4",
        totalAmount: 530,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 490,
        expenseCategory: "SUPPLIERS",
        amountInCHF: 530,
        conversionRateUsed: 1,
        notes: "",
      },
      {
        documentType: DocumentType.INVOICE,
        date: "2026-09-01",
        issuer: "Bar à tapas - Facture 5",
        totalAmount: 540,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 500,
        expenseCategory: "SUPPLIERS",
        amountInCHF: 540,
        conversionRateUsed: 1,
        notes: "",
      },
      {
        documentType: DocumentType.INVOICE,
        date: "2026-09-02",
        issuer: "Bar à tapas - Facture 6",
        totalAmount: 550,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 510,
        expenseCategory: "SUPPLIERS",
        amountInCHF: 550,
        conversionRateUsed: 1,
        notes: "",
      },
      {
        documentType: DocumentType.INVOICE,
        date: "2026-09-03",
        issuer: "Bar à tapas - Facture 7",
        totalAmount: 463.47,
        originalCurrency: "CHF",
        vatAmount: 40,
        netAmount: 423.47,
        expenseCategory: "SUPPLIERS",
        amountInCHF: 463.47,
        conversionRateUsed: 1,
        notes: "",
      },
    ],
  } as FinancialData;
}

describe("postLedgerFromFinancialData multi-invoice amounts", () => {
  it("posts one expense per sub using sub totals — not N × binder amountInCHF", async () => {
    const expenses: Array<{ amount: number; description: string }> = [];
    const writers = {
      addIncome: async () => null as Income | null,
      addExpense: async (
        _date: string,
        _category: Expense["category"],
        amount: number,
        description: string
      ) => {
        expenses.push({ amount, description });
        return { id: String(expenses.length), amount } as Expense;
      },
    };

    const result = await postLedgerFromFinancialData(
      writers,
      multiInvoiceBinder(),
      "Bar à tapas - Factures fournisseurs.pdf",
      "session-1",
      "doc-1"
    );

    expect(result.expensePosted).toBe(7);
    expect(expenses).toHaveLength(7);

    const sum = expenses.reduce((s, e) => s + e.amount, 0);
    expect(sum).toBeCloseTo(3613.47, 2);
    // Must not be the old 7× binder bug
    expect(sum).not.toBeCloseTo(3613.47 * 7, 2);
    for (const e of expenses) {
      expect(e.amount).toBeLessThan(3613);
      expect(e.amount).toBeGreaterThan(0);
    }
  });
});
