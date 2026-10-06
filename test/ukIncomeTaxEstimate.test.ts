import { describe, expect, it } from "vitest";
import {
  buildUkIncomeTaxEstimate,
  resolveUkTaxYearId,
  ukTaxYearBounds,
} from "../shared/ukIncomeTaxEstimate.js";

describe("ukIncomeTaxEstimate", () => {
  it("uses 6 Apr – 5 Apr edges", () => {
    const { start, end } = ukTaxYearBounds("2026-27");
    expect(start.toISOString().slice(0, 10)).toBe("2026-04-06");
    expect(end.toISOString().slice(0, 10)).toBe("2027-04-05");
    expect(resolveUkTaxYearId(new Date("2026-04-05T12:00:00Z"))).toBe("2025-26");
    expect(resolveUkTaxYearId(new Date("2026-04-06T12:00:00Z"))).toBe("2026-27");
  });

  it("computes profit and a basic-rate estimate", () => {
    const est = buildUkIncomeTaxEstimate({
      taxYear: "2026-27",
      turnover: 80000,
      allowableExpenses: 20000,
    });
    expect(est.netProfit).toBe(60000);
    expect(est.taxableIncome).toBe(60000 - 12570);
    expect(est.incomeTaxEstimate).toBeGreaterThan(0);
    expect(est.class4NiEstimate).toBeGreaterThan(0);
    expect(est.disclaimer).toMatch(/Estimate only/);
  });
});
