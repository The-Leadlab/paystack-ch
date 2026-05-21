import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aliLabSessionIsValid } from "../../lib/aliLabSession.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

/** GET — returns `{ ok: true }` when `paystack_ali_lab_session` cookie matches `ALI_LAB_PASSWORD`. */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const password = process.env.ALI_LAB_PASSWORD?.trim();
  if (!password) {
    sendJson(res, 503, { error: "ALI_LAB_PASSWORD is not set on the server" });
    return;
  }
  const cookieHeader =
    typeof req.headers.cookie === "string"
      ? req.headers.cookie
      : Array.isArray(req.headers.cookie)
        ? req.headers.cookie.join("; ")
        : null;
  const ok = aliLabSessionIsValid(cookieHeader, password);
  sendJson(res, ok ? 200 : 401, { ok });
}
