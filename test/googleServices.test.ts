import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeGoogleDriveOAuth,
  createOAuthState,
  decodeOAuthState,
  disconnectGoogleDrive,
  saveDocumentToDrive,
  startGoogleDriveOAuth,
} from "../lib/googleServices.js";
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

describe("startGoogleDriveOAuth", () => {
  beforeEach(() => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockReset();
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_DRIVE_REDIRECT_URI", "https://app.example.com/api/oauth/google/callback");
    vi.stubEnv("GOOGLE_DRIVE_STATE_SECRET", "test-state-signing-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects the request when the Firebase ID token is missing or invalid", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockRejectedValue(
      Object.assign(new Error("Authentication required"), { status: 401 })
    );

    const result = await startGoogleDriveOAuth(undefined);

    expect(result.status).toBe(401);
  });

  it("redirects to Google's OAuth URL with the correct scope and client_id", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("test-uid");

    const result = await startGoogleDriveOAuth("Bearer valid-token");

    if (!("redirectUrl" in result)) {
      throw new Error(`Expected a redirect result, got: ${JSON.stringify(result)}`);
    }
    const url = new URL(result.redirectUrl);
    expect(result.status).toBe(302);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
  });

  it("generates a `state` value that's unique per request and bound to the requesting user", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("test-uid");

    const first = await startGoogleDriveOAuth("Bearer valid-token");
    const second = await startGoogleDriveOAuth("Bearer valid-token");

    if (!("redirectUrl" in first) || !("redirectUrl" in second)) {
      throw new Error("Expected redirect results");
    }
    const firstState = new URL(first.redirectUrl).searchParams.get("state");
    const secondState = new URL(second.redirectUrl).searchParams.get("state");
    if (!firstState || !secondState) {
      throw new Error("Expected a state param on both redirects");
    }

    expect(firstState).not.toBe(secondState);
    expect(decodeOAuthState(firstState).uid).toBe("test-uid");
    expect(decodeOAuthState(secondState).uid).toBe("test-uid");
  });

  it("selects the client id based on environment (dev vs. prod)", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("test-uid");
    vi.stubEnv("GOOGLE_DRIVE_TEST_CLIENT_ID", "test-mode-client-id");

    vi.stubEnv("GOOGLE_DRIVE_USE_TEST_MODE", "true");
    const testModeResult = await startGoogleDriveOAuth("Bearer valid-token");

    vi.stubEnv("GOOGLE_DRIVE_USE_TEST_MODE", "false");
    const prodModeResult = await startGoogleDriveOAuth("Bearer valid-token");

    if (!("redirectUrl" in testModeResult) || !("redirectUrl" in prodModeResult)) {
      throw new Error("Expected redirect results");
    }
    expect(new URL(testModeResult.redirectUrl).searchParams.get("client_id")).toBe(
      "test-mode-client-id"
    );
    expect(new URL(prodModeResult.redirectUrl).searchParams.get("client_id")).toBe(
      "test-client-id"
    );
  });
});

