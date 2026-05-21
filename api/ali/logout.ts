import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aliLabSessionClearCookieHeader } from "../../lib/aliLabGateCookie.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.setHeader("Set-Cookie", aliLabSessionClearCookieHeader());
  res.status(200).json({ ok: true });
}
