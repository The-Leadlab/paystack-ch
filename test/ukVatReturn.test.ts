import { describe, expect, it } from "vitest";
import { buildUkVatReturn, ukVatQuarterBounds } from "../shared/ukVatReturn.js";

describe("ukVatReturn", () => {
  it("buckets mar stagger Q1 as Jan–Mar", () => {
    const { start, end } = ukVatQuarterBounds(2026, 0, "mar");
    expect(start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("builds 9 boxes and excludes payroll", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-03-31T23:59:59.999Z");
    const boxes = buildUkVatReturn(
      [
        { amount: 1200, vat_amount: 200, date: "2026-02-01" },
        { amount: 100, vat_amount: 0, date: "2026-02-15" },
      ],
      [
        { amount: 600, vat_amount: 100, category: "SUPPLIES", date: "2026-02-10" },
        { amount: 3000, vat_amount: 0, category: "PAYROLL", date: "2026-02-28" },
      ],
      { start, end }
    );
    expect(boxes.box1_vatDueSales).toBe(200);
    expect(boxes.box4_vatReclaimedCurrPeriod).toBe(100);
    expect(boxes.box5_netVatDue).toBe(100);
    expect(boxes.box5_direction).toBe("payable");
    expect(boxes.box6_totalValueSalesExVAT).toBe(1100);
    expect(boxes.box7_totalValuePurchasesExVAT).toBe(500);
    expect(boxes.salesMissingVat).toBe(1);
  });

  it("marks repayment when reclaim exceeds due", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-03-31T23:59:59.999Z");
    const boxes = buildUkVatReturn(
      [{ amount: 120, vat_amount: 20, date: "2026-01-10" }],
      [{ amount: 600, vat_amount: 100, category: "RENT", date: "2026-01-12" }],
      { start, end }
    );
    expect(boxes.box5_direction).toBe("repayable");
    expect(boxes.box5_netVatDue).toBe(80);
  });
});
