import { describe, expect, it } from "vitest";
import {
  computePersonalDateFolderName,
  sanitizeOAuthReturnPath,
} from "../lib/googleServices.js";
import { googleDriveCallbackRedirect } from "../shared/googleDriveErrors.js";

describe("computePersonalDateFolderName", () => {
  it("formats UTC calendar date as YYYY-MM-DD", () => {
    expect(computePersonalDateFolderName(new Date(Date.UTC(2026, 6, 1)))).toBe("2026-07-01");
  });
});

describe("sanitizeOAuthReturnPath", () => {
  it("allows personal overview path", () => {
    expect(sanitizeOAuthReturnPath("/personal/overview")).toBe("/personal/overview");
  });

  it("rejects absolute URLs and protocol-relative paths", () => {
    expect(sanitizeOAuthReturnPath("https://evil.example/")).toBeUndefined();
    expect(sanitizeOAuthReturnPath("//evil.example")).toBeUndefined();
  });
});

describe("googleDriveCallbackRedirect", () => {
  it("returns to personal path when provided", () => {
    expect(googleDriveCallbackRedirect("https://paystack.ch", true, undefined, "/personal/overview")).toBe(
      "https://paystack.ch/personal/overview?googleDrive=connected"
    );
  });

  it("defaults to /app", () => {
    expect(googleDriveCallbackRedirect("https://paystack.ch", true)).toBe(
      "https://paystack.ch/app?googleDrive=connected"
    );
  });
});
