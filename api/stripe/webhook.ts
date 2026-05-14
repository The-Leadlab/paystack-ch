import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runStripeWebhook } from "../../lib/stripeBilling";
import { readStripeWebhookRawBody } from "../lib/stripeWebhookRequest";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    let buf: Buffer;
    try {
      buf = await readStripeWebhookRawBody(req);
    } catch (e) {
      console.error("[stripe] webhook read body:", e);
      sendJson(res, 400, { error: e instanceof Error ? e.message : "Could not read webhook body" });
      return;
    }
    const sig = req.headers["stripe-signature"];
    const sigStr = typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined;
    const out = await runStripeWebhook(buf, sigStr);
    if (out.json !== undefined) {
      sendJson(res, out.status, out.json);
      return;
    }
    sendJson(res, out.status, { error: typeof out.text === "string" ? out.text : "Request failed" });
  } catch (e) {
    console.error("[stripe] webhook fatal:", e);
    if (!res.headersSent) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : "Webhook invocation failed" });
    }
  }
}
