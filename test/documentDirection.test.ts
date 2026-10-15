import { describe, expect, it } from "vitest";
import {
  applyDocumentDirectionToFinancialData,
  classifyDocumentDirection,
  isRevenueDocument,
  lineItemsConflictWithDocument,
  lineTypeForDocumentFlow,
  repairLineItemsToDocumentDirection,
} from "../shared/documentDirection";
import { inferLineItemType } from "../client/src/cafe/services/categoryDetectionService";
import { postLedgerFromFinancialData } from "../client/src/cafe/lib/postLedgerFromFinancialData";
import { collectProductLinesFromFinancialData } from "../client/src/cafe/lib/documentProductLines";
import { DocumentType, type Expense, type FinancialData, type Income } from "../client/src/cafe/types";

function supplierInvoice(): FinancialData {
  return {
    documentType: DocumentType.INVOICE,
    date: "2026-10-10",
    issuer: "Cave du Rhône SA",
    documentNumber: "F-4412",
    totalAmount: 2195.53,
    originalCurrency: "CHF",
    vatAmount: 165.53,
    netAmount: 2030,
    expenseCategory: "FOOD_SUPPLIES",
    amountInCHF: 2195.53,
    conversionRateUsed: 1,
    notes: "Facture fournisseur — Fournisseurs 1.pdf",
    lineItems: [
      {
        date: "2026-10-10",
        description: "Viande hachée",
        amount: 120,
        type: "EXPENSE",
        category: "FOOD_SUPPLIES",
      },
      {
        date: "2026-10-10",
        description: "6 bouteilles Pinot Noir",
        amount: 89.4,
        type: "INCOME",
        category: "Food / groceries",
      },
    ],
  };
}

function salesInvoice(): FinancialData {
  return {
    documentType: DocumentType.INVOICE,
    date: "2026-10-12",
    issuer: "Café de la Place",
    documentNumber: "2026-088",
    totalAmount: 450,
    originalCurrency: "CHF",
    vatAmount: 33.75,
    netAmount: 416.25,
    expenseCategory: "FOOD_SUPPLIES",
    amountInCHF: 450,
    conversionRateUsed: 1,
    notes: "Facture de vente — invoice issued to customer",
    lineItems: [
      {
        date: "2026-10-12",
        description: "Menu dégustation",
        amount: 180,
        type: "EXPENSE",
        category: "FOOD_SUPPLIES",
      },
      {
        date: "2026-10-12",
        description: "Bouteille de vin",
        amount: 62,
        type: "EXPENSE",
        category: "BEVERAGES",
      },
    ],
  };
}

