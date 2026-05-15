import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreatePortalSession } from "../../lib/stripeBilling.js";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const out = await runCreatePortalSession(req.headers.authorization, req.headers, true);
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[api] stripe-test create-portal-session:", e);
    if (!res.headersSent) {
      try {
        stripeCorsApplyHeaders(req, res);
      } catch {
        /* ignore */
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
