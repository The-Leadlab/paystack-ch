import type { VercelRequest, VercelResponse } from "@vercel/node";

/** When `STRIPE_CORS_ORIGIN` is set (e.g. your Firebase Hosting URL), allow browser calls from that origin. */
export function stripeCorsPreflight(req: VercelRequest, res: VercelResponse): boolean {
  const allow = process.env.STRIPE_CORS_ORIGIN?.trim();
  if (!allow) return false;
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function stripeCorsApplyHeaders(res: VercelResponse): void {
  const allow = process.env.STRIPE_CORS_ORIGIN?.trim();
  if (allow) res.setHeader("Access-Control-Allow-Origin", allow);
}
