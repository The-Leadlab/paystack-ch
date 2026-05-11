import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreatePortalSession } from "../../lib/stripeBilling";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const out = await runCreatePortalSession(req.headers.authorization, req.headers);
  stripeCorsApplyHeaders(res);
  res.status(out.status).json(out.json);
}
