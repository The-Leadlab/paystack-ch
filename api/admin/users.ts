import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/adminSession.js";
import { createAdminUser, listAdminUsers, type CreateAdminUserInput } from "../../lib/adminUsers.js";
import { parsePaystackPlanId } from "../../shared/planCatalog.js";

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

/** GET — list users. POST — create user. Requires admin session cookie. */
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

    if (req.method === "GET") {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const maxResults =
        typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
      const result = await listAdminUsers({ search, maxResults });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const email = typeof body.email === "string" ? body.email : "";
      const password = typeof body.password === "string" ? body.password : "";
      const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
      const planRaw = typeof body.planId === "string" ? body.planId : null;
      const input: CreateAdminUserInput = {
        email,
        password,
        displayName,
        emailVerified: body.emailVerified === true,
        disabled: body.disabled === true,
        planId: planRaw ? parsePaystackPlanId(planRaw) : null,
        planTestMode: body.planTestMode === true,
      };
      const result = await createAdminUser(input);
      sendJson(res, 201, result);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error("[api/admin/users]", e);
    const status = (e as { status?: number }).status ?? 500;
    sendJson(res, status, { error: e instanceof Error ? e.message : "Internal server error" });
  }
}
