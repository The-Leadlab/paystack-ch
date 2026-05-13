import type { Express, Request, Response } from "express";
import express from "express";
import { runGeminiGenerate } from "../lib/geminiProxy";

const jsonParser = express.json({ limit: process.env.GEMINI_EXPRESS_JSON_LIMIT || "18mb" });

export function registerGeminiRoutes(app: Express): void {
  app.post("/api/gemini/generate", jsonParser, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await runGeminiGenerate(
      req.headers.authorization,
      (req.body || {}) as { model?: unknown; contents?: unknown; config?: unknown },
      req.headers as Record<string, string | string[] | undefined>
    );
    res.status(out.status).json(out.json);
  });
  console.info("[gemini] Secure Gemini route enabled (/api/gemini/generate).");
}
