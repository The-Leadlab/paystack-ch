import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runDriveSyncFromDrive } from "../../lib/googleDriveSync.js";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const out = await runDriveSyncFromDrive(req.headers.authorization);
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (error) {
    console.error("[api] drive sync-from-drive:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      stripeCorsApplyHeaders(req, res);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
