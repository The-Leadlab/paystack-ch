import { describe, expect, it } from "vitest";
import {
  aggregateStockOutByProduct,
  isNonProductPosLine,
  isPosSalesDocument,
  suggestStockOutFromPosLines,
} from "../shared/inventoryPosStock";

const products = [
  { id: "beans", name: "Coffee beans", sku: "COF-BEANS" },
  { id: "milk", name: "Whole milk", sku: "DAI-MILK" },
];

describe("inventoryPosStock", () => {
  it("detects POS sales document types", () => {
    expect(isPosSalesDocument({ documentType: "Ticket/Receipt" })).toBe(true);
    expect(isPosSalesDocument({ documentType: "Z2 Multi-Ticket Sheet" })).toBe(true);
    expect(isPosSalesDocument({ documentType: "Invoice" })).toBe(false);
  });

  it("skips payment and till-close lines", () => {
    expect(isNonProductPosLine("Cash")).toBe(true);
    expect(isNonProductPosLine("TWINT")).toBe(true);
    expect(isNonProductPosLine("Espresso")).toBe(false);
  });

  it("applies recipe qtyPerUnit over name match", () => {
    const rows = suggestStockOutFromPosLines(
      [
        { description: "Espresso", quantity: 2 },
        { description: "Cash", quantity: 1, amount: 50 },
      ],
      products,
      [{ posName: "Espresso", productId: "beans", qtyPerUnit: 0.018 }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productId: "beans",
      soldQty: 2,
      quantity: 0.036,
      matchedVia: "recipe",
    });
  });

  it("falls back to product name match with qty 1", () => {
    const rows = suggestStockOutFromPosLines(
      [{ description: "Whole milk", quantity: 3 }],
      products,
      []
    );
    expect(rows[0]).toMatchObject({
      productId: "milk",
      quantity: 3,
      matchedVia: "name",
    });
  });

  it("treats missing qty as 1 when amount present", () => {
    const rows = suggestStockOutFromPosLines(
      [{ description: "Coca", amount: 4.5 }],
      [{ id: "soft", name: "Soft drinks (cans)", sku: "BEV-SOFT" }],
      [{ posName: "Coca", productId: "soft", qtyPerUnit: 1 }]
    );
    expect(rows[0].soldQty).toBe(1);
    expect(rows[0].quantity).toBe(1);
  });

  it("aggregates stock_out by product", () => {
    const agg = aggregateStockOutByProduct([
      {
        description: "Espresso",
        soldQty: 1,
        quantity: 0.018,
        productId: "beans",
        productName: "Coffee beans",
        matchedVia: "recipe",
      },
      {
        description: "Lungo",
        soldQty: 2,
        quantity: 0.036,
        productId: "beans",
        productName: "Coffee beans",
        matchedVia: "recipe",
      },
    ]);
    expect(agg).toHaveLength(1);
    expect(agg[0].quantity).toBeCloseTo(0.054);
  });
});
