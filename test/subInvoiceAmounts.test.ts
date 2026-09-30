import { describe, expect, it } from "vitest";
import {
  resolveDocumentAmountInCHF,
  resolveSubInvoiceAmountInCHF,
  resolveSubInvoiceAmounts,
} from "../client/src/cafe/lib/subInvoiceAmounts";

describe("resolveSubInvoiceAmounts", () => {
  const parent = { totalAmount: 3613.47, amountInCHF: 3613.47, conversionRateUsed: 1 };

  it("uses sub totalAmount when amountInCHF is missing (no binder leak)", () => {
    const sub = { totalAmount: 500, conversionRateUsed: 1 };
    expect(resolveSubInvoiceAmountInCHF(sub, parent)).toBeCloseTo(500, 2);
  });

  it("rejects sub amountInCHF that copies the parent binder total", () => {
    const sub = { totalAmount: 520, amountInCHF: 3613.47, conversionRateUsed: 1 };
    const amounts = resolveSubInvoiceAmounts(sub, parent);
    expect(amounts.amountInCHF).toBeCloseTo(520, 2);
    expect(amounts.totalAmount).toBeCloseTo(520, 2);
  });

  it("keeps a legitimate sub amountInCHF", () => {
    const sub = { totalAmount: 540, amountInCHF: 540, conversionRateUsed: 1 };
    expect(resolveSubInvoiceAmountInCHF(sub, parent)).toBeCloseTo(540, 2);
  });

  it("sums seven subs to the binder total, not 7× binder", () => {
    const totals = [500, 510, 520, 530, 540, 550, 463.47];
    const sum = totals.reduce(
      (s, totalAmount) =>
        s + resolveSubInvoiceAmountInCHF({ totalAmount, amountInCHF: 3613.47 }, parent),
      0
    );
    expect(sum).toBeCloseTo(3613.47, 2);
    expect(sum).not.toBeCloseTo(3613.47 * 7, 2);
  });

  it("resolveDocumentAmountInCHF prefers CHF then total", () => {
    expect(resolveDocumentAmountInCHF({ amountInCHF: 10, totalAmount: 99 })).toBe(10);
    expect(resolveDocumentAmountInCHF({ totalAmount: 99 })).toBe(99);
    expect(resolveDocumentAmountInCHF({})).toBe(0);
  });
});
