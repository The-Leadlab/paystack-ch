import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, timingSafeEqual } from "crypto";
import {
  adminUkSessionCookieValue,
  adminUkSessionSetCookieHeader,
  resolveAdminUkPassword,
} from "../../lib/adminUkGateCookie.js";
import { clientIpFromHeaders, passwordGateLimiter } from "../../lib/loginRateLimit.js";

function parseBody(req: VercelRequest): { password?: string } {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as { password?: string };
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    return req.body as { password?: string };
  }
  return {};
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function passwordMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST JSON `{ "password": "..." }` — compares to `ADMIN_UK_PASSWORD` (default `admin UK`).
 * Sets HttpOnly cookie so Edge middleware allows `/admin-uk`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    const expected = resolveAdminUkPassword();
    const ip = clientIpFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    const gateKey = `admin-uk:${ip}`;
    const blocked = passwordGateLimiter.check(gateKey);
    if (!blocked.ok) {
      res.setHeader("Retry-After", String(blocked.retryAfterSec));
      sendJson(res, 429, { error: blocked.error });
      return;
    }
    const { password } = parseBody(req);
    const given = String(password ?? "");
    if (!passwordMatches(given, expected)) {
      const after = passwordGateLimiter.recordFailure(gateKey);
      if (!after.ok) {
        res.setHeader("Retry-After", String(after.retryAfterSec));
        sendJson(res, 429, { error: after.error });
        return;
      }
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }
    passwordGateLimiter.recordSuccess(gateKey);
    const token = adminUkSessionCookieValue(expected);
    res.setHeader("Set-Cookie", adminUkSessionSetCookieHeader(token, 60 * 60 * 24 * 30));
    sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("[api/admin-uk/verify]", e);
    if (!res.headersSent) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
