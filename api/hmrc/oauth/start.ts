import type { VercelRequest, VercelResponse } from "@vercel/node";
import { startHmrcOAuth } from "../../../lib/hmrcMtd.js";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../../lib/stripeCors.js";

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
    const out = await startHmrcOAuth(req.headers.authorization, body);
    stripeCorsApplyHeaders(req, res);
    if ("redirectUrl" in out) {
      res.status(200).json({ redirectUrl: out.redirectUrl });
      return;
    }
    res.status(out.status).json(out.json);
  } catch (error) {
    console.error("[api] hmrc oauth start:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      stripeCorsApplyHeaders(req, res);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
