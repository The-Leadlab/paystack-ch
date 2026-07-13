/**
 * Pre-login Stripe Checkout (trial). **Vercel:** `POST /api/stripe/guest-trial-checkout`
 * JSON body: `{ planId?, stripeTest?: boolean }`. Logic lives in `lib/stripeCore.ts` so this file
 * does not import `shared/*` (Node ESM on Vercel resolves extensionless paths to missing modules).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runCreateCheckoutSessionGuest } from "../../lib/stripeCore.js";
import { serverStripeUseTestMode } from "../../lib/stripeMode.js";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors.js";

function parseSandboxSource(raw: unknown): "build" | "query" | undefined {
  if (raw === "build" || raw === "query") return raw;
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    let raw: { planId?: string; stripeTest?: boolean; stripeSandboxSource?: string } = {};
    if (typeof req.body === "string") {
      try {
        raw = JSON.parse(req.body) as { planId?: string; stripeTest?: boolean; stripeSandboxSource?: string };
      } catch {
        raw = {};
      }
    } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
      raw = req.body as { planId?: string; stripeTest?: boolean; stripeSandboxSource?: string };
    }
    const serverForcedTest = serverStripeUseTestMode();
    const clientSandbox = raw.stripeTest === true || String(raw.stripeTest).toLowerCase() === "true";
    const useTestStripe = serverForcedTest || clientSandbox;
    const sandboxSource = serverForcedTest
      ? "server"
      : parseSandboxSource(raw.stripeSandboxSource);
    const out = await runCreateCheckoutSessionGuest(
      { planId: raw.planId, stripeTest: clientSandbox, stripeSandboxSource: sandboxSource },
      req.headers,
      { useTestStripe, sandboxSource }
    );
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