describe("completeGoogleDriveOAuth (callback)", () => {
  const fetchMock = vi.fn();

  function mockGoogleFetchRoutes(overrides: { tokenBody?: object; folderBody?: object } = {}) {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: "access-123",
            refresh_token: "refresh-456",
            expires_in: 3600,
            ...overrides.tokenBody,
          }),
        });
      }
      if (url === "https://www.googleapis.com/drive/v3/files") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "folder-abc", ...overrides.folderBody }),
        });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    firestoreSetMock.mockClear();
    firestoreDocMock.mockClear();
    firestoreCollectionMock.mockClear();
    firestoreGetMock.mockReset().mockResolvedValue({ data: () => undefined });
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("GOOGLE_DRIVE_REDIRECT_URI", "https://app.example.com/api/oauth/google/callback");
    vi.stubEnv("GOOGLE_DRIVE_STATE_SECRET", "test-state-signing-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exchanges a valid code and stores the resulting refresh token against the user", async () => {
    mockGoogleFetchRoutes();
    const state = createOAuthState("test-uid");

    const result = await completeGoogleDriveOAuth("valid-code", state);

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" })
    );
    const requestBody = fetchMock.mock.calls[0][1].body as string;
    expect(new URLSearchParams(requestBody).get("code")).toBe("valid-code");
    expect(firestoreCollectionMock).toHaveBeenCalledWith("users");
    expect(firestoreDocMock).toHaveBeenCalledWith("test-uid");
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googleDrive: expect.objectContaining({ refreshToken: "refresh-456" }),
      }),
      { merge: true }
    );
  });

  it("creates a Drive folder and stores its id on first connect", async () => {
    mockGoogleFetchRoutes();
    const state = createOAuthState("test-uid");

    const result = await completeGoogleDriveOAuth("valid-code", state);

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-123" }),
      })
    );
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googleDrive: expect.objectContaining({ folderId: "folder-abc" }),
      }),
      { merge: true }
    );
  });

  it("reconnecting an already-connected user overwrites the stored token without creating a duplicate folder", async () => {
    mockGoogleFetchRoutes();
    firestoreGetMock.mockResolvedValueOnce({
      data: () => ({ googleDrive: { folderId: "existing-folder-id", refreshToken: "old-refresh" } }),
    });
    const state = createOAuthState("test-uid");

    const result = await completeGoogleDriveOAuth("valid-code", state);

    expect(result.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files",
      expect.anything()
    );
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googleDrive: expect.objectContaining({
          folderId: "existing-folder-id",
          refreshToken: "refresh-456",
        }),
      }),
      { merge: true }
    );
  });

  it("rejects the callback and writes nothing to Firestore when the code exchange fails", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "invalid_grant", error_description: "Malformed auth code" }),
        });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    const state = createOAuthState("test-uid");

    const result = await completeGoogleDriveOAuth("bad-code", state);

    expect(result.status).not.toBe(200);
    expect(firestoreSetMock).not.toHaveBeenCalled();
  });

  it("rejects the callback for an invalid `state` (missing, non-matching, or bound to a different user)", async () => {
    mockGoogleFetchRoutes();

    const missingState = await completeGoogleDriveOAuth("valid-code", "");
    expect(missingState.status).not.toBe(200);

    const garbageState = await completeGoogleDriveOAuth("valid-code", "not-a-real-state");
    expect(garbageState.status).not.toBe(200);

    // Forged: claims uid "victim-uid" but wasn't signed with the real GOOGLE_DRIVE_STATE_SECRET,
    // simulating an attacker who doesn't know the server's signing secret.
    const forgedPayload = JSON.stringify({
      uid: "victim-uid",
      nonce: "fake-nonce",
      expiresAt: Date.now() + 60_000,
    });
    const forgedSig = createHmac("sha256", "wrong-secret").update(forgedPayload).digest("base64url");
    const forgedState = Buffer.from(JSON.stringify({ payload: forgedPayload, sig: forgedSig })).toString(
      "base64url"
    );
    const forgedResult = await completeGoogleDriveOAuth("valid-code", forgedState);
    expect(forgedResult.status).not.toBe(200);

    expect(firestoreSetMock).not.toHaveBeenCalled();
  });

  it("response body excludes the refresh token and access token", async () => {
    mockGoogleFetchRoutes();
    const state = createOAuthState("test-uid");

    const result = await completeGoogleDriveOAuth("valid-code", state);

    expect(result.status).toBe(200);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("access-123");
    expect(serialized).not.toContain("refresh-456");
  });
});

describe("disconnectGoogleDrive", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    firestoreSetMock.mockClear();
    firestoreDocMock.mockClear();
    firestoreCollectionMock.mockClear();
    firestoreGetMock.mockReset().mockResolvedValue({ data: () => undefined });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("revokes the token with Google and deletes the local integration doc", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("test-uid");
    firestoreGetMock.mockResolvedValue({
      data: () => ({ googleDrive: { refreshToken: "refresh-456", folderId: "folder-abc" } }),
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await disconnectGoogleDrive("Bearer valid-token");

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/revoke",
      expect.objectContaining({ method: "POST" })
    );
    const requestBody = fetchMock.mock.calls[0][1].body as string;
    expect(new URLSearchParams(requestBody).get("token")).toBe("refresh-456");
    expect(firestoreDocMock).toHaveBeenCalledWith("test-uid");
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ googleDrive: "FIELD_DELETE_SENTINEL" }),
      { merge: true }
    );
  });

  it("clears local state cleanly when there's nothing to disconnect, or when Google's revoke call fails", async () => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockResolvedValue("test-uid");

    firestoreGetMock.mockResolvedValueOnce({ data: () => undefined });
    const noConnectionResult = await disconnectGoogleDrive("Bearer valid-token");
    expect(noConnectionResult.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ googleDrive: "FIELD_DELETE_SENTINEL" }),
      { merge: true }
    );

    firestoreSetMock.mockClear();
    firestoreGetMock.mockResolvedValueOnce({
      data: () => ({ googleDrive: { refreshToken: "refresh-456" } }),
    });
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "server_error" }) });

    const revokeFailedResult = await disconnectGoogleDrive("Bearer valid-token");
    expect(revokeFailedResult.status).toBe(200);
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ googleDrive: "FIELD_DELETE_SENTINEL" }),
      { merge: true }
    );
  });
});

