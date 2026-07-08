import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeOAuthState, startGoogleDriveOAuth } from "../lib/googleServices.js";
import { verifyFirebaseAuthorizationHeader } from "../lib/verifyFirebaseIdToken.js";

vi.mock("../lib/verifyFirebaseIdToken.js", () => ({
  verifyFirebaseAuthorizationHeader: vi.fn(),
}));

describe("startGoogleDriveOAuth", () => {
  beforeEach(() => {
    vi.mocked(verifyFirebaseAuthorizationHeader).mockReset();
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_DRIVE_REDIRECT_URI", "https://app.example.com/api/oauth/google/callback");
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
  // TODO: exchanges a valid code and stores the resulting refresh token against the user
  // TODO: creates a Drive folder and stores its id on first connect
  // TODO: reconnecting an already-connected user overwrites the stored token without creating a duplicate folder
  // TODO: rejects the callback and writes nothing to Firestore when the code exchange fails
  // TODO: rejects the callback for an invalid `state` (missing, non-matching, or bound to a different user)
  // TODO: response body excludes the refresh token and access token
});

describe("disconnectGoogleDrive", () => {
  // TODO: revokes the token with Google and deletes the local integration doc
  // TODO: clears local state cleanly when there's nothing to disconnect, or when Google's revoke call fails
});

describe("saveDocumentToDrive (upload hook)", () => {
  // TODO: uploads the document into the user's Drive folder with matching bytes and filename
  // TODO: when the user has no Drive connection, upload/scan completes normally with no Drive call and no surfaced error
  // TODO: app upload/scan still succeeds when a connected user's Drive upload fails
  // TODO: refreshes an expired access token and retries the upload once
  // TODO: an `invalid_grant` response marks the integration as needing reconnection and stops further retries
  // TODO: each document in a batch is saved to Drive independently, so one failure doesn't block the others
  // TODO: does not upload the same document to Drive twice for a single upload event
});

describe("cross-user authorization", () => {
  // TODO: rejects a drive-upload trigger where the target userId doesn't match the authenticated caller
  // TODO: rejects a disconnect request where the target userId doesn't match the authenticated caller
  // TODO: rejects a callback whose state-bound user doesn't match the authenticated caller
});
