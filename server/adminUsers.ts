import express, { type Express, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { adminSessionCookieValue, adminSessionSetCookieHeader } from "../lib/adminGateCookie.js";
import { adminSessionIsValid, requireAdminSession } from "../lib/adminSession.js";
import { getAdminUserDetail, createAdminUser, listAdminUsers, runAdminUserAction, type AdminUserAction, type CreateAdminUserInput } from "../lib/adminUsers.js";
import { parsePaystackPlanId } from "../shared/planCatalog.js";

function passwordMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerAdminRoutes(app: Express): void {
  app.post("/api/admin/verify", express.json(), (req: Request, res: Response) => {
    const expected = process.env.ADMIN_ACCESS_PASSWORD?.trim();
    if (!expected) {
      res.status(503).json({ error: "ADMIN_ACCESS_PASSWORD is not set" });
      return;
    }
    const given = String((req.body as { password?: string })?.password ?? "");
    if (!passwordMatches(given, expected)) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = adminSessionCookieValue(expected);
    res.setHeader("Set-Cookie", adminSessionSetCookieHeader(token, 60 * 60 * 24 * 30));
    res.json({ ok: true });
  });

  app.get("/api/admin/session", (req: Request, res: Response) => {
    const gate = requireAdminSession(req.headers.cookie);
    res.status(gate.ok ? 200 : gate.status).json({ ok: gate.ok, error: gate.ok ? undefined : gate.error });
  });

  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const gate = requireAdminSession(req.headers.cookie);
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const maxResults =
        typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
      const result = await listAdminUsers({ search, maxResults });
      res.json(result);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  });

  app.post("/api/admin/users", express.json(), async (req: Request, res: Response) => {
    try {
      const gate = requireAdminSession(req.headers.cookie);
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const planRaw = typeof body.planId === "string" ? body.planId : null;
      const input: CreateAdminUserInput = {
        email: typeof body.email === "string" ? body.email : "",
        password: typeof body.password === "string" ? body.password : "",
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        emailVerified: body.emailVerified === true,
        disabled: body.disabled === true,
        planId: planRaw ? parsePaystackPlanId(planRaw) : null,
        planTestMode: body.planTestMode === true,
      };
      const result = await createAdminUser(input);
      res.status(201).json(result);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  });

  app.get("/api/admin/user", async (req: Request, res: Response) => {
    try {
      const gate = requireAdminSession(req.headers.cookie);
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const uid = typeof req.query.uid === "string" ? req.query.uid.trim() : "";
      if (!uid) {
        res.status(400).json({ error: "uid is required" });
        return;
      }
      const user = await getAdminUserDetail(uid);
      res.json({ user });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  });

  app.post("/api/admin/user", express.json(), async (req: Request, res: Response) => {
    try {
      const gate = requireAdminSession(req.headers.cookie);
      if (!gate.ok) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";
      const action = typeof body.action === "string" ? body.action.trim() : "";
      if (!uid || !action) {
        res.status(400).json({ error: "uid and action are required" });
        return;
      }
      const result = await runAdminUserAction(uid, { ...body, action } as AdminUserAction);
      res.json(result);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ error: e instanceof Error ? e.message : "Internal server error" });
    }
  });

  console.info(
    "[admin] POST /api/admin/verify, GET /api/admin/session, GET|POST /api/admin/users, GET|POST /api/admin/user"
  );
}
