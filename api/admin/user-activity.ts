import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/adminSession.js";
import { listAdminUserUsageInsights } from "../../lib/adminUserActivity.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function cookieHeader(req: VercelRequest): string | null {
  const raw = req.headers.cookie;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("; ");
  return null;
}

/**
 * GET `?uid=&limit=&errorsOnly=1` — usage insights: logins, work sessions, events, docs metadata.
 */
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

    const uid = typeof req.query.uid === "string" ? req.query.uid.trim() : "";
    if (!uid) {
      sendJson(res, 400, { error: "uid is required" });
      return;
    }

    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 120;
    const errorsOnly =
      req.query.errorsOnly === "1" ||
      req.query.errorsOnly === "true" ||
      req.query.errorsOnly === "yes";

    const result = await listAdminUserUsageInsights(uid, {
      limit: Number.isFinite(limitRaw) ? limitRaw : 120,
      errorsOnly,
    });
    sendJson(res, 200, result);
  } catch (e) {
    console.error("[api/admin/user-activity]", e);
    const status = (e as { status?: number }).status ?? 500;
    sendJson(res, status, { error: e instanceof Error ? e.message : "Internal server error" });
  }
}
