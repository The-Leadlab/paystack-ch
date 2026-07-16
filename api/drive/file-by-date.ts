import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fileDocumentByWeek } from "../../lib/googleServices.js";
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
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const documentDate = typeof body.documentDate === "string" ? body.documentDate : "";
    if (!sourceId || !documentDate) {
      stripeCorsApplyHeaders(req, res);
      res.status(400).json({ error: "sourceId and documentDate are required" });
      return;
    }
    const out = await fileDocumentByWeek(req.headers.authorization, { sourceId, documentDate });
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json("json" in out ? out.json : {});
  } catch (error) {
    console.error("[api] drive file-by-date:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      stripeCorsApplyHeaders(req, res);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
