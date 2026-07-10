import { afterEach, describe, expect, it } from "vitest";
import { buildReportEmailHtml } from "../lib/reportEmailTemplate.js";

describe("buildReportEmailHtml", () => {
  afterEach(() => {
    delete process.env.PUBLIC_APP_URL;
  });

  it("renders branded layout with logo, colors, and metrics", () => {
    process.env.PUBLIC_APP_URL = "https://paystack.ch";
    const html = buildReportEmailHtml({
      locale: "en",
      periodLabel: "Monthly report",
      sessionName: "Café Geneva",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      totalIncome: 12000.5,
      totalExpenses: 8450.25,
      balance: 3550.25,
    });

    expect(html).toContain("https://paystack.ch/brand/paystack-mark-128.png");
    expect(html).toContain("#E8423F");
    expect(html).toContain("paystack<span");
    expect(html).toMatch(/CHF 12[\u2019']000\.50/);
    expect(html).toMatch(/CHF 3[\u2019']550\.25/);
    expect(html).toContain("Café Geneva");
    expect(html).toContain("Open Paystack");
  });

  it("escapes HTML in session name", () => {
    const html = buildReportEmailHtml({
      locale: "fr",
      periodLabel: "Rapport mensuel",
      sessionName: '<script>alert("x")</script>',
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ouvrir Paystack");
  });
});
