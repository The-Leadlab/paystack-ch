import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/adminSession.js";
import { listAdminUsers } from "../../lib/adminUsers.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function cookieHeader(req: VercelRequest): string | null {
  const raw = req.headers.cookie;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("; ");
  return null;
}

/** GET — list users (search + billing summary). Requires admin session cookie. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    const gate = requireAdminSession(cookieHeader(req));
    if (!gate.ok) {
      sendJson(res, gate.status, { error: gate.error });
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const maxResults =
      typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
    const result = await listAdminUsers({ search, maxResults });
    sendJson(res, 200, result);
  } catch (e) {
    console.error("[api/admin/users]", e);
    const status = (e as { status?: number }).status ?? 500;
    sendJson(res, status, { error: e instanceof Error ? e.message : "Internal server error" });
  }
}
