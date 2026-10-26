import { describe, expect, it } from "vitest";
import {
  computeFifo,
  decrementForInvoiceLines,
  foodCostPercent,
  invoiceStockDelta,
  periodFifoCogsCents,
  restoreForInvoiceLines,
  totalInventoryValuation,
  valuationInCurrency,
  type FifoMovement,
} from "../shared/inventoryFifo";
import {
  isStockDocument,
  matchInventoryProduct,
  suggestStockInFromLines,
} from "../shared/inventoryStock";
import {
  aggregateStockOutByProduct,
  isNonProductPosLine,
  isPosSalesDocument,
  suggestStockOutFromPosLines,
} from "../shared/inventoryPosStock";
import { isInventoryAllowedForUser } from "../shared/inventoryAccess";

function mv(
  partial: Pick<FifoMovement, "id" | "type" | "quantity"> & Partial<FifoMovement>
): FifoMovement {
  return { date: "2026-10-01", ...partial };
}

describe("computeFifo", () => {
  it("values remaining stock from the oldest layers first", () => {
    const result = computeFifo([
      mv({ id: "in-1", type: "stock_in", quantity: 10, unitCost: 100, date: "2026-01-01" }),
      mv({ id: "in-2", type: "stock_in", quantity: 5, unitCost: 200, date: "2026-01-02" }),
      mv({ id: "out-1", type: "stock_out", quantity: 8, date: "2026-01-03" }),
    ]);
    expect(result.onHandQty).toBe(7);
    expect(result.valuationAmount).toBe(2 * 100 + 5 * 200);
    expect(result.totalCogs).toBe(8 * 100);
    expect(result.avgUnitCost).toBeCloseTo(result.valuationAmount / 7);
  });

  it("restores quantity after an invoice is cancelled", () => {
    const afterSale = computeFifo([
      mv({ id: "in-1", type: "stock_in", quantity: 10, unitCost: 50 }),
      mv({ id: "out-1", type: "stock_out", quantity: 4 }),
    ]);
    expect(afterSale.onHandQty).toBe(6);

    const afterCancel = computeFifo([
      mv({ id: "in-1", type: "stock_in", quantity: 10, unitCost: 50 }),
      mv({ id: "out-1", type: "stock_out", quantity: 4 }),
      mv({ id: "rst-1", type: "stock_restore", quantity: 4, unitCost: 50 }),
    ]);
    expect(afterCancel.onHandQty).toBe(10);
    expect(afterCancel.valuationAmount).toBe(10 * 50);
  });

  it("does not go negative when outbound exceeds on-hand", () => {
    const result = computeFifo([
      mv({ id: "in-1", type: "stock_in", quantity: 2, unitCost: 10 }),
      mv({ id: "out-1", type: "stock_out", quantity: 9 }),
    ]);
    expect(result.onHandQty).toBe(0);
    expect(result.valuationAmount).toBe(0);
    expect(result.totalCogs).toBe(20);
  });

  it("applies positive and negative adjustments", () => {
    const result = computeFifo([
      mv({ id: "in-1", type: "stock_in", quantity: 5, unitCost: 40 }),
      mv({ id: "adj-up", type: "adjustment", quantity: 2, unitCost: 40 }),
      mv({ id: "adj-down", type: "adjustment", quantity: -3 }),
    ]);
    expect(result.onHandQty).toBe(4);
    expect(result.valuationAmount).toBe(4 * 40);
  });
});

describe("invoice stock decrement and restore", () => {
  it("builds stock_out movements for invoice lines", () => {
    const movements = decrementForInvoiceLines(
      [
        { productId: "p1", productName: "Tyre", quantity: 2 },
        { productId: "p2", productName: "Oil", quantity: 0 },
      ],
      "INV-1",
      "2026-10-22",
      "uid-1"
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "stock_out",
      productId: "p1",
      quantity: 2,
      invoiceId: "INV-1",
      restaurantId: "uid-1",
    });
  });

  it("builds stock_restore movements when an invoice is cancelled", () => {
    const movements = restoreForInvoiceLines(
      [{ productId: "p1", productName: "Tyre", quantity: 2, unitCost: 8000 }],
      "INV-1",
      "2026-10-22",
      "uid-1"
    );
    expect(movements[0]).toMatchObject({
      type: "stock_restore",
      quantity: 2,
      unitCost: 8000,
      invoiceId: "INV-1",
    });
  });

  it("diffs invoice edits: extra qty out, reduced qty restored", () => {
    const { outs, restores } = invoiceStockDelta(
      [{ productId: "p1", productName: "Tyre", quantity: 4 }],
      [{ productId: "p1", productName: "Tyre", quantity: 1 }],
    );
    expect(outs).toEqual([]);
    expect(restores).toEqual([{ productId: "p1", productName: "Tyre", quantity: 3 }]);
  });

  it("restores all linked qty when the invoice is cancelled", () => {
    const { outs, restores } = invoiceStockDelta(
      [{ productId: "p1", productName: "Tyre", quantity: 4 }],
      [{ productId: "p1", productName: "Tyre", quantity: 4 }],
      { nextCancelled: true }
    );
    expect(outs).toEqual([]);
    expect(restores[0]?.quantity).toBe(4);
  });

  it("does not double-restore an already cancelled invoice", () => {
    const { outs, restores } = invoiceStockDelta(
      [{ productId: "p1", productName: "Tyre", quantity: 4 }],
      [{ productId: "p1", productName: "Tyre", quantity: 4 }],
      { previousCancelled: true, nextCancelled: true }
    );
    expect(outs).toEqual([]);
    expect(restores).toEqual([]);
  });
});

