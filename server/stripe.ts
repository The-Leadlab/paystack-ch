/**
 * Express mounting for Stripe routes (production Node server: `pnpm start`).
 * Core logic lives in `lib/stripeBilling.ts` (shared with Vercel `api/stripe/*`).
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { getStripe, runCreateCheckoutSessionGuest } from "../lib/stripeCore";
import {
  runCreateCheckoutSession,
  runCreatePortalSession,
  runLinkCheckoutSession,
  runStripeWebhook,
} from "../lib/stripeBilling";

export async function handleStripeWebhookExpress(req: Request, res: Response): Promise<void> {
  if (!getStripe()) {
    res.status(503).json({ error: "Stripe webhook not configured" });
    return;
  }
  const payload = req.body;
  if (!Buffer.isBuffer(payload)) {
    res.status(400).send("Webhook body must be raw");
    return;
  }
  const sig = req.headers["stripe-signature"];
  const sigStr = typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined;
  const out = await runStripeWebhook(payload, sigStr);
  if (out.json !== undefined) res.status(out.status).json(out.json);
  else res.status(out.status).send(out.text ?? "");
}

export async function handleCreateCheckoutSessionExpress(req: Request, res: Response): Promise<void> {
  try {
    const out = await runCreateCheckoutSession(
      req.headers.authorization,
      (req.body || {}) as { priceId?: string; planId?: string },
      req.headers as Record<string, string | string[] | undefined>
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] create-checkout-session express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

export async function handleCreatePortalSessionExpress(req: Request, res: Response): Promise<void> {
  try {
    const out = await runCreatePortalSession(
      req.headers.authorization,
      req.headers as Record<string, string | string[] | undefined>
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] create-portal-session express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

export async function handleCreateCheckoutSessionGuestExpress(req: Request, res: Response): Promise<void> {
  try {
    const out = await runCreateCheckoutSessionGuest(
      (req.body || {}) as { planId?: string },
      req.headers as Record<string, string | string[] | undefined>
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] create-checkout-session-guest express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

export async function handleLinkCheckoutSessionExpress(req: Request, res: Response): Promise<void> {
  try {
    const out = await runLinkCheckoutSession(
      req.headers.authorization,
      (req.body || {}) as { sessionId?: string },
      req.headers as Record<string, string | string[] | undefined>
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] link-checkout-session express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

const jsonParser = express.json({ limit: "256kb" });

/** Mount Stripe routes when STRIPE_SECRET_KEY is set. Webhook must stay raw (registered first). */
export function registerStripeIfConfigured(app: Express): boolean {
  if (!getStripe()) {
    console.info("[stripe] STRIPE_SECRET_KEY not set — billing API disabled.");
    return false;
  }
  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
    void handleStripeWebhookExpress(req, res);
  });
  app.post("/api/stripe/create-checkout-session", jsonParser, (req, res) => {
    void handleCreateCheckoutSessionExpress(req, res);
  });
  app.post("/api/stripe/guest-trial-checkout", jsonParser, (req, res) => {
    void handleCreateCheckoutSessionGuestExpress(req, res);
  });
  app.post("/api/stripe/create-checkout-session-guest", jsonParser, (req, res) => {
    void handleCreateCheckoutSessionGuestExpress(req, res);
  });
  app.post("/api/stripe/link-checkout-session", jsonParser, (req, res) => {
    void handleLinkCheckoutSessionExpress(req, res);
  });
  app.post("/api/stripe/create-portal-session", jsonParser, (req, res) => {
    void handleCreatePortalSessionExpress(req, res);
  });
  console.info("[stripe] Billing routes enabled (/api/stripe/*).");
  return true;
}
