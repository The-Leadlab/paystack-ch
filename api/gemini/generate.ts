import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runGeminiGenerate } from "../../lib/geminiProxy";
import { stripeCorsApplyHeaders, stripeCorsPreflight } from "../lib/stripeCors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (stripeCorsPreflight(req, res)) return;
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      stripeCorsApplyHeaders(req, res);
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const out = await runGeminiGenerate(req.headers.authorization, body, req.headers);
    stripeCorsApplyHeaders(req, res);
    res.status(out.status).json(out.json);
  } catch (error) {
    console.error("[api] gemini generate:", error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      stripeCorsApplyHeaders(req, res);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
