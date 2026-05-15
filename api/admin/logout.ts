import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminSessionClearCookieHeader } from "../../lib/adminGateCookie.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

/** Clears HttpOnly admin session cookie (Path=/admin). */
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
    res.setHeader("Set-Cookie", adminSessionClearCookieHeader());
    sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("[api/admin/logout]", e);
    if (!res.headersSent) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
