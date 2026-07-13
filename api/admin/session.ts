import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/adminSession.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function cookieHeader(req: VercelRequest): string | null {
  const raw = req.headers.cookie;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("; ");
  return null;
}

/** GET — returns `{ ok: true }` when `paystack_admin_session` cookie matches `ADMIN_ACCESS_PASSWORD`. */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const gate = requireAdminSession(cookieHeader(req));
  sendJson(res, gate.ok ? 200 : gate.status, { ok: gate.ok, error: gate.ok ? undefined : gate.error });
}
