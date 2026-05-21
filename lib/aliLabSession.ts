import { timingSafeEqual } from "crypto";
import {
  ALI_LAB_SESSION_COOKIE_NAME,
  aliLabSessionCookieValue,
} from "./aliLabGateCookie.js";

export function readCookieValue(cookieHeader: string | undefined | null, name: string): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length).trim());
      } catch {
        return p.slice(prefix.length).trim();
      }
    }
  }
  return null;
}

export function aliLabSessionIsValid(
  cookieHeader: string | undefined | null,
  password: string | undefined
): boolean {
  const expectedPassword = password?.trim();
  if (!expectedPassword) return false;
  const got = readCookieValue(cookieHeader, ALI_LAB_SESSION_COOKIE_NAME);
  if (!got) return false;
  const expected = aliLabSessionCookieValue(expectedPassword);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
