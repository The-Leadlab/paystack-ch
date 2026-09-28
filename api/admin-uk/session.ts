import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveAdminUkPassword } from "../../lib/adminUkGateCookie.js";
import { adminUkSessionIsValid } from "../../lib/adminUkSession.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function cookieHeader(req: VercelRequest): string | null {
  const raw = req.headers.cookie as string | string[] | undefined;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("; ");
  return null;
}

/** GET — `{ ok: true }` when Admin UK session cookie matches password. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const password = resolveAdminUkPassword();
  const ok = adminUkSessionIsValid(cookieHeader(req), password);
  sendJson(res, ok ? 200 : 401, { ok });
}
