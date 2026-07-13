import { describe, expect, it } from "vitest";
import { adminSessionCookieValue } from "../lib/adminGateCookie.js";
import { adminSessionIsValid } from "../lib/adminSession.js";

describe("adminSession", () => {
  it("validates matching admin session cookie", () => {
    const password = "test-admin-password";
    const token = adminSessionCookieValue(password);
    const cookie = `paystack_admin_session=${token}`;
    expect(adminSessionIsValid(cookie, password)).toBe(true);
  });

  it("rejects wrong password", () => {
    const token = adminSessionCookieValue("correct");
    const cookie = `paystack_admin_session=${token}`;
    expect(adminSessionIsValid(cookie, "wrong")).toBe(false);
  });

  it("rejects missing cookie", () => {
    expect(adminSessionIsValid(null, "password")).toBe(false);
  });
});
