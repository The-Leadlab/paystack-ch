import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreateCheckoutSessionGuest } from "../../lib/stripeBilling";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body: { planId?: string } = {};
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body) as { planId?: string };
    } catch {
      body = {};
    }
  } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    body = req.body as { planId?: string };
  }
  const out = await runCreateCheckoutSessionGuest(body, req.headers);
  stripeCorsApplyHeaders(res);
  res.status(out.status).json(out.json);
}
