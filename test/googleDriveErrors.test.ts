import { describe, expect, it } from "vitest";
import {
  googleDriveErrorUserMessage,
  resolveGoogleDriveErrorReason,
} from "../shared/googleDriveErrors.js";

describe("googleDriveErrors", () => {
  it("maps Firebase Admin errors", () => {
    expect(resolveGoogleDriveErrorReason("Server missing Firebase Admin credentials")).toBe("firebase_admin");
    expect(googleDriveErrorUserMessage("firebase_admin")).toMatch(/FIREBASE_SERVICE_ACCOUNT_JSON/);
  });

  it("maps refresh token errors", () => {
    expect(resolveGoogleDriveErrorReason("Google did not return a refresh token")).toBe("no_refresh_token");
  });
});
