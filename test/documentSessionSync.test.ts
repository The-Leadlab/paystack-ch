import { describe, expect, it } from "vitest";
import {
  documentBelongsToSessionView,
  resolveDocumentSessionId,
} from "../client/src/cafe/context/DocumentContext";

describe("resolveDocumentSessionId", () => {
  it("prefers camelCase sessionId", () => {
    expect(resolveDocumentSessionId({ sessionId: "abc", session_id: "xyz" })).toBe("abc");
  });

  it("falls back to snake_case", () => {
    expect(resolveDocumentSessionId({ session_id: "xyz" })).toBe("xyz");
  });

  it("returns empty when missing", () => {
    expect(resolveDocumentSessionId({})).toBe("");
  });
});

describe("documentBelongsToSessionView", () => {
  it("matches the active session", () => {
    expect(documentBelongsToSessionView({ session_id: "s1" }, "s1")).toBe(true);
    expect(documentBelongsToSessionView({ sessionId: "s1" }, "s1")).toBe(true);
  });

  it("includes unscoped legacy docs so uploads are not hidden", () => {
    expect(documentBelongsToSessionView({}, "s1")).toBe(true);
    expect(documentBelongsToSessionView({ session_id: "" }, "s1")).toBe(true);
  });

  it("excludes other sessions", () => {
    expect(documentBelongsToSessionView({ session_id: "s2" }, "s1")).toBe(false);
  });
});
