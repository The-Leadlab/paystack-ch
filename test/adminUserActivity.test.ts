import { describe, expect, it } from "vitest";
import {
  documentsFromActivityEvents,
  mergeDocumentsById,
  type AdminActivityEvent,
  type AdminDocumentSnapshot,
} from "../lib/adminUserActivity.js";
import { ADMIN_ASSIGNABLE_PLANS, parsePaystackPlanId } from "../shared/planCatalog.js";

function doc(partial: Partial<AdminDocumentSnapshot> & { id: string }): AdminDocumentSnapshot {
  return {
    fileName: null,
    status: null,
    error: null,
    errorCode: null,
    lastError: null,
    lastErrorCode: null,
    lastErrorAt: null,
    errorResolvedAt: null,
    pageCount: null,
    createdAt: null,
    updatedAt: null,
    sessionId: null,
    mimeType: null,
    fileSizeBytes: null,
    ...partial,
  };
}

describe("admin plan assignment catalog", () => {
  it("includes Personal for testers", () => {
    expect(ADMIN_ASSIGNABLE_PLANS).toContain("personal");
    expect(parsePaystackPlanId("personal")).toBe("personal");
    expect(parsePaystackPlanId("starter")).toBe("starter");
  });
});

describe("engagement document merge", () => {
  it("dedupes owner-field query results by id", () => {
    const merged = mergeDocumentsById([
      [doc({ id: "a", fileName: "slip.pdf", status: "completed", createdAt: "2026-03-01" })],
      [doc({ id: "a", pageCount: 2 }), doc({ id: "b", fileName: "invoice.pdf", createdAt: "2026-03-02" })],
    ]);
    expect(merged.map((d) => d.id)).toEqual(["b", "a"]);
    expect(merged.find((d) => d.id === "a")?.fileName).toBe("slip.pdf");
    expect(merged.find((d) => d.id === "a")?.pageCount).toBe(2);
  });

  it("fills missing Firestore rows from upload activity so overview matches platform uploads", () => {
    const events: AdminActivityEvent[] = [
      {
        id: "e1",
        type: "doc_upload",
        at: "2026-03-21T10:00:00.000Z",
        meta: { documentId: "doc-1", fileName: "salaire-mars.pdf", sessionId: "s1", pageCount: 1 },
      },
      {
        id: "e2",
        type: "doc_processed",
        at: "2026-03-21T10:01:00.000Z",
        meta: { documentId: "doc-1", fileName: "salaire-mars.pdf", sessionId: "s1" },
      },
    ];
    const fromActivity = documentsFromActivityEvents(events);
    expect(fromActivity).toHaveLength(1);
    const merged = mergeDocumentsById([[], fromActivity]);
    expect(merged).toHaveLength(1);
    expect(merged[0].fileName).toBe("salaire-mars.pdf");
    expect(merged[0].sessionId).toBe("s1");
  });

  it("keeps Firestore status when the same document also appears in activity", () => {
    const stored = [doc({ id: "doc-1", fileName: "salaire.pdf", status: "completed" })];
    const events: AdminActivityEvent[] = [
      {
        id: "e1",
        type: "doc_upload",
        at: "2026-03-21T10:00:00.000Z",
        meta: { documentId: "doc-1", fileName: "salaire.pdf" },
      },
    ];
    const merged = mergeDocumentsById([stored, documentsFromActivityEvents(events)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("completed");
  });
});
