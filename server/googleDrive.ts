import type { Express, Request, Response } from "express";
import express from "express";
import {
  completeGoogleDriveOAuth,
  disconnectGoogleDrive,
  getGoogleDriveStatus,
  saveUploadedDocumentToDrive,
  startGoogleDriveOAuth,
} from "../lib/googleServices";
import { publicAppOriginFromHeaders } from "../lib/stripeCore";
import {
  googleDriveCallbackRedirect,
  resolveGoogleDriveErrorReason,
} from "../shared/googleDriveErrors";

const jsonParser = express.json();

export function registerGoogleDriveRoutes(app: Express): void {
  app.get("/api/oauth/google/status", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await getGoogleDriveStatus(req.headers.authorization);
    res.status(out.status).json("json" in out ? out.json : {});
  });

  app.post("/api/oauth/google/start", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await startGoogleDriveOAuth(req.headers.authorization);
    if ("redirectUrl" in out) {
      res.status(200).json({ redirectUrl: out.redirectUrl });
      return;
    }
    res.status(out.status).json(out.json);
  });

  // Hit by a top-level browser navigation from Google, not a fetch() — no Authorization header
  // is available here. The requesting user's identity comes from the signed `state` param instead.
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const origin = publicAppOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error : "";

    if (oauthError) {
      const reason = resolveGoogleDriveErrorReason(oauthError);
      res.redirect(303, googleDriveCallbackRedirect(origin, false, reason));
      return;
    }

    if (!code || !state) {
      res.redirect(303, googleDriveCallbackRedirect(origin, false, "unknown"));
      return;
    }
    const out = await completeGoogleDriveOAuth(code, state);
    if (out.status !== 200) {
      const errMsg = "json" in out && typeof out.json.error === "string" ? out.json.error : "unknown";
      console.error("[googleDrive] callback failed:", out.status, errMsg);
      const reason = resolveGoogleDriveErrorReason(errMsg);
      res.redirect(303, googleDriveCallbackRedirect(origin, false, reason));
      return;
    }
    res.redirect(303, googleDriveCallbackRedirect(origin, true));
  });

  app.post("/api/oauth/google/disconnect", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await disconnectGoogleDrive(req.headers.authorization);
    res.status(out.status).json("json" in out ? out.json : {});
  });

  app.post("/api/drive/save-document", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { runDriveSaveDocument } = await import("../lib/googleDriveSync");
    const out = await runDriveSaveDocument(req.headers.authorization, req.body);
    res.status(out.status).json(out.json);
  });

  app.post("/api/drive/sync-from-drive", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { runDriveSyncFromDrive } = await import("../lib/googleDriveSync");
    const out = await runDriveSyncFromDrive(req.headers.authorization);
    res.status(out.status).json(out.json);
  });

  app.post("/api/drive/save", jsonParser, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await saveUploadedDocumentToDrive(req.headers.authorization, req.body || {});
    res.status(out.status).json("json" in out ? out.json : {});
  });

  console.info("[googleDrive] OAuth routes enabled (/api/oauth/google/*).");
  console.info("[googleDrive] Sync routes enabled (/api/drive/*).");
}
