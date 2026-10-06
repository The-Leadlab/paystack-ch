import type { Express, Request, Response } from "express";
import express from "express";
import {
  completeHmrcOAuth,
  decodeHmrcOAuthState,
  disconnectHmrc,
  getHmrcStatus,
  getVatObligations,
  hmrcCallbackRedirect,
  startHmrcOAuth,
  submitVatReturn,
} from "../lib/hmrcMtd";
import { publicAppOriginFromHeaders } from "../lib/stripeCore";

const jsonParser = express.json();

export function registerHmrcMtdRoutes(app: Express): void {
  app.get("/api/hmrc/oauth/status", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await getHmrcStatus(req.headers.authorization);
    res.status(out.status).json("json" in out ? out.json : {});
  });

  app.post("/api/hmrc/oauth/start", jsonParser, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const out = await startHmrcOAuth(req.headers.authorization, body);
    if ("redirectUrl" in out) {
      res.status(200).json({ redirectUrl: out.redirectUrl });
      return;
    }
    res.status(out.status).json(out.json);
  });

  app.get("/api/hmrc/oauth/callback", async (req: Request, res: Response) => {
    const origin = publicAppOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error : "";

    let returnPath = "/admin-uk";
    if (state) {
      try {
        returnPath = decodeHmrcOAuthState(state).returnPath || "/admin-uk";
      } catch {
        // Fall back; completeHmrcOAuth still validates state.
      }
    }

    if (oauthError) {
      res.redirect(303, hmrcCallbackRedirect(origin, false, oauthError, returnPath));
      return;
    }
    if (!code || !state) {
      res.redirect(303, hmrcCallbackRedirect(origin, false, "unknown", returnPath));
      return;
    }
    const out = await completeHmrcOAuth(code, state);
    if (out.status !== 200) {
      const errMsg = "json" in out && typeof out.json.error === "string" ? out.json.error : "unknown";
      console.error("[hmrcMtd] callback failed:", out.status, errMsg);
      res.redirect(303, hmrcCallbackRedirect(origin, false, errMsg, returnPath));
      return;
    }
    res.redirect(303, hmrcCallbackRedirect(origin, true, undefined, returnPath));
  });

  app.post("/api/hmrc/oauth/disconnect", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await disconnectHmrc(req.headers.authorization);
    res.status(out.status).json("json" in out ? out.json : {});
  });

  app.post("/api/hmrc/vat/obligations", jsonParser, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await getVatObligations(req.headers.authorization, req.body || {}, {
      forwardedFor: req.headers["x-forwarded-for"],
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      clientIp: req.socket?.remoteAddress,
    });
    res.status(out.status).json("json" in out ? out.json : {});
  });

  app.get("/api/hmrc/vat/obligations", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await getVatObligations(
      req.headers.authorization,
      {
        vrn: req.query.vrn,
        from: req.query.from,
        to: req.query.to,
        status: req.query.status,
      },
      {
        forwardedFor: req.headers["x-forwarded-for"],
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        clientIp: req.socket?.remoteAddress,
      }
    );
    res.status(out.status).json("json" in out ? out.json : {});
  });

  app.post("/api/hmrc/vat/return", jsonParser, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await submitVatReturn(req.headers.authorization, req.body || {}, {
      forwardedFor: req.headers["x-forwarded-for"],
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      clientIp: req.socket?.remoteAddress,
    });
    res.status(out.status).json("json" in out ? out.json : {});
  });

  console.info("[hmrcMtd] OAuth + VAT routes enabled (/api/hmrc/*).");
}
