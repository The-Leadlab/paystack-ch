import { describe, expect, it } from "vitest";
import {
  isStockInCandidateDocument,
  normalizeLinesForStockInAnalyze,
} from "../shared/inventoryStockAnalyze";

describe("isStockInCandidateDocument", () => {
  it("includes stock-tagged and food/beverage expense purchases", () => {
    expect(isStockInCandidateDocument({ stockDocument: true })).toBe(true);
    expect(isStockInCandidateDocument({ uploadIntent: "stock" })).toBe(true);
    expect(isStockInCandidateDocument({ expenseCategory: "FOOD_SUPPLIES" })).toBe(true);
    expect(isStockInCandidateDocument({ expenseCategory: "BEVERAGES" })).toBe(true);
  });

  it("includes generic expense purchases and excludes income / POS tickets", () => {
    expect(
      isStockInCandidateDocument({
        documentType: "Invoice",
        expenseCategory: "UTILITIES",
        uploadIntent: "expense",
      })
    ).toBe(true);
    expect(
      isStockInCandidateDocument({
        documentType: "Invoice",
        uploadIntent: "revenue",
      })
    ).toBe(false);
    expect(
      isStockInCandidateDocument({
        documentType: "Ticket/Receipt",
        expenseCategory: "FOOD_SUPPLIES",
      })
    ).toBe(false);
  });
});

describe("normalizeLinesForStockInAnalyze", () => {
  it("defaults missing qty to 1 when amount is present and drops income lines", () => {
    expect(
      normalizeLinesForStockInAnalyze([
        { description: "Olive oil", amount: 24, type: "EXPENSE" },
        { description: "Sale", amount: 10, type: "INCOME", quantity: 2 },
        { description: "Milk", quantity: 6, unitPrice: 1.5, amount: 9, type: "EXPENSE" },
        { description: "", amount: 5 },
      ])
    ).toEqual([
      { description: "Olive oil", quantity: 1, unitPrice: 24, amount: 24 },
      { description: "Milk", quantity: 6, unitPrice: 1.5, amount: 9 },
    ]);
  });
});