describe("document direction", () => {
  it("treats a supplier/purchase invoice as EXPENSE even when wine lines look like sales", () => {
    const data = supplierInvoice();
    expect(
      classifyDocumentDirection({
        documentType: data.documentType,
        expenseCategory: data.expenseCategory,
        issuer: data.issuer,
        notes: data.notes,
        fileName: "Fournisseurs 1.pdf",
      })
    ).toBe("EXPENSE");

    const fixed = applyDocumentDirectionToFinancialData(data, { fileName: "Fournisseurs 1.pdf" });
    expect(fixed.lineItems?.every((l) => l.type === "EXPENSE")).toBe(true);
    expect(lineItemsConflictWithDocument(data, { fileName: "Fournisseurs 1.pdf" })).toBe(true);
    expect(lineItemsConflictWithDocument(fixed, { fileName: "Fournisseurs 1.pdf" })).toBe(false);
  });

  it("does not trust a Gemini INCOME guess from the product name", () => {
    expect(
      inferLineItemType({
        expenseCategory: "FOOD_SUPPLIES",
        documentType: "Invoice",
        description: "6 bouteilles Pinot Noir",
        category: "Food / groceries",
        parentExpenseCategory: "FOOD_SUPPLIES",
        existingType: "INCOME",
        fileName: "Fournisseurs 1.pdf",
      })
    ).toBe("EXPENSE");
  });

  it("classifies a sales invoice issued by the restaurant as Revenue", () => {
    const data = salesInvoice();
    expect(
      classifyDocumentDirection({
        documentType: data.documentType,
        expenseCategory: data.expenseCategory,
        issuer: data.issuer,
        notes: data.notes,
        ownBusinessNames: ["Café de la Place"],
      })
    ).toBe("INCOME");
    expect(isRevenueDocument(data, ["Café de la Place"])).toBe(true);

    const fixed = applyDocumentDirectionToFinancialData(data, {
      ownBusinessNames: ["Café de la Place"],
    });
    expect(fixed.expenseCategory).toBe("REVENUE");
    expect(fixed.lineItems?.every((l) => l.type === "INCOME")).toBe(true);
  });

  it("classifies sales wording as income even without an own-business name", () => {
    expect(
      classifyDocumentDirection({
        documentType: "Invoice",
        expenseCategory: "FOOD_SUPPLIES",
        issuer: "Brasserie du Lac",
        notes: "Facture de vente — sold to walk-in customer",
      })
    ).toBe("INCOME");
  });

  it("lets a user override drive income vs expense totals", async () => {
    const data: FinancialData = {
      ...supplierInvoice(),
      userFlowOverride: "INCOME",
      expenseCategory: "REVENUE",
    };
    expect(isRevenueDocument(data)).toBe(true);

    const income: Income[] = [];
    const expenses: Expense[] = [];
    await postLedgerFromFinancialData(
      {
        addIncome: async (date, type, amount, description, sessionId, documentId, vatAmount, accountCode, aiCategory) => {
          const row: Income = {
            id: `i-${income.length}`,
            restaurant_id: "r",
            session_id: sessionId,
            date,
            type,
            amount,
            vat_amount: vatAmount,
            description,
            account_code: accountCode,
            ai_category: aiCategory,
            document_id: documentId,
            created_at: "",
          };
          income.push(row);
          return row;
        },
        addExpense: async (date, category, amount, description, sessionId, _emp, documentId, vatAmount, accountCode, aiCategory) => {
          const row: Expense = {
            id: `e-${expenses.length}`,
            restaurant_id: "r",
            session_id: sessionId,
            date,
            category,
            amount,
            vat_amount: vatAmount,
            description,
            account_code: accountCode,
            ai_category: aiCategory,
            document_id: documentId,
            created_at: "",
          };
          expenses.push(row);
          return row;
        },
      },
      data,
      "Fournisseurs 1.pdf",
      "session-1",
      "doc-1"
    );
    expect(income).toHaveLength(1);
    expect(expenses).toHaveLength(0);
    expect(income[0].amount).toBeCloseTo(2195.53, 2);
  });

  it("posts a supplier invoice to expenses, not income", async () => {
    const income: Income[] = [];
    const expenses: Expense[] = [];
    await postLedgerFromFinancialData(
      {
        addIncome: async () => {
          throw new Error("should not post income");
        },
        addExpense: async (date, category, amount, description, sessionId, _emp, documentId) => {
          const row: Expense = {
            id: "e1",
            restaurant_id: "r",
            session_id: sessionId,
            date,
            category,
            amount,
            description,
            document_id: documentId,
            created_at: "",
          };
          expenses.push(row);
          return row;
        },
      },
      supplierInvoice(),
      "Fournisseurs 1.pdf",
      "session-1",
      "doc-1"
    );
    expect(expenses).toHaveLength(1);
    expect(income).toHaveLength(0);
  });

  it("exports Excel invoice-item types from the parent document, not the SKU", () => {
    const fixed = applyDocumentDirectionToFinancialData(supplierInvoice(), {
      fileName: "Fournisseurs 1.pdf",
    });
    const rows = collectProductLinesFromFinancialData(fixed, {
      documentId: "d1",
      fileName: "Fournisseurs 1.pdf",
    });
    const wine = rows.find((r) => /pinot/i.test(r.description));
    expect(wine?.type).toBe("EXPENSE");
    expect(rows.every((r) => r.type === "EXPENSE")).toBe(true);
  });

  it("repairs stored wine lines without flipping the parent document category", () => {
    const data = supplierInvoice();
    const repaired = repairLineItemsToDocumentDirection(data, { fileName: "Fournisseurs 1.pdf" });
    expect(repaired.expenseCategory).toBe("FOOD_SUPPLIES");
    expect(repaired.lineItems?.every((l) => l.type === "EXPENSE")).toBe(true);
  });

  it("lets a user override drive a sales invoice into expenses", async () => {
    const data: FinancialData = {
      ...salesInvoice(),
      userFlowOverride: "EXPENSE",
    };
    expect(isRevenueDocument(data, ["Café de la Place"])).toBe(false);
    const expenses: Expense[] = [];
    await postLedgerFromFinancialData(
      {
        addIncome: async () => {
          throw new Error("override should post expense");
        },
        addExpense: async (date, category, amount, description, sessionId, _emp, documentId) => {
          const row: Expense = {
            id: "e-override",
            restaurant_id: "r",
            session_id: sessionId,
            date,
            category,
            amount,
            description,
            document_id: documentId,
            created_at: "",
          };
          expenses.push(row);
          return row;
        },
      },
      data,
      "sales-invoice.pdf",
      "session-1",
      "doc-sales"
    );
    expect(expenses).toHaveLength(1);
    expect(expenses[0].amount).toBeCloseTo(450, 2);
  });

  it("honors upload intent from the revenue section", () => {
    expect(
      classifyDocumentDirection({
        documentType: "Invoice",
        expenseCategory: "FOOD_SUPPLIES",
        issuer: "Unknown Café",
        uploadIntent: "revenue",
      })
    ).toBe("INCOME");
  });

  it("honors upload intent from the expense section", () => {
    expect(
      classifyDocumentDirection({
        documentType: "Invoice",
        expenseCategory: "REVENUE",
        issuer: "Café de la Place",
        uploadIntent: "expense",
        ownBusinessNames: ["Café de la Place"],
      })
    ).toBe("EXPENSE");
  });

  it("keeps bank-statement lines mixed", () => {
    expect(lineTypeForDocumentFlow("MIXED", "INCOME")).toBe("INCOME");
    expect(
      classifyDocumentDirection({
        documentType: "Bank Statement",
        expenseCategory: "OTHER",
      })
    ).toBe("MIXED");
  });

  it("classifies a sales invoice via Gemini flowDirection even when the SKU category is food", () => {
    expect(
      classifyDocumentDirection({
        documentType: "Invoice",
        expenseCategory: "FOOD_SUPPLIES",
        issuer: "Unknown Bistro",
        recipient: "Walk-in guest",
        aiFlowHint: "INCOME",
      })
    ).toBe("INCOME");
  });

  it("does not let Gemini flowDirection override a supplier filename", () => {
    expect(
      classifyDocumentDirection({
        documentType: "Invoice",
        expenseCategory: "FOOD_SUPPLIES",
        issuer: "Cave du Rhône SA",
        fileName: "Fournisseurs 1.pdf",
        aiFlowHint: "INCOME",
      })
    ).toBe("EXPENSE");
  });

  it("does not rewrite payslip earning lines to EXPENSE", () => {
    const data: FinancialData = {
      documentType: DocumentType.PAY_SLIP,
      date: "2026-03-31",
      issuer: "Café de la Place",
      documentNumber: "P-1",
      totalAmount: 4600,
      originalCurrency: "CHF",
      vatAmount: 0,
      netAmount: 3800,
      expenseCategory: "PAYROLL",
      amountInCHF: 4600,
      conversionRateUsed: 1,
      notes: "",
      lineItems: [
        { date: "2026-03-31", description: "Salaire général", amount: 4200, type: "INCOME", category: "PAYROLL" },
        { date: "2026-03-31", description: "AVS", amount: 200, type: "EXPENSE", category: "PAYROLL" },
      ],
    };
    expect(classifyDocumentDirection({ documentType: data.documentType, expenseCategory: data.expenseCategory })).toBe(
      "SALARY"
    );
    const repaired = repairLineItemsToDocumentDirection(data);
    expect(repaired.lineItems?.[0].type).toBe("INCOME");
    expect(repaired.lineItems?.[1].type).toBe("EXPENSE");
    expect(lineItemsConflictWithDocument(data)).toBe(false);
  });
});
