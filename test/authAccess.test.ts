import { describe, expect, it } from "vitest";
import { formatAuthAccessError } from "../client/src/cafe/lib/authAccess";

function t(key: string) {
  return key;
}

function firebaseErr(code: string, message = `Firebase: Error (${code}).`) {
  return Object.assign(new Error(message), { code });
}

describe("formatAuthAccessError", () => {
  it("maps invalid-credential to wrong password", () => {
    expect(formatAuthAccessError(firebaseErr("auth/invalid-credential"), t)).toBe("authErrWrongPassword");
  });

  it("maps wrong-password and user-not-found the same way", () => {
    expect(formatAuthAccessError(firebaseErr("auth/wrong-password"), t)).toBe("authErrWrongPassword");
    expect(formatAuthAccessError(firebaseErr("auth/user-not-found"), t)).toBe("authErrWrongPassword");
  });

  it("parses the code from the Firebase message when .code is missing", () => {
    expect(formatAuthAccessError(new Error("Firebase: Error (auth/invalid-credential)."), t)).toBe(
      "authErrWrongPassword"
    );
  });

  it("leaves unknown errors as the original message", () => {
    expect(formatAuthAccessError(new Error("something else"), t)).toBe("something else");
  });
});
