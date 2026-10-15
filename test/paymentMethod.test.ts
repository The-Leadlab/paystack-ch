import { describe, expect, it } from "vitest";
import { buildPaymentMix } from "../client/src/cafe/lib/revenueAnalytics";
import { normalizeStoredPaymentMethod, paymentMixBucket } from "../shared/paymentMethod";
import { parseZReadingFromFinancialData } from "../client/src/cafe/lib/posZReading";
import { DocumentType, type FinancialData } from "../client/src/cafe/types";

describe("payment method mix", () => {
  it("does not split manual invoice revenue into guessed card/twint/cash shares", () => {
    const mix = buildPaymentMix(
      [],
      [
        { date: "2026-10-05", amount: 1000, description: "Uploaded sales invoice" },
        { date: "2026-10-08", amount: 500, description: "Another manual invoice" },
      ],
      "2026-10-01",
      "2026-10-31"
    );
    expect(mix.fromPos).toBe(false);
    expect(mix.cash).toBe(0);
    expect(mix.card).toBe(0);
    expect(mix.other).toBe(0);
    expect(mix.twint).toBe(0);
    expect(mix.bankTransfer).toBe(0);
    expect(mix.unspecified).toBe(1500);
    expect(mix.gross).toBe(1500);
  });

  it("uses POS Z-reading tenders when they exist", () => {
    const mix = buildPaymentMix(
      [
        {
          id: "z1",
          date: "2026-10-10",
          gross_sales: 400,
          net_sales: 370,
          cash: 100,
          card: 250,
          other_payment: 50,
          tips: 0,
        },
      ],
      [{ date: "2026-10-10", amount: 400, description: "Should be ignored when POS exists" }],
      "2026-10-01",
      "2026-10-31"
    );
    expect(mix.fromPos).toBe(true);
    expect(mix.cash).toBe(100);
    expect(mix.card).toBe(250);
    expect(mix.other).toBe(50);
    expect(mix.unspecified).toBe(0);
  });

  it("buckets assigned income payment methods without guessing the rest", () => {
    const mix = buildPaymentMix(
      [],
      [
        { date: "2026-10-02", amount: 80, payment_method: "cash" },
        { date: "2026-10-03", amount: 120, payment_method: "card" },
        { date: "2026-10-04", amount: 40, payment_method: "twint" },
        { date: "2026-10-05", amount: 60 },
      ],
      "2026-10-01",
      "2026-10-31"
    );
    expect(mix.fromPos).toBe(false);
    expect(mix.cash).toBe(80);
    expect(mix.card).toBe(120);
    expect(mix.twint).toBe(40);
    expect(mix.unspecified).toBe(60);
    expect(mix.gross).toBe(300);
  });

  it("keeps the 40/55/5 split only behind an explicit demo flag", () => {
    const mix = buildPaymentMix(
      [],
      [{ date: "2026-10-01", amount: 100, description: "[DEMO] Food dine-in" }],
      "2026-10-01",
      "2026-10-31",
      { allowDemoHeuristic: true }
    );
    expect(mix.cash).toBeCloseTo(40, 5);
    expect(mix.card).toBeCloseTo(55, 5);
    expect(mix.other).toBeCloseTo(5, 5);
    expect(mix.unspecified).toBe(0);
  });

  it("does not invent cash/card on a Z-reading that has no tender lines", () => {
    const data: FinancialData = {
      documentType: DocumentType.Z2_BULK_REPORT,
      date: "2026-10-11",
      issuer: "POS",
      documentNumber: "Z-11",
      totalAmount: 1000,
      originalCurrency: "CHF",
      vatAmount: 74,
      netAmount: 926,
      expenseCategory: "REVENUE",
      amountInCHF: 1000,
      conversionRateUsed: 1,
      notes: "",
      lineItems: [
        { date: "2026-10-11", description: "Gross sales", amount: 1000, type: "INCOME", category: "SALES" },
      ],
    };
    const draft = parseZReadingFromFinancialData(data, "2026-10-11");
    expect(draft.gross_sales).toBe(1000);
    expect(draft.cash).toBe(0);
    expect(draft.card).toBe(0);
    expect(draft.other_payment).toBe(0);
  });

  it("normalizes stored methods", () => {
    expect(normalizeStoredPaymentMethod(undefined)).toBe("unspecified");
    expect(normalizeStoredPaymentMethod("Carte Visa")).toBe("card");
    expect(paymentMixBucket("virement bancaire")).toBe("bank_transfer");
  });
});
