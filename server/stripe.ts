/**
 * Express mounting for Stripe routes (production Node server: `pnpm start`).
 * Core logic lives in `lib/stripeBilling.ts` (shared with Vercel `api/stripe/*`).
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { getStripe, getStripeTest, runCreateCheckoutSessionGuest } from "../lib/stripeCore";
import {
  runCreateCheckoutSession,
  runCreatePortalSession,
  runLinkCheckoutSession,
  runStripeWebhook,
} from "../lib/stripeBilling";

export async function handleStripeWebhookExpress(
  req: Request,
  res: Response,
  useTestStripe = false
): Promise<void> {
  const stripe = useTestStripe ? getStripeTest() : getStripe();
  if (!stripe) {
    res.status(503).json({ error: useTestStripe ? "Stripe test webhook not configured" : "Stripe webhook not configured" });
    return;
  }
  const payload = req.body;
  if (!Buffer.isBuffer(payload)) {
    res.status(400).json({ error: "Webhook body must be raw" });
    return;
  }
  const sig = req.headers["stripe-signature"];
  const sigStr = typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined;
  const out = await runStripeWebhook(payload, sigStr, useTestStripe);
  if (out.json !== undefined) res.status(out.status).json(out.json);
  else res.status(out.status).json({ error: typeof out.text === "string" ? out.text : "Request failed" });
}

export async function handleCreateCheckoutSessionExpress(
  req: Request,
  res: Response,
  useTestStripe = false
): Promise<void> {
  try {
    const out = await runCreateCheckoutSession(
      req.headers.authorization,
      (req.body || {}) as { priceId?: string; planId?: string },
      req.headers as Record<string, string | string[] | undefined>,
      useTestStripe
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] create-checkout-session express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

export async function handleCreatePortalSessionExpress(
  req: Request,
  res: Response,
  useTestStripe = false
): Promise<void> {
  try {
    const out = await runCreatePortalSession(
      req.headers.authorization,
      (req.body ?? {}) as { stripeCustomerId?: string },
      req.headers as Record<string, string | string[] | undefined>,
      useTestStripe
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] create-portal-session express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

export async function handleCreateCheckoutSessionGuestExpress(
  req: Request,
  res: Response,
  useTestStripe = false,
  sandboxSource?: "build" | "query" | "server"
): Promise<void> {
  try {
    const body = (req.body || {}) as {
      planId?: string;
      stripeTest?: unknown;
      stripeSandboxSource?: string;
    };
    const parsedSource =
      sandboxSource ??
      (body.stripeSandboxSource === "build" || body.stripeSandboxSource === "query"
        ? body.stripeSandboxSource
        : undefined);
    const out = await runCreateCheckoutSessionGuest(
      {
        planId: body.planId,
        stripeTest: body.stripeTest === true || String(body.stripeTest).toLowerCase() === "true",
        stripeSandboxSource: parsedSource,
      },
      req.headers as Record<string, string | string[] | undefined>,
      { useTestStripe, sandboxSource: parsedSource }
    );
    res.status(out.status).json(out.json);
  } catch (e) {
    console.error("[stripe] create-checkout-session-guest express:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  }
}

export async function handleLinkCheckoutSessionExpress(
  req: Request,
  res: Response,
  useTestStripe = false
): Promise<void> {
  try {
    const out = await runLinkCheckoutSession(
      req.headers.authorization,
      (req.body || {}) as { sessionId?: string },
      req.headers as Record<string, string | string[] | undefined>,
      useTestStripe
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

/** Single URL for guest trial: body `stripeTest: true` selects test keys (matches Vercel). */
function mountSharedGuestTrialCheckout(app: Express): void {
  app.post("/api/stripe/guest-trial-checkout", jsonParser, (req, res) => {
    const b = (req.body || {}) as { planId?: string; stripeTest?: unknown; stripeSandboxSource?: string };
    const useTest =
      b.stripeTest === true ||
      (typeof b.stripeTest === "string" && String(b.stripeTest).toLowerCase() === "true");
    const sandboxSource =
      b.stripeSandboxSource === "build" || b.stripeSandboxSource === "query"
        ? b.stripeSandboxSource
        : undefined;
    void handleCreateCheckoutSessionGuestExpress(req, res, useTest, sandboxSource);
  });
}

function mountStripeRoutes(app: Express, useTestStripe: boolean): void {
  const prefix = useTestStripe ? "/api/stripe-test" : "/api/stripe";
  app.post(`${prefix}/webhook`, express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
    void handleStripeWebhookExpress(req, res, useTestStripe);
  });
  app.post(`${prefix}/create-checkout-session`, jsonParser, (req, res) => {
    void handleCreateCheckoutSessionExpress(req, res, useTestStripe);
  });
  app.post(`${prefix}/create-checkout-session-guest`, jsonParser, (req, res) => {
    void handleCreateCheckoutSessionGuestExpress(req, res, useTestStripe);
  });
  app.post(`${prefix}/link-checkout-session`, jsonParser, (req, res) => {
    void handleLinkCheckoutSessionExpress(req, res, useTestStripe);
  });
  app.post(`${prefix}/create-portal-session`, jsonParser, (req, res) => {
    void handleCreatePortalSessionExpress(req, res, useTestStripe);
  });
}

/** Mount live and/or test Stripe routes when the corresponding secret keys are set. */
export function registerStripeIfConfigured(app: Express): boolean {
  const live = Boolean(getStripe());
  const test = Boolean(getStripeTest());
  if (!live && !test) {
    console.info("[stripe] No STRIPE_SECRET_KEY or STRIPE_TEST_SECRET_KEY — billing API disabled.");
    return false;
  }
  if (live || test) {
    mountSharedGuestTrialCheckout(app);
    console.info("[stripe] Guest trial checkout: POST /api/stripe/guest-trial-checkout (body.stripeTest for test mode).");
  }
  if (live) {
    mountStripeRoutes(app, false);
    console.info("[stripe] Live billing enabled (/api/stripe/*).");
  }
  if (test) {
    mountStripeRoutes(app, true);
    console.info("[stripe] Test billing enabled (/api/stripe-test/*).");
  }
  return true;
}
