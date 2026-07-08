import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGoogleDriveStatus } from "../../../lib/googleServices.js";
import { stripeCorsApplyHeaders } from "../../lib/stripeCors.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  stripeCorsApplyHeaders(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.setHeader("Cache-Control", "no-store");

  try {
    const out = await getGoogleDriveStatus(req.headers.authorization);
    res.status(out.status).json("json" in out ? out.json : {});
  } catch (error) {
    console.error("[api] google drive status:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
