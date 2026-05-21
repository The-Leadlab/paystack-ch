import express, { type Express, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { aliLabSessionCookieValue, aliLabSessionSetCookieHeader } from "../lib/aliLabGateCookie.js";

function passwordMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerAliLabRoutes(app: Express): void {
  app.post("/api/ali/verify", express.json(), (req: Request, res: Response) => {
    const expected = process.env.ALI_LAB_PASSWORD?.trim();
    if (!expected) {
      res.status(503).json({ error: "ALI_LAB_PASSWORD is not set" });
      return;
    }
    const given = String((req.body as { password?: string })?.password ?? "");
    if (!passwordMatches(given, expected)) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = aliLabSessionCookieValue(expected);
    res.setHeader("Set-Cookie", aliLabSessionSetCookieHeader(token, 60 * 60 * 24 * 30));
    res.json({ ok: true });
  });
  console.info("[ali-lab] POST /api/ali/verify (set ALI_LAB_PASSWORD in .env)");
}