describe("saveDocumentToDrive (upload hook)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    firestoreSetMock.mockClear();
    firestoreDocMock.mockClear();
    firestoreCollectionMock.mockClear();
    firestoreGetMock.mockReset().mockResolvedValue({ data: () => undefined });
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_SECRET", "test-client-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uploads the document into the user's Drive folder with matching bytes and filename", async () => {
    firestoreGetMock.mockResolvedValue({
      data: () => ({ googleDrive: { refreshToken: "refresh-456", folderId: "folder-abc" } }),
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: "access-789", expires_in: 3600 }),
        });
      }
      if (url === "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart") {
        return Promise.resolve({ ok: true, json: async () => ({ id: "uploaded-file-id" }) });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const result = await saveDocumentToDrive("test-uid", {
      bytes: Buffer.from("fake-pdf-bytes"),
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    expect(result.status).toBe(200);
    const uploadCall = fetchMock.mock.calls.find(
      ([url]) => url === "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
    );
    expect(uploadCall).toBeDefined();
    const uploadInit = uploadCall![1] as { headers: Record<string, string>; body: Buffer };
    expect(uploadInit.headers.Authorization).toBe("Bearer access-789");
    const bodyText = Buffer.from(uploadInit.body).toString("utf8");
    expect(bodyText).toContain('"name":"report.pdf"');
    expect(bodyText).toContain('"parents":["folder-abc"]');
    expect(bodyText).toContain("fake-pdf-bytes");
  });

  it("when the user has no Drive connection, upload/scan completes normally with no Drive call and no surfaced error", async () => {
    firestoreGetMock.mockResolvedValue({ data: () => undefined });

    const result = await saveDocumentToDrive("test-uid", {
      bytes: Buffer.from("fake-pdf-bytes"),
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    expect(result.status).toBe(200);
    if (!("json" in result)) {
      throw new Error("Expected a json result");
    }
    expect(result.json).not.toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("app upload/scan still succeeds when a connected user's Drive upload fails", async () => {
    firestoreGetMock.mockResolvedValue({
      data: () => ({ googleDrive: { refreshToken: "refresh-456", folderId: "folder-abc" } }),
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: "access-789", expires_in: 3600 }),
        });
      }
      if (url === "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: { message: "Drive quota exceeded" } }),
        });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    // Awaiting without a try/catch is itself part of the assertion: if saveDocumentToDrive
    // threw/rejected here instead of returning an error result, this test would fail with an
    // unhandled rejection rather than reaching the expectations below.
    const result = await saveDocumentToDrive("test-uid", {
      bytes: Buffer.from("fake-pdf-bytes"),
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    expect(result.status).not.toBe(200);
    if (!("json" in result)) {
      throw new Error("Expected a json result");
    }
    expect(result.json).toHaveProperty("error");
  });
  it("refreshes an expired access token and retries the upload once", async () => {
    firestoreGetMock.mockResolvedValue({
      data: () => ({ googleDrive: { refreshToken: "refresh-456", folderId: "folder-abc" } }),
    });
    let tokenAttempts = 0;
    let uploadAttempts = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        tokenAttempts += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: `access-token-${tokenAttempts}`, expires_in: 3600 }),
        });
      }
      if (url === "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart") {
        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ error: { message: "Invalid Credentials" } }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ id: "uploaded-file-id" }) });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const result = await saveDocumentToDrive("test-uid", {
      bytes: Buffer.from("fake-pdf-bytes"),
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    expect(result.status).toBe(200);
    expect(tokenAttempts).toBe(2);
    expect(uploadAttempts).toBe(2);
    const uploadCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
    );
    const secondUploadInit = uploadCalls[1][1] as { headers: Record<string, string> };
    expect(secondUploadInit.headers.Authorization).toBe("Bearer access-token-2");
  });

  it("an `invalid_grant` response marks the integration as needing reconnection and stops further retries", async () => {
    firestoreGetMock.mockResolvedValue({
      data: () => ({ googleDrive: { refreshToken: "dead-refresh-token", folderId: "folder-abc" } }),
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "invalid_grant", error_description: "Token has been revoked" }),
        });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const result = await saveDocumentToDrive("test-uid", {
      bytes: Buffer.from("fake-pdf-bytes"),
      filename: "report.pdf",
      mimeType: "application/pdf",
    });

    expect(result.status).not.toBe(200);
    // Only the one token-exchange attempt happened — no retry, and the upload endpoint was
    // never reached, since a dead refresh token can't be fixed by retrying.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firestoreSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googleDrive: expect.objectContaining({ needsReconnect: true }),
      }),
      { merge: true }
    );
  });


  // TODO: each document in a batch is saved to Drive independently, so one failure doesn't block the others
  // TODO: does not upload the same document to Drive twice for a single upload event
});

describe("cross-user authorization", () => {
  // TODO: rejects a drive-upload trigger where the target userId doesn't match the authenticated caller
  // TODO: rejects a disconnect request where the target userId doesn't match the authenticated caller
  // TODO: rejects a callback whose state-bound user doesn't match the authenticated caller
});
