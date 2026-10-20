import { describe, expect, it } from "vitest";
import {
  applyFxAndSwissVatRemap,
  inferSwissRateFromForeignAmounts,
  mapForeignVatRateToSwiss,
  roundMoney2,
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

describe("applyFxAndSwissVatRemap — Josh/Damien import rules", () => {
  /** Printed: HT 507.00 EUR, TVA 10% = 50.70 EUR, TTC 557.70 EUR @ 0.94 */
  it("507 / 50.70 / 557.70: CHF HT, cash out, Swiss 0%, recon flag, no 10.01%", () => {
    const rate = 0.94;
    const result = applyFxAndSwissVatRemap(
      {
        originalCurrency: "EUR",
        totalAmount: 557.7,
        netAmount: 507,
        vatAmount: 50.7,
        vatRate: 10.01, // AI-seeded bug from video — must not land in Swiss table
        swissVatBreakdown: [
          { ratePercent: 10.01, baseExclusive: 507, vatAmount: 50.7 },
        ],
      },
      rate,
      "CHF"
    );

    expect(result.originalCurrency).toBe("EUR");
    expect(result.totalAmount).toBe(557.7);
    expect(result.netAmount).toBe(507);
    expect(result.vatAmount).toBe(50.7);
    expect(result.conversionRateUsed).toBe(rate);

    const chfHt = roundMoney2(507 * rate);
    const chfPaid = roundMoney2(557.7 * rate);
    const foreignVatChf = roundMoney2(50.7 * rate);

    expect(result.swissVatReceiptTotals.merchandiseSubtotal).toBe(chfHt);
    expect(result.swissVatReceiptTotals.vatTotal).toBe(0);
    expect(result.swissVatReceiptTotals.totalInclVat).toBe(chfPaid);
    expect(result.amountInCHF).toBe(chfPaid);
    expect(result.amountInCHF.toFixed(2)).toMatch(/^\d+\.\d{2}$/);

    const zeroLine = result.swissVatBreakdown.find((l) => l.ratePercent === 0);
    expect(zeroLine?.baseExclusive).toBe(chfHt);
    expect(zeroLine?.vatAmount).toBe(0);

    // No EU / AI rate copied into Swiss filing table
    expect(result.swissVatBreakdown.every((l) => Math.abs(l.ratePercent - 10.01) > 0.001)).toBe(
      true
    );
    expect(result.swissVatBreakdown.every((l) => l.ratePercent === 0 || l.baseExclusive === 0)).toBe(
      true
    );

    expect(result.foreignVatAmount).toBe(50.7);
    expect(result.foreignVatAmountInCHF).toBe(foreignVatChf);
    expect(result.foreignVatNeedsReconciliation).toBe(true);
  });

  it("does not invent Swiss 8.1% on foreign EUR invoices", () => {
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

    expect(result.swissVatReceiptTotals.merchandiseSubtotal).toBe(94);
    expect(result.swissVatReceiptTotals.vatTotal).toBe(0);
    expect(result.amountInCHF).toBe(roundMoney2(120 * 0.94)); // TTC × rate
    const std = result.swissVatBreakdown.find((l) => Math.abs(l.ratePercent - 8.1) < 0.01);
    expect(std?.baseExclusive).toBe(0);
    expect(std?.vatAmount).toBe(0);
    expect(result.foreignVatNeedsReconciliation).toBe(true);
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
    expect(result.foreignVatNeedsReconciliation).toBe(false);
  });

  it("remaps parent-shaped blocks independently (subDocument parity)", () => {
    const rate = 0.94;
    const parent = applyFxAndSwissVatRemap(
      {
        originalCurrency: "EUR",
        totalAmount: 557.7,
        netAmount: 507,
        vatAmount: 50.7,
      },
      rate,
      "CHF"
    );
    const sub = applyFxAndSwissVatRemap(
      {
        originalCurrency: "EUR",
        totalAmount: 557.7,
        netAmount: 507,
        vatAmount: 50.7,
        swissVatBreakdown: [{ ratePercent: 10.01, baseExclusive: 507, vatAmount: 50.7 }],
      },
      rate,
      "CHF"
    );
    expect(sub.amountInCHF).toBe(parent.amountInCHF);
    expect(sub.swissVatReceiptTotals.merchandiseSubtotal).toBe(
      parent.swissVatReceiptTotals.merchandiseSubtotal
    );
    expect(sub.foreignVatNeedsReconciliation).toBe(true);
    expect(sub.swissVatBreakdown.some((l) => Math.abs(l.ratePercent - 10.01) < 0.01)).toBe(false);
  });
});

describe("inferSwissRateFromForeignAmounts", () => {
  it("infers 8.1 from 20% ratio", () => {
    expect(inferSwissRateFromForeignAmounts(100, 20)).toBe(8.1);
  });
});
