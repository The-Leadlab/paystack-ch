/**
 * Test-mode guest checkout (`sk_test_...`). Vercel path: `/api/stripe-test/guest-trial-checkout`
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreateCheckoutSessionGuest } from "../../lib/stripeCore";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
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
    const out = await runCreateCheckoutSessionGuest(body, req.headers, { useTestStripe: true });
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[api] stripe-test guest-trial-checkout:", e);
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
