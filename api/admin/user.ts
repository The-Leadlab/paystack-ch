import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/adminSession.js";
import { getAdminUserDetail, runAdminUserAction, type AdminUserAction } from "../../lib/adminUsers.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function cookieHeader(req: VercelRequest): string | null {
  const raw = req.headers.cookie;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("; ");
  return null;
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function uidFromRequest(req: VercelRequest, body: Record<string, unknown>): string | null {
  const q = req.query.uid;
  if (typeof q === "string" && q.trim()) return q.trim();
  const b = body.uid;
  if (typeof b === "string" && b.trim()) return b.trim();
  return null;
}

/**
 * GET `?uid=` — user detail with Stripe invoices/subscription.
 * POST `{ uid, action, ... }` — admin action on user.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    const gate = requireAdminSession(cookieHeader(req));
    if (!gate.ok) {
      sendJson(res, gate.status, { error: gate.error });
      return;
    }

    const body = parseBody(req);
    const uid = uidFromRequest(req, body);
    if (!uid) {
      sendJson(res, 400, { error: "uid is required" });
      return;
    }

    if (req.method === "GET") {
      const user = await getAdminUserDetail(uid);
      sendJson(res, 200, { user });
      return;
    }

    if (req.method === "POST") {
      const action = body.action;
      if (typeof action !== "string" || !action.trim()) {
        sendJson(res, 400, { error: "action is required" });
        return;
      }
      const payload = { ...body, action } as AdminUserAction;
      const result = await runAdminUserAction(uid, payload);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error("[api/admin/user]", e);
    const status = (e as { status?: number }).status ?? 500;
    sendJson(res, status, { error: e instanceof Error ? e.message : "Internal server error" });
  }
}
