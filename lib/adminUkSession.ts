import {
  ADMIN_UK_SESSION_COOKIE_NAME,
  adminUkSessionCookieValue,
} from "./adminUkGateCookie.js";
import { readCookieValue } from "./aliLabSession.js";

export function adminUkSessionIsValid(
  cookieHeader: string | null | undefined,
  expectedPassword: string
): boolean {
  if (!expectedPassword) return false;
  const got = readCookieValue(cookieHeader, ADMIN_UK_SESSION_COOKIE_NAME);
  if (!got) return false;
  const expected = adminUkSessionCookieValue(expectedPassword);
  if (got.length !== expected.length) return false;
  let out = 0;
  for (let i = 0; i < got.length; i++) out |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return out === 0;
}
