import { describe, expect, it } from "vitest";
import {
  applyFxAndSwissVatRemap,
  inferSwissRateFromForeignAmounts,
  mapForeignVatRateToSwiss,
} from "../shared/foreignCurrencySwissVat.js";

describe("mapForeignVatRateToSwiss", () => {
  it("maps French standard 20% to Swiss 8.1%", () => {
    expect(mapForeignVatRateToSwiss(20)).toBe(8.1);
    expect(mapForeignVatRateToSwiss(19)).toBe(8.1);
  });

  it("maps reduced EU rates to Swiss 2.6%", () => {
    expect(mapForeignVatRateToSwiss(5.5)).toBe(2.6);
    expect(mapForeignVatRateToSwiss(10)).toBe(2.6);
  });

  it("keeps Swiss rates", () => {
    expect(mapForeignVatRateToSwiss(8.1)).toBe(8.1);
    expect(mapForeignVatRateToSwiss(2.6)).toBe(2.6);
    expect(mapForeignVatRateToSwiss(0)).toBe(0);
  });
});

describe("applyFxAndSwissVatRemap", () => {
  it("converts EUR HT to CHF and applies Swiss TVA (not FR 20%)", () => {
    const result = applyFxAndSwissVatRemap(
      {
        originalCurrency: "EUR",
        totalAmount: 120,
        netAmount: 100,
        vatAmount: 20,
        vatRate: 20,
      },
      0.94,
      "CHF"
    );

    expect(result.originalCurrency).toBe("EUR");
    expect(result.totalAmount).toBe(120);
    expect(result.netAmount).toBe(100);
    expect(result.vatAmount).toBe(20);
    expect(result.conversionRateUsed).toBe(0.94);
    expect(result.swissVatReceiptTotals.merchandiseSubtotal).toBe(94); // 100 * 0.94
    expect(result.swissVatReceiptTotals.vatTotal).toBeCloseTo(7.61, 2); // 94 * 8.1%
    expect(result.amountInCHF).toBeCloseTo(101.61, 2);
    const std = result.swissVatBreakdown.find((l) => Math.abs(l.ratePercent - 8.1) < 0.01);
    expect(std?.baseExclusive).toBe(94);
    expect(std?.vatAmount).toBeCloseTo(7.61, 2);
  });

  it("leaves CHF invoices unchanged", () => {
    const result = applyFxAndSwissVatRemap(
      {
        originalCurrency: "CHF",
        totalAmount: 108.1,
        netAmount: 100,
        vatAmount: 8.1,
        vatRate: 8.1,
      },
      1,
      "CHF"
    );
    expect(result.conversionRateUsed).toBe(1);
    expect(result.amountInCHF).toBe(108.1);
  });
});

describe("inferSwissRateFromForeignAmounts", () => {
  it("infers 8.1 from 20% ratio", () => {
    expect(inferSwissRateFromForeignAmounts(100, 20)).toBe(8.1);
  });
});
