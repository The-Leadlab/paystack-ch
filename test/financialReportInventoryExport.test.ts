import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildFinancialReportExcelBuffer } from "../shared/financialReportExcel";

describe("financial report inventory export", () => {
  it("includes Inventory sheet when product rows are present", () => {
    const buf = buildFinancialReportExcelBuffer({
      income: [{ date: "2026-01-10", amount: 100, vat_amount: 8, type: "SALES", description: "Sale" }],
      expenses: [
        { date: "2026-01-12", amount: 40, vat_amount: 3, category: "SUPPLIERS", description: "Beans" },
      ],
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      sessionName: "Test",
      locale: "en",
      currency: "CHF",
      inventoryValuation: 140,
      inventoryCogs: 60,
      inventoryFoodCostPercent: 12,
      inventoryProducts: [
        {
          name: "Beans",
          sku: "B1",
          unit: "kg",
          category: "Beverages",
          onHandQty: 7,
          valuation: 140,
        },
      ],
      inventoryMovements: [
        {
          date: "2026-01-05",
          type: "stock_in",
          productName: "Beans",
          quantity: 10,
          unitCost: 20,
          documentId: "doc-a",
        },
      ],
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Inventory");
    expect(wb.SheetNames).toContain("Stock movements");
    const inv = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Inventory, {
      header: 1,
    }) as unknown[][];
    expect(inv.some((row) => row.includes("Beans"))).toBe(true);
  });
});
