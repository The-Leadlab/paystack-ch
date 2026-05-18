/**
 * Pre-login Stripe Checkout (trial). **Vercel:** `POST /api/stripe/guest-trial-checkout`
 * JSON body: `{ planId?, stripeTest?: boolean }`. Logic lives in `lib/stripeCore.ts` so this file
 * does not import `shared/*` (Node ESM on Vercel resolves extensionless paths to missing modules).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreateCheckoutSessionGuest } from "../../lib/stripeCore.js";
import { serverStripeUseTestMode } from "../../lib/stripeMode.js";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let raw: { planId?: string; stripeTest?: boolean } = {};
    if (typeof req.body === "string") {
      try {
        raw = JSON.parse(req.body) as { planId?: string; stripeTest?: boolean };
      } catch {
        raw = {};
      }
    } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
      raw = req.body as { planId?: string; stripeTest?: boolean };
    }
    const useTestStripe =
      serverStripeUseTestMode() ||
      raw.stripeTest === true ||
      (typeof raw.stripeTest === "string" && String(raw.stripeTest).toLowerCase() === "true");
    const out = await runCreateCheckoutSessionGuest({ planId: raw.planId }, req.headers, { useTestStripe });
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[api] guest-trial-checkout:", e);
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
