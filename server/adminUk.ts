import express, { type Express, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import {
  adminUkSessionCookieValue,
  adminUkSessionSetCookieHeader,
  adminUkSessionClearCookieHeader,
  resolveAdminUkPassword,
} from "../lib/adminUkGateCookie.js";
import { adminUkSessionIsValid } from "../lib/adminUkSession.js";

function passwordMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerAdminUkRoutes(app: Express): void {
  app.post("/api/admin-uk/verify", express.json(), (req: Request, res: Response) => {
    const expected = resolveAdminUkPassword();
    const given = String((req.body as { password?: string })?.password ?? "");
    if (!passwordMatches(given, expected)) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = adminUkSessionCookieValue(expected);
    res.setHeader("Set-Cookie", adminUkSessionSetCookieHeader(token, 60 * 60 * 24 * 30));
    res.json({ ok: true });
  });
  app.get("/api/admin-uk/session", (req: Request, res: Response) => {
    const expected = resolveAdminUkPassword();
    const ok = adminUkSessionIsValid(req.headers.cookie, expected);
    res.status(ok ? 200 : 401).json({ ok });
  });
  app.post("/api/admin-uk/logout", (_req: Request, res: Response) => {
    res.setHeader("Set-Cookie", adminUkSessionClearCookieHeader());
    res.json({ ok: true });
  });
  console.info(
    "[admin-uk] POST /api/admin-uk/verify, GET /api/admin-uk/session (ADMIN_UK_PASSWORD, default \"admin UK\")"
  );
}
