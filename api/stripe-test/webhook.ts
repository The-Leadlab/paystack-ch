import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buffer } from "micro";
import { runStripeWebhook } from "../../lib/stripeBilling";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let buf: Buffer;
  try {
    buf = await buffer(req);
  } catch (e) {
    console.error("[stripe-test] webhook read body:", e);
    res.status(400).send("Could not read body");
    return;
  }
  const sig = req.headers["stripe-signature"];
  const sigStr = typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined;
  const out = await runStripeWebhook(buf, sigStr, true);
  if (out.json !== undefined) res.status(out.status).json(out.json);
  else res.status(out.status).send(out.text ?? "");
}
