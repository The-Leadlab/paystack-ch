/**
 * Express mount for team invite API (local stripe-dev + production Node).
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { runTeamAction } from "../lib/workspaceInvites.js";

const jsonParser = express.json({ limit: "1mb" });

export function registerTeamRoutes(app: Express): void {
  app.post("/api/team", jsonParser, async (req: Request, res: Response) => {
    try {
      const out = await runTeamAction(
        req.headers.authorization,
        (req.body || {}) as Record<string, unknown>,
        req.headers as Record<string, string | string[] | undefined>
      );
      res.status(out.status).json(out.json);
    } catch (e) {
      console.error("[team] express:", e);
      if (!res.headersSent) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Internal server error" });
      }
    }
  });
  console.info("[team] Invites enabled: POST /api/team");
}
