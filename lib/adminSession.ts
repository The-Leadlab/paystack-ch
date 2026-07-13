import { timingSafeEqual } from "crypto";
import { ADMIN_SESSION_COOKIE_NAME, adminSessionCookieValue } from "./adminGateCookie.js";
import { readCookieValue } from "./aliLabSession.js";

export function adminSessionIsValid(
  cookieHeader: string | undefined | null,
  password: string | undefined
): boolean {
  const expectedPassword = password?.trim();
  if (!expectedPassword) return false;
  const got = readCookieValue(cookieHeader, ADMIN_SESSION_COOKIE_NAME);
  if (!got) return false;
  const expected = adminSessionCookieValue(expectedPassword);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export function requireAdminSession(
  cookieHeader: string | undefined | null
): { ok: true } | { ok: false; status: number; error: string } {
  const password = process.env.ADMIN_ACCESS_PASSWORD?.trim();
  if (!password) {
    return { ok: false, status: 503, error: "ADMIN_ACCESS_PASSWORD is not set on the server" };
  }
  if (!adminSessionIsValid(cookieHeader, password)) {
    return { ok: false, status: 401, error: "Admin session required" };
  }
  return { ok: true };
}
