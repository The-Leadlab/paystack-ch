import { describe, expect, it } from "vitest";
import {
  dedupeProcessedDocuments,
  isLocalDocMirroredInFirestore,
  preferDocument,
} from "../client/src/cafe/lib/dedupeProcessedDocuments";
import type { ProcessedDocument } from "../client/src/cafe/types";

function doc(partial: Partial<ProcessedDocument> & { id: string; fileName: string }): ProcessedDocument {
  return {
    status: "pending",
    ...partial,
  } as ProcessedDocument;
}

describe("dedupeProcessedDocuments", () => {
  it("keeps completed and drops pending twin with same file name", () => {
    const { keepers, duplicateIds } = dedupeProcessedDocuments([
      doc({ id: "pending-1", fileName: "0087564529.pdf", status: "pending" }),
      doc({
        id: "done-1",
        fileName: "0087564529.pdf",
        status: "completed",
        data: { totalAmount: 100 } as any,
      }),
    ]);
    expect(keepers).toHaveLength(1);
    expect(keepers[0].id).toBe("done-1");
    expect(duplicateIds).toEqual(["pending-1"]);
  });

  it("collapses by fileHash even when names differ", () => {
    const { keepers, duplicateIds } = dedupeProcessedDocuments([
      doc({ id: "a", fileName: "a.pdf", fileHash: "abc12345678", status: "pending" }),
      doc({
        id: "b",
        fileName: "b.pdf",
        fileHash: "abc12345678",
        status: "completed",
        data: { totalAmount: 1 } as any,
      }),
    ]);
    expect(keepers).toHaveLength(1);
    expect(keepers[0].id).toBe("b");
    expect(duplicateIds).toContain("a");
  });

  it("does not merge two completed docs that only share a name", () => {
    const { keepers, duplicateIds } = dedupeProcessedDocuments([
      doc({
        id: "c1",
        fileName: "invoice.pdf",
        status: "completed",
        data: { totalAmount: 10 } as any,
      }),
      doc({
        id: "c2",
        fileName: "invoice.pdf",
        status: "completed",
        data: { totalAmount: 20 } as any,
      }),
    ]);
    expect(keepers).toHaveLength(2);
    expect(duplicateIds).toHaveLength(0);
  });
});

describe("preferDocument / isLocalDocMirroredInFirestore", () => {
  it("prefers completed over pending", () => {
    const winner = preferDocument(
      doc({ id: "p", fileName: "x.pdf", status: "pending" }),
      doc({ id: "c", fileName: "x.pdf", status: "completed", data: { totalAmount: 1 } as any })
    );
    expect(winner.id).toBe("c");
  });

  it("detects local mirror by persistedDocumentId", () => {
    const local = doc({ id: "local-1", fileName: "x.pdf", persistedDocumentId: "fs-1" });
    const firestore = [doc({ id: "fs-1", fileName: "x.pdf", status: "completed" })];
    expect(isLocalDocMirroredInFirestore(local, firestore)).toBe(true);
  });
});
