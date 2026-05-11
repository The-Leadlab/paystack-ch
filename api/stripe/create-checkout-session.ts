import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreateCheckoutSession } from "../../lib/stripeBilling";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body: { priceId?: string } = {};
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body) as { priceId?: string };
    } catch {
      body = {};
    }
  } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    body = req.body as { priceId?: string };
  }
  const out = await runCreateCheckoutSession(req.headers.authorization, body, req.headers);
  stripeCorsApplyHeaders(res);
  res.status(out.status).json(out.json);
}
