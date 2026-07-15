import type { Express, Request, Response } from "express";
import express from "express";
import { runGeminiGenerate } from "../lib/geminiProxy";
import { runGeminiGenerateFromStorage } from "../lib/geminiStorageProxy";

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
  app.post("/api/gemini/generate-from-storage", jsonParser, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const out = await runGeminiGenerateFromStorage(
      req.headers.authorization,
      req.body || {},
      req.headers as Record<string, string | string[] | undefined>
    );
    res.status(out.status).json(out.json);
  });
  console.info(
    "[gemini] Secure Gemini routes enabled (/api/gemini/generate, /api/gemini/generate-from-storage)."
  );
}
