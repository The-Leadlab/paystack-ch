import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HMRC_SANDBOX_BASE_URL,
  completeHmrcOAuth,
  createHmrcOAuthState,
  decodeHmrcOAuthState,
  disconnectHmrc,
  getHmrcStatus,
  getVatObligations,
  isHmrcMtdEnabled,
  resolveHmrcBaseUrl,
  startHmrcOAuth,
  submitVatReturn,
} from "../lib/hmrcMtd.js";
import { verifyFirebaseAuthorizationHeader } from "../lib/verifyFirebaseIdToken.js";

vi.mock("../lib/verifyFirebaseIdToken.js", () => ({
  verifyFirebaseAuthorizationHeader: vi.fn(),
}));

const firestoreSetMock = vi.fn().mockResolvedValue(undefined);
const firestoreGetMock = vi.fn().mockResolvedValue({ data: () => undefined });
const firestoreDocMock = vi.fn(() => ({ set: firestoreSetMock, get: firestoreGetMock }));
const firestoreCollectionMock = vi.fn(() => ({ doc: firestoreDocMock }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: firestoreCollectionMock })),
  FieldValue: {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    delete: vi.fn(() => "FIELD_DELETE_SENTINEL"),
  },
}));

vi.mock("../lib/firebaseAdmin.js", () => ({
  ensureFirebaseAdmin: vi.fn(),
  hasFirebaseAdminCredentials: vi.fn(() => true),
}));

describe("isHmrcMtdEnabled / resolveHmrcBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default and when HMRC_MTD_ENABLED is not true", () => {
    vi.stubEnv("HMRC_MTD_ENABLED", "false");
    expect(isHmrcMtdEnabled()).toBe(false);
    vi.stubEnv("HMRC_MTD_ENABLED", "");
    expect(isHmrcMtdEnabled()).toBe(false);
  });

  it("is true when HMRC_MTD_ENABLED=true", () => {
    vi.stubEnv("HMRC_MTD_ENABLED", "true");
    expect(isHmrcMtdEnabled()).toBe(true);
  });

  it("returns the sandbox base URL for HMRC_ENV=sandbox", () => {
    expect(resolveHmrcBaseUrl("sandbox")).toBe(HMRC_SANDBOX_BASE_URL);
  });

  it("refuses production HMRC_ENV", () => {
    expect(() => resolveHmrcBaseUrl("production")).toThrow(/sandbox only/i);
    expect(() => resolveHmrcBaseUrl("prod")).toThrow(/sandbox only/i);
  });

  it("refuses www.tax.service.gov.uk production host", () => {
    expect(() => resolveHmrcBaseUrl("sandbox", "https://www.tax.service.gov.uk")).toThrow(
      /refused|sandbox/i
    );
  });

  it("refuses api.service.hmrc.gov.uk production API host", () => {
    expect(() => resolveHmrcBaseUrl("sandbox", "https://api.service.hmrc.gov.uk")).toThrow(
      /refused|sandbox/i
    );
  });
});

describe("HMRC handlers when flag is off", () => {
  beforeEach(() => {
    vi.stubEnv("HMRC_MTD_ENABLED", "false");
    vi.mocked(verifyFirebaseAuthorizationHeader).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("startHmrcOAuth returns 403", async () => {
    const out = await startHmrcOAuth("Bearer x");
    expect(out.status).toBe(403);
    expect("json" in out && out.json.error).toMatch(/disabled/i);
  });

  it("completeHmrcOAuth returns 403", async () => {
    const out = await completeHmrcOAuth("code", "state");
    expect(out.status).toBe(403);
  });

  it("getHmrcStatus returns 403", async () => {
    const out = await getHmrcStatus("Bearer x");
    expect(out.status).toBe(403);
  });

  it("disconnectHmrc returns 403", async () => {
    const out = await disconnectHmrc("Bearer x");
    expect(out.status).toBe(403);
  });

  it("getVatObligations returns 403", async () => {
    const out = await getVatObligations("Bearer x", { vrn: "123456789" });
    expect(out.status).toBe(403);
  });

  it("submitVatReturn returns 403", async () => {
    const out = await submitVatReturn("Bearer x", {
      vrn: "123456789",
      periodKey: "18A1",
      vatReturn: { vatDueSales: 100 },
    });
    expect(out.status).toBe(403);
  });
});

describe("HMRC OAuth state + start when enabled", () => {
  beforeEach(() => {
    vi.stubEnv("HMRC_MTD_ENABLED", "true");
    vi.stubEnv("HMRC_ENV", "sandbox");
    vi.stubEnv("HMRC_CLIENT_ID", "test-client-id");
    vi.stubEnv("HMRC_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("HMRC_REDIRECT_URI", "https://app.example.com/api/hmrc/oauth/callback");
    vi.stubEnv("HMRC_STATE_SECRET", "test-hmrc-state-signing-secret");
    vi.mocked(verifyFirebaseAuthorizationHeader).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips signed state", () => {
    const state = createHmrcOAuthState("uid-1", "/admin-uk");
    const decoded = decodeHmrcOAuthState(state);
    expect(decoded.uid).toBe("uid-1");
    expect(decoded.returnPath).toBe("/admin-uk");
  });

  it("rejects tampered state", () => {
    const state = createHmrcOAuthState("uid-1");
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      payload: string;
      sig: string;
    };
    parsed.sig = "forged";
    const forged = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
    expect(() => decodeHmrcOAuthState(forged)).toThrow(/invalid|expired/i);
  });

  it("startHmrcOAuth builds a sandbox authorize URL", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("uid-42");
    const out = await startHmrcOAuth("Bearer token", { returnPath: "/admin-uk" });
    expect("redirectUrl" in out).toBe(true);
    if (!("redirectUrl" in out)) return;
    const url = new URL(out.redirectUrl);
    expect(url.origin).toBe(HMRC_SANDBOX_BASE_URL);
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("scope")).toContain("read:vat");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("startHmrcOAuth does not point at production tax.service.gov.uk", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("uid-42");
    const out = await startHmrcOAuth("Bearer token");
    expect("redirectUrl" in out).toBe(true);
    if (!("redirectUrl" in out)) return;
    expect(out.redirectUrl).not.toContain("www.tax.service.gov.uk");
    expect(out.redirectUrl).not.toContain("://api.service.hmrc.gov.uk");
    expect(out.redirectUrl).toContain("test-api.service.hmrc.gov.uk");
  });
});
