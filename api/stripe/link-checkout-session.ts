import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runLinkCheckoutSession } from "../../lib/stripeBilling";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body: { sessionId?: string } = {};
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body) as { sessionId?: string };
    } catch {
      body = {};
    }
  } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    body = req.body as { sessionId?: string };
  }
  const out = await runLinkCheckoutSession(req.headers.authorization, body, req.headers);
  stripeCorsApplyHeaders(res);
  res.status(out.status).json(out.json);
}