describe("valuation helpers", () => {
  it("sums FIFO value across products for konto 1200", () => {
    const map = new Map<string, FifoMovement[]>([
      ["p1", [mv({ id: "a", type: "stock_in", quantity: 2, unitCost: 100 })]],
      ["p2", [mv({ id: "b", type: "stock_in", quantity: 1, unitCost: 50 })]],
    ]);
    expect(totalInventoryValuation(map)).toBe(250);
    expect(valuationInCurrency(250)).toBe(2.5);
  });

  it("periodFifoCogsCents respects date window and foodCostPercent", () => {
    const movements: FifoMovement[] = [
      mv({ id: "in-1", type: "stock_in", quantity: 10, unitCost: 100, date: "2026-01-01" }),
      mv({ id: "out-1", type: "stock_out", quantity: 4, date: "2026-01-15" }),
      mv({ id: "out-2", type: "stock_out", quantity: 2, date: "2026-02-01" }),
    ];
    expect(periodFifoCogsCents(movements)).toBe(600);
    expect(periodFifoCogsCents(movements, { fromDate: "2026-01-01", toDate: "2026-01-31" })).toBe(
      400
    );
    expect(foodCostPercent(400, 20)).toBeCloseTo(20);
    expect(foodCostPercent(400, 0)).toBeNull();
  });
});

describe("stock documents", () => {
  it("treats inventory-group supplier invoices as stock", () => {
    expect(isStockDocument({ expenseCategory: "FOOD_SUPPLIES" })).toBe(true);
    expect(isStockDocument({ stockDocument: true })).toBe(true);
    expect(isStockDocument({ uploadIntent: "stock" })).toBe(true);
    expect(isStockDocument({ expenseCategory: "RENT" })).toBe(false);
  });

  it("matches product lines by sku or name", () => {
    const products = [
      { id: "1", name: "Winter tyre", sku: "WT-01" },
      { id: "2", name: "Brake pads" },
    ];
    expect(matchInventoryProduct("WT-01 winter", products)?.id).toBe("1");
    expect(matchInventoryProduct("Brake pads", products)?.id).toBe("2");
    expect(matchInventoryProduct("Unknown", products)).toBeNull();
  });

  it("suggests stock-in rows from invoice line items", () => {
    const suggestions = suggestStockInFromLines(
      [{ description: "Brake pads", quantity: 2, unitPrice: 40 }],
      [{ id: "2", name: "Brake pads" }]
    );
    expect(suggestions).toEqual([
      {
        description: "Brake pads",
        quantity: 2,
        unitCostCents: 4000,
        productId: "2",
        productName: "Brake pads",
      },
    ]);
  });
});

describe("POS stock-out suggestions", () => {
  it("skips payment and till-total lines", () => {
    expect(isNonProductPosLine("Cash")).toBe(true);
    expect(isNonProductPosLine("TWINT")).toBe(true);
    expect(isNonProductPosLine("Espresso")).toBe(false);
  });

  it("detects POS sales document types", () => {
    expect(isPosSalesDocument({ documentType: "Ticket/Receipt" })).toBe(true);
    expect(isPosSalesDocument({ documentType: "Z2 Multi-Ticket Sheet" })).toBe(true);
    expect(isPosSalesDocument({ documentType: "Invoice" })).toBe(false);
  });

  it("applies recipe qtyPerUnit and falls back to name match", () => {
    const products = [
      { id: "beans", name: "Coffee beans", sku: "COF-BEANS" },
      { id: "cola", name: "Soft drinks (cans)" },
    ];
    const recipes = [{ posName: "Espresso", productId: "beans", qtyPerUnit: 0.018 }];
    const rows = suggestStockOutFromPosLines(
      [
        { description: "Espresso", quantity: 2 },
        { description: "Soft drinks (cans)", quantity: 3 },
        { description: "Card", quantity: 1, amount: 40 },
      ],
      products,
      recipes
    );
    expect(rows.find((r) => r.description === "Espresso")).toMatchObject({
      productId: "beans",
      quantity: 0.036,
      matchedVia: "recipe",
    });
    expect(rows.find((r) => r.description === "Soft drinks (cans)")).toMatchObject({
      productId: "cola",
      quantity: 3,
      matchedVia: "name",
    });
    expect(rows.some((r) => r.description === "Card")).toBe(false);
  });

  it("aggregates outs by product", () => {
    const aggregated = aggregateStockOutByProduct([
      {
        description: "Espresso",
        soldQty: 1,
        quantity: 0.018,
        productId: "beans",
        productName: "Coffee beans",
        matchedVia: "recipe",
      },
      {
        description: "Cappuccino",
        soldQty: 1,
        quantity: 0.02,
        productId: "beans",
        productName: "Coffee beans",
        matchedVia: "recipe",
      },
    ]);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].quantity).toBeCloseTo(0.038);
  });
});

describe("inventory access gate", () => {
  it("stays hidden for ordinary users", () => {
    expect(isInventoryAllowedForUser("owner@cafe.ch")).toBe(false);
  });

  it("opens for allowlisted, admin, UK UAT, beta, or master flag", () => {
    expect(isInventoryAllowedForUser("ali@the-leadlab.com")).toBe(true);
    expect(isInventoryAllowedForUser("louise@test.com", { ukUatActive: true })).toBe(true);
    expect(isInventoryAllowedForUser("damien@test.com", { adminAppAccess: true })).toBe(true);
    expect(isInventoryAllowedForUser("beta@test.com", { inventoryBeta: true })).toBe(true);
    expect(isInventoryAllowedForUser("anyone@test.com", { envEnabled: true })).toBe(true);
    expect(
      isInventoryAllowedForUser("louise@paystack.ch", { extraEmails: ["louise@paystack.ch"] })
    ).toBe(true);
  });
});
