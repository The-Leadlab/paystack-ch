import { describe, expect, it } from "vitest";
import { computePersonalMonthTotals } from "../client/src/ali-lab/lib/personalBudgetStore";
import type { PersonalBudgetTx } from "../client/src/ali-lab/lib/personalBudgetStore";

function tx(
  partial: Pick<PersonalBudgetTx, "id" | "kind" | "amount" | "date">
): PersonalBudgetTx {
  return {
    description: partial.id,
    category: partial.kind === "income" ? "SALARY" : "GROCERIES",
    createdAt: partial.date,
    ...partial,
  } as PersonalBudgetTx;
}

describe("computePersonalMonthTotals", () => {
  it("savings is month surplus; balance is cumulative through month", () => {
    const rows = [
      tx({ id: "1", kind: "income", amount: 5000, date: "2025-04-01" }),
      tx({ id: "2", kind: "expense", amount: 1000, date: "2025-04-10" }),
      tx({ id: "3", kind: "income", amount: 7450, date: "2025-05-23" }),
      tx({ id: "4", kind: "expense", amount: 78.45, date: "2025-05-23" }),
      tx({ id: "5", kind: "expense", amount: 1650, date: "2025-05-20" }),
      tx({ id: "6", kind: "expense", amount: 112.4, date: "2025-05-18" }),
      tx({ id: "7", kind: "expense", amount: 6.8, date: "2025-05-17" }),
      tx({ id: "8", kind: "expense", amount: 52.3, date: "2025-05-16" }),
    ];

    const { totals } = computePersonalMonthTotals(rows, "2025-05");
    expect(totals.totalIncome).toBeCloseTo(7450, 2);
    expect(totals.totalExpenses).toBeCloseTo(1899.95, 2);
    expect(totals.savings).toBeCloseTo(5550.05, 2);
    // April surplus 4000 + May 5550.05
    expect(totals.balance).toBeCloseTo(4000 + 5550.05, 2);
    expect(totals.balance).not.toBeCloseTo(totals.savings, 2);
  });

  it("matches visible May marketing txs when that is the only month", () => {
    const rows = [
      tx({ id: "salary", kind: "income", amount: 7450, date: "2025-05-23" }),
      tx({ id: "coop", kind: "expense", amount: 78.45, date: "2025-05-23" }),
      tx({ id: "rent", kind: "expense", amount: 1650, date: "2025-05-20" }),
      tx({ id: "ckw", kind: "expense", amount: 112.4, date: "2025-05-18" }),
      tx({ id: "sbux", kind: "expense", amount: 6.8, date: "2025-05-17" }),
      tx({ id: "sbb", kind: "expense", amount: 52.3, date: "2025-05-16" }),
    ];
    const { totals } = computePersonalMonthTotals(rows, "2025-05");
    expect(totals.totalExpenses).toBeCloseTo(1899.95, 2);
    expect(totals.savings).toBeCloseTo(5550.05, 2);
    expect(totals.balance).toBeCloseTo(5550.05, 2);
  });
});
