import { describe, expect, it } from "vitest";
import { buildFinancialReportExcelBuffer } from "../shared/financialReportExcel.js";

describe("buildFinancialReportExcelBuffer", () => {
  it("returns a non-empty xlsx (ZIP) buffer", () => {
    const buf = buildFinancialReportExcelBuffer({
      income: [
        {
          date: "2026-06-01",
          amount: 100,
          vat_amount: 8.1,
          description: "Sale",
          type: "SALES",
        },
      ],
      expenses: [
        {
          date: "2026-06-02",
          amount: 50,
          vat_amount: 3.8,
          description: "Supplier — flour",
          category: "FOOD_SUPPLIES",
        },
      ],
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      sessionName: "Test Café",
      locale: "en",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K — ZIP/xlsx signature
  });
});
