import { describe, expect, it } from "vitest";
import {
  computeDashboardTotals,
  isInflatedMultiInvoiceLedger,
} from "../client/src/cafe/lib/dashboardTotals";
import { rowMatchesAnySector } from "../client/src/cafe/lib/revenueSectors";

describe("computeDashboardTotals (UAT-9)", () => {
  it("balance = income − operating expenses − net payroll", () => {
    const totals = computeDashboardTotals(
      [
        { amount: 10000, vat_amount: 800 },
        { amount: 500, vat_amount: 0 },
      ],
      [
        { amount: 3613.47, vat_amount: 280, category: "SUPPLIERS", description: "Bar a tapas" },
        { amount: 4200, vat_amount: 0, category: "PAYROLL", description: "Alice net" },
        { amount: 900, vat_amount: 0, category: "PAYROLL_TAXES", description: "AVS" },
      ]
    );

    expect(totals.totalIncome).toBeCloseTo(10500, 2);
    expect(totals.totalExpenses).toBeCloseTo(3613.47 + 900, 2);
    expect(totals.totalPayroll).toBeCloseTo(4200, 2);
    expect(totals.balance).toBeCloseTo(10500 - 3613.47 - 900 - 4200, 2);
    expect(totals.balance).toBeCloseTo(
      totals.totalIncome - totals.totalExpenses - totals.totalPayroll,
      2
    );
  });

  it("excludes personal bleed from expense KPIs", () => {
    const totals = computeDashboardTotals(
      [{ amount: 100, vat_amount: 0 }],
      [
        { amount: 50, vat_amount: 0, category: "OTHER", description: "Groceries: Migros" },
        { amount: 20, vat_amount: 0, category: "SUPPLIERS", description: "Taligro" },
      ]
    );
    expect(totals.totalExpenses).toBeCloseTo(20, 2);
  });
});

describe("isInflatedMultiInvoiceLedger", () => {
  it("detects 7× binder inflation", () => {
    expect(
      isInflatedMultiInvoiceLedger({
        binderTotal: 3613.47,
        subCount: 7,
        linkedExpenseSum: 3613.47 * 7,
        linkedExpenseCount: 7,
      })
    ).toBe(true);
  });

  it("accepts correct sub-sum ≈ binder", () => {
    expect(
      isInflatedMultiInvoiceLedger({
        binderTotal: 3613.47,
        subCount: 7,
        linkedExpenseSum: 3613.47,
        linkedExpenseCount: 7,
      })
    ).toBe(false);
  });
});

describe("rowMatchesAnySector Revenue↔Dashboard parity", () => {
  it("includes untagged income under restaurants so totals can match Dashboard", () => {
    expect(rowMatchesAnySector("SumUp Settlement 12", ["restaurants"])).toBe(true);
    expect(rowMatchesAnySector("Customer invoice #88", ["restaurants"])).toBe(true);
  });

  it("includes income that hits non-selected industry keywords under restaurants", () => {
    // "service"/"consulting" match garage/fiduciary keywords but those sectors are off
    expect(rowMatchesAnySector("Invoice service fee consulting", ["restaurants"])).toBe(true);
    expect(rowMatchesAnySector("Marketplace order #42", ["restaurants"])).toBe(true);
  });

  it("still matches restaurant keywords", () => {
    expect(rowMatchesAnySector("Cafe lunch takeaway", ["restaurants"])).toBe(true);
  });

  it("does not force untagged into hotel-only selection", () => {
    expect(rowMatchesAnySector("SumUp Settlement 12", ["hotel"])).toBe(false);
  });
});
