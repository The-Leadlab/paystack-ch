import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichPersonalFromStatement } from "../client/src/ali-lab/lib/personalStatementEnrich.ts";
import type { PersonalStatementDraft } from "../client/src/ali-lab/lib/personalStatementImport.ts";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memory.set(k, v);
  },
  removeItem: (k: string) => {
    memory.delete(k);
  },
  clear: () => memory.clear(),
});

function draft(
  partial: Partial<PersonalStatementDraft> & Pick<PersonalStatementDraft, "description" | "amount" | "kind">
): PersonalStatementDraft {
  return {
    id: `d_${Math.random().toString(36).slice(2, 7)}`,
    date: "2026-08-10",
    expenseCat: "SHOPPING_OTHER",
    incomeCat: "SALARY",
    selected: true,
    ...partial,
  };
}

describe("enrichPersonalFromStatement", () => {
  beforeEach(() => memory.clear());

  it("seeds bills, goals, holdings and budgets into localStorage for anon owner", async () => {
    const drafts: PersonalStatementDraft[] = [
      draft({ description: "Salary ACME SA", amount: 5200, kind: "income", incomeCat: "SALARY" }),
      draft({ description: "Swisscom bill", amount: 69.9, kind: "expense", expenseCat: "BILLS" }),
      draft({ description: "Rent loft Geneva", amount: 1850, kind: "expense", expenseCat: "RENT" }),
      draft({ description: "Pillar 3a VIAC", amount: 200, kind: "expense", expenseCat: "SAVINGS_INVEST" }),
      draft({ description: "Dividend Swissquote", amount: 95, kind: "income", incomeCat: "ASSET_REVENUE" }),
    ];

    const result = await enrichPersonalFromStatement(undefined, drafts, { month: "2026-08" });
    expect(result.billsAdded).toBeGreaterThanOrEqual(2);
    expect(result.goalsAdded).toBe(2);
    expect(result.holdingsAdded).toBeGreaterThanOrEqual(1);
    expect(result.budgetsTouched).toBeGreaterThanOrEqual(1);

    const bills = JSON.parse(localStorage.getItem("ali-lab-bills-anon") || "[]");
    expect(bills.some((b: { name: string }) => /Swisscom/i.test(b.name))).toBe(true);
  });
});
