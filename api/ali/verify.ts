import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, timingSafeEqual } from "crypto";
import { aliLabSessionCookieValue, aliLabSessionSetCookieHeader } from "../../lib/aliLabGateCookie.js";

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
 * POST JSON `{ "password": "..." }` — compares to `ALI_LAB_PASSWORD`.
 * Sets HttpOnly cookie so Edge middleware allows `/ali`.
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
    const expected = process.env.ALI_LAB_PASSWORD?.trim();
    if (!expected) {
      sendJson(res, 503, { error: "ALI_LAB_PASSWORD is not set on the server" });
      return;
    }
    const { password } = parseBody(req);
    const given = String(password ?? "");
    if (!passwordMatches(given, expected)) {
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }
    const token = aliLabSessionCookieValue(expected);
    res.setHeader("Set-Cookie", aliLabSessionSetCookieHeader(token, 60 * 60 * 24 * 30));
    sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("[api/ali/verify]", e);
    if (!res.headersSent) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
