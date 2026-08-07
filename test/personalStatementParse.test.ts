import { describe, expect, it } from "vitest";
import {
  dominantMonthFromDrafts,
  parsePersonalStatementPlainText,
  parsePersonalStatementCsv,
} from "../client/src/ali-lab/lib/personalStatementImport.ts";

describe("parsePersonalStatementPlainText", () => {
  it("parses Swiss bank ledger lines with DD.MM.YYYY", () => {
    const text = [
      "UBS Personal Account Statement",
      "01.08.2026  Salary ACME SA                 5200.00",
      "03.08.2026  Migros Ouchy                    -74.20",
      "10.08.2026  Rent loft Geneva              -1850.00",
    ].join("\n");
    const preview = parsePersonalStatementPlainText(text, "sample.pdf");
    expect(preview.rows.length).toBe(3);
    expect(preview.totals.income).toBe(5200);
    expect(preview.totals.expense).toBeCloseTo(1924.2, 1);
    expect(preview.rows[0].kind).toBe("income");
    expect(preview.rows[1].expenseCat).toBe("GROCERIES");
    expect(preview.rows[2].expenseCat).toBe("RENT");
  });
});

describe("dominantMonthFromDrafts", () => {
  it("picks the most common YYYY-MM", () => {
    const month = dominantMonthFromDrafts([
      {
        id: "1",
        date: "2026-07-01",
        description: "a",
        amount: 1,
        kind: "income",
        expenseCat: "BILLS",
        incomeCat: "SALARY",
        selected: true,
      },
      {
        id: "2",
        date: "2026-08-01",
        description: "b",
        amount: 1,
        kind: "income",
        expenseCat: "BILLS",
        incomeCat: "SALARY",
        selected: true,
      },
      {
        id: "3",
        date: "2026-08-10",
        description: "c",
        amount: 1,
        kind: "expense",
        expenseCat: "RENT",
        incomeCat: "SALARY",
        selected: true,
      },
    ]);
    expect(month).toBe("2026-08");
  });
});

describe("parsePersonalStatementCsv fixture", () => {
  it("loads July+August sample rows", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const csv = fs.readFileSync(
      path.join(process.cwd(), "fixtures/personal/ali-bank-statement-2026-07.csv"),
      "utf8"
    );
    const preview = parsePersonalStatementCsv(csv, "fixture.csv");
    expect(preview.rows.length).toBeGreaterThanOrEqual(20);
    expect(preview.rows.some((r) => r.date.startsWith("2026-08"))).toBe(true);
  });
});
