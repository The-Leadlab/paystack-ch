import { describe, expect, it } from "vitest";
import { buildErrorLog, summarizeErrorLog } from "../lib/errorLog.js";

describe("errorLog", () => {
  it("keeps logged errors after the live document is corrected", () => {
    const entries = buildErrorLog(
      [
        {
          id: "e1",
          at: "2026-09-21T10:00:00.000Z",
          meta: {
            fileName: "receipt.pdf",
            errorCode: "quota",
            errorMessage: "Gemini quota",
            sessionId: "s1",
            documentId: "d1",
          },
        },
      ],
      [
        {
          id: "d1",
          fileName: "receipt.pdf",
          status: "completed",
          error: null,
          errorCode: null,
          sessionId: "s1",
          errorResolvedAt: "2026-09-21T10:05:00.000Z",
        },
      ]
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("resolved");
    expect(summarizeErrorLog(entries)).toEqual({
      loggedCount: 1,
      openCount: 0,
      resolvedCount: 1,
      archivedCount: 0,
    });
  });

  it("marks deleted documents as archived instead of dropping the log", () => {
    const entries = buildErrorLog(
      [
        {
          id: "e2",
          at: "2026-09-21T11:00:00.000Z",
          meta: { fileName: "gone.pdf", errorCode: "save", errorMessage: "Failed to save" },
        },
      ],
      []
    );
    expect(entries[0].status).toBe("archived");
    expect(summarizeErrorLog(entries).loggedCount).toBe(1);
    expect(summarizeErrorLog(entries).openCount).toBe(0);
  });

  it("keeps currently failing documents as open", () => {
    const entries = buildErrorLog(
      [
        {
          id: "e3",
          at: "2026-09-21T12:00:00.000Z",
          meta: { documentId: "d3", fileName: "bad.pdf", errorCode: "parse" },
        },
      ],
      [
        {
          id: "d3",
          fileName: "bad.pdf",
          status: "error",
          error: "Could not parse",
          errorCode: "parse",
          sessionId: "s1",
        },
      ]
    );
    expect(entries[0].status).toBe("open");
    expect(summarizeErrorLog(entries).openCount).toBe(1);
  });
});
