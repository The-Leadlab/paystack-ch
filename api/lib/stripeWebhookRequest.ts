import type { VercelRequest } from "@vercel/node";
import { buffer } from "micro";

/**
 * Stripe signature verification requires the exact raw bytes. Vercel may expose the body as a
 * Buffer, a string, or (if misconfigured) a parsed object — the latter cannot be verified.
 */
export async function readStripeWebhookRawBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (req.body != null && typeof req.body === "object") {
    throw new Error(
      "Webhook body was parsed before verification (need raw JSON bytes). Check Vercel / Stripe webhook configuration."
    );
  }
  return buffer(req);
}
