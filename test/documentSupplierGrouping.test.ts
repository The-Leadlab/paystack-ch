import { describe, expect, it } from "vitest";
import {
  conjoinedCountForSupplierGroup,
  documentAmountForSupplierGroup,
  normalizeEntityKey,
  supplierGroupKeysForDocument,
} from "../client/src/cafe/i18n/documentDisplayI18n";

describe("Documents library supplier grouping (7×7 fan-out)", () => {
  it("collapses same-supplier invoice variants into one card key", () => {
    const doc = {
      id: "binder-1",
      fileName: "Bar à tapas - Factures fournisseurs.pdf",
      data: {
        issuer: "7 invoices detected",
        totalAmount: 3613.47,
        amountInCHF: 3613.47,
        subDocuments: [
          { issuer: "Bar à tapas - Facture 1001", totalAmount: 500 },
          { issuer: "Bar à tapas | FAC-1002", totalAmount: 510 },
          { issuer: "BAR À TAPAS SA", totalAmount: 520 },
          { issuer: "Bar a tapas - Facture 1004", totalAmount: 530 },
          { issuer: "Bar à tapas", totalAmount: 540 },
          { issuer: "Bar à tapas - 1006", totalAmount: 550 },
          { issuer: "Bar à tapas SARL", totalAmount: 463.47 },
        ],
      },
    };

    const keys = supplierGroupKeysForDocument(doc);
    expect(keys).toHaveLength(1);
    expect(normalizeEntityKey(keys[0]).toLowerCase()).toContain("tapas");

    expect(documentAmountForSupplierGroup(doc, keys[0])).toBeCloseTo(3613.47, 2);
    expect(conjoinedCountForSupplierGroup([doc], keys[0])).toBe(7);
  });

  it("does not multiply binder total across fan-out cards for mixed suppliers", () => {
    const doc = {
      id: "mixed-1",
      fileName: "mixed.pdf",
      data: {
        issuer: "2 invoices detected",
        totalAmount: 300,
        amountInCHF: 300,
        subDocuments: [
          { issuer: "Taligro Demaurex", totalAmount: 200, amountInCHF: 200 },
          { issuer: "Prodega", totalAmount: 100, amountInCHF: 100 },
        ],
      },
    };

    const keys = supplierGroupKeysForDocument(doc);
    expect(keys).toHaveLength(2);

    const amounts = keys.map((k) => documentAmountForSupplierGroup(doc, k));
    expect(amounts.sort((a, b) => a - b)).toEqual([100, 200]);
    expect(amounts.reduce((s, n) => s + n, 0)).toBeCloseTo(300, 2);
  });

  it("ignores the AI 'N invoices detected' label as a supplier key", () => {
    const doc = {
      id: "label-only",
      fileName: "pack.pdf",
      data: {
        issuer: "7 invoices detected",
        totalAmount: 100,
        subDocuments: [],
      },
    };
    expect(supplierGroupKeysForDocument(doc)).toEqual(["Unknown Supplier"]);
  });

  it("keeps a single invoice document as one supplier card", () => {
    const doc = {
      id: "single",
      fileName: "one.pdf",
      data: {
        issuer: "Transgourmet",
        totalAmount: 88,
        subDocuments: [],
      },
    };
    expect(supplierGroupKeysForDocument(doc)).toEqual(["TRANSGOURMET"]);
  });
});
