import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminUkSessionClearCookieHeader } from "../../lib/adminUkGateCookie.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.setHeader("Set-Cookie", adminUkSessionClearCookieHeader());
  res.status(200).json({ ok: true });
}
