import type { VercelRequest, VercelResponse } from "@vercel/node";

function normalizeOrigin(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function allowedCorsOrigins(): string[] {
  const fromEnv = (process.env.STRIPE_CORS_ORIGIN || "")
    .split(",")
    .map((s) => normalizeOrigin(s.trim()))
    .filter((s): s is string => Boolean(s));
  const publicOrigin = normalizeOrigin(process.env.PUBLIC_APP_URL);
  const defaults = [
    "https://paystack.ch",
    "https://www.paystack.ch",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) defaults.push(`https://${vercelHost.replace(/^https?:\/\//, "")}`);
  return Array.from(new Set([...fromEnv, ...(publicOrigin ? [publicOrigin] : []), ...defaults]));
}

function requestOrigin(req: VercelRequest): string | null {
  const raw = req.headers.origin;
  return normalizeOrigin(Array.isArray(raw) ? raw[0] : raw);
}

function applyCorsForRequest(req: VercelRequest, res: VercelResponse): void {
  const origin = requestOrigin(req);
  if (!origin || !allowedCorsOrigins().includes(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
}

/** Allows browser calls from paystack.ch/www and any comma-separated STRIPE_CORS_ORIGIN entries. */
export function stripeCorsPreflight(req: VercelRequest, res: VercelResponse): boolean {
  applyCorsForRequest(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function stripeCorsApplyHeaders(req: VercelRequest, res: VercelResponse): void {
  applyCorsForRequest(req, res);
}
