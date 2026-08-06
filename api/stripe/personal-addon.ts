import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runPersonalAddonCheckout } from "../../lib/stripeBilling.js";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let body: { addon?: string } = {};
    if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body) as { addon?: string };
      } catch {
        body = {};
      }
    } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
      body = req.body as { addon?: string };
    }
    const out = await runPersonalAddonCheckout(req.headers.authorization, body, req.headers);
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[api] personal-addon:", e);
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
