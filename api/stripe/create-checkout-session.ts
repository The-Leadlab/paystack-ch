import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreateCheckoutSession } from "../../lib/stripeBilling";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let body: { priceId?: string; planId?: string } = {};
    if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body) as { priceId?: string; planId?: string };
      } catch {
        body = {};
      }
    } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
      body = req.body as { priceId?: string; planId?: string };
    }
    const out = await runCreateCheckoutSession(req.headers.authorization, body, req.headers);
    stripeCorsApplyHeaders(res);
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[api] create-checkout-session:", e);
    if (!res.headersSent) {
      try {
        stripeCorsApplyHeaders(res);
      } catch {
        /* ignore */
      }
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}
