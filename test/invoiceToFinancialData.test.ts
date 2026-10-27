import { describe, expect, it } from "vitest";
import { invoiceFileName, invoiceToFinancialData } from "../client/src/cafe/lib/invoiceToFinancialData";
import type { InvoiceData } from "../client/src/cafe/types/invoice";

function sampleInvoice(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoiceNumber: "INV-20261027-0001",
    date: "2026-10-27",
    dueDate: "2026-11-26",
    status: "draft",
    direction: "outgoing",
    companyName: "Café Demo",
    companyAddress: "Switzerland",
    companyPhone: "",
    companyEmail: "",
    companyWebsite: "",
    clientName: "Alice",
    clientCompany: "Alice SA",
    clientAddress: "",
    clientPhone: "",
    clientEmail: "a@example.com",
    items: [
      {
        id: "1",
        description: "Catering",
        quantity: 2,
        unitPrice: 50,
        discountAmount: 0,
        taxRate: 8.1,
        total: 100,
      },
    ],
    subtotal: 100,
    taxRate: 8.1,
    taxAmount: 8.1,
    discountAmount: 0,
    total: 108.1,
    currency: "CHF",
    currencySymbol: "CHF",
    notes: "",
    terms: "",
    paymentTerms: "Net 30",
    ...overrides,
  };
}

describe("invoiceToFinancialData", () => {
  it("maps outgoing invoices to income with our company as issuer", () => {
    const data = invoiceToFinancialData(sampleInvoice({ direction: "outgoing" }));
    expect(data.userFlowOverride).toBe("INCOME");
    expect(data.issuer).toBe("Café Demo");
    expect(data.recipient).toBe("Alice SA");
    expect(data.lineItems?.[0]?.type).toBe("INCOME");
    expect(data.amountInCHF).toBeCloseTo(108.1);
  });

  it("maps incoming invoices to expense with client as issuer", () => {
    const data = invoiceToFinancialData(sampleInvoice({ direction: "incoming" }));
    expect(data.userFlowOverride).toBe("EXPENSE");
    expect(data.issuer).toBe("Alice SA");
    expect(data.recipient).toBe("Café Demo");
    expect(data.lineItems?.[0]?.type).toBe("EXPENSE");
  });

  it("builds a stable file name", () => {
    expect(invoiceFileName(sampleInvoice())).toContain("INV-20261027-0001");
  });
});
