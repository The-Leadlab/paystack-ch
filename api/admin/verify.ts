import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash, timingSafeEqual } from "crypto";

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

/** Constant-time compare of UTF-8 strings via SHA-256 digests (avoids length leaks on raw buffers). */
function passwordMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST JSON `{ "password": "..." }` — compares to `ADMIN_ACCESS_PASSWORD` (set in Vercel / server env).
 * Used only to unlock the `/admin` operator panel in the SPA (sessionStorage); does not grant API access by itself.
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
    const expected = process.env.ADMIN_ACCESS_PASSWORD?.trim();
    if (!expected) {
      sendJson(res, 503, { error: "ADMIN_ACCESS_PASSWORD is not set on the server" });
      return;
    }
    const { password } = parseBody(req);
    const given = String(password ?? "");
    if (!passwordMatches(given, expected)) {
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("[api/admin/verify]", e);
    if (!res.headersSent) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
