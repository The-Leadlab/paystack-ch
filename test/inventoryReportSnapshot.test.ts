import { describe, expect, it } from "vitest";
import {
  buildSessionInventorySnapshot,
  monthlyInventorySeries,
} from "../shared/inventoryReportSnapshot";

const products = [
  { id: "p1", name: "Beans", sku: "B1", unit: "kg", category: "Beverages" },
  { id: "p2", name: "Milk", sku: "M1", unit: "l", category: "Food" },
];

const movements = [
  {
    id: "in1",
    productId: "p1",
    productName: "Beans",
    type: "stock_in" as const,
    quantity: 10,
    unitCost: 2000,
    date: "2026-01-05",
    documentId: "doc-a",
  },
  {
    id: "out1",
    productId: "p1",
    productName: "Beans",
    type: "stock_out" as const,
    quantity: 3,
    date: "2026-01-20",
    documentId: "doc-pos",
  },
  {
    id: "in2",
    productId: "p2",
    productName: "Milk",
    type: "stock_in" as const,
    quantity: 20,
    unitCost: 150,
    date: "2026-02-02",
    documentId: "doc-b",
  },
];

describe("buildSessionInventorySnapshot", () => {
  it("values on-hand FIFO and period COGS", () => {
    const snap = buildSessionInventorySnapshot({
      products,
      movements,
      revenueAmount: 500,
    });
    // Beans: 7kg × 20.00 = 140; Milk: 20 × 1.50 = 30 → 170
    expect(snap.valuation).toBe(170);
    expect(snap.productRows).toHaveLength(2);
    expect(snap.productRows.find((r) => r.id === "p1")?.onHandQty).toBe(7);
    // COGS from Jan out: 3 × 20 = 60
    expect(snap.periodCogs).toBe(60);
    expect(snap.foodCostPercent).toBeCloseTo(12, 5);
    expect(snap.movementCount).toBe(3);
  });

  it("scopes COGS and movements to a date window", () => {
    const snap = buildSessionInventorySnapshot({
      products,
      movements,
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      revenueAmount: 100,
    });
    // As-of Feb: beans 7 + milk 20 still
    expect(snap.valuation).toBe(170);
    expect(snap.periodCogs).toBe(0);
    expect(snap.movementRows.every((m) => m.date.startsWith("2026-02"))).toBe(true);
  });
});

describe("monthlyInventorySeries", () => {
  it("returns distinct valuation/cogs per month", () => {
    const series = monthlyInventorySeries({
      products,
      movements,
      months: ["2026-01", "2026-02"],
    });
    expect(series.get("2026-01")?.cogs).toBe(60);
    // End of Jan: only beans 7 × 20 = 140 (milk not yet)
    expect(series.get("2026-01")?.valuation).toBe(140);
    expect(series.get("2026-02")?.valuation).toBe(170);
    expect(series.get("2026-02")?.cogs).toBe(0);
  });
});
