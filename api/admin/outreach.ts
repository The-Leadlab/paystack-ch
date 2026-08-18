import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdminSession } from "../../lib/adminSession.js";
import { sendOutreachBatch } from "../../lib/sendOutreachBatch.js";
import { OUTREACH_MAX_RECIPIENTS, type OutreachRecipient } from "../../shared/outreachMail.js";

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function cookieHeader(req: VercelRequest): string | null {
  const raw = req.headers.cookie;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("; ");
  return null;
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function parseRecipients(raw: unknown): OutreachRecipient[] {
  if (!Array.isArray(raw)) return [];
  const out: OutreachRecipient[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const email = typeof rec.email === "string" ? rec.email : "";
    const name = typeof rec.name === "string" ? rec.name : "";
    const company = typeof rec.company === "string" ? rec.company : "";
    const extra = typeof rec.extra === "string" ? rec.extra : "";
    const fields =
      rec.fields && typeof rec.fields === "object" && !Array.isArray(rec.fields)
        ? (rec.fields as Record<string, string>)
        : {};
    out.push({ name, email, company, extra, fields });
  }
  return out;
}

/** POST — send cold-outreach emails via Resend. Requires admin session. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const gate = requireAdminSession(cookieHeader(req));
    if (!gate.ok) {
      sendJson(res, gate.status, { error: gate.error });
      return;
    }

    const body = parseBody(req);
    const subject = typeof body.subject === "string" ? body.subject : "";
    const mode = body.mode === "text" ? "text" : "html";
    const content = typeof body.body === "string" ? body.body : "";
    const sender = typeof body.sender === "string" ? body.sender : undefined;
    const replyTo = typeof body.replyTo === "string" ? body.replyTo : undefined;
    const recipients = parseRecipients(body.recipients).slice(0, OUTREACH_MAX_RECIPIENTS);

    const { results } = await sendOutreachBatch({
      subject,
      mode,
      body: content,
      sender,
      replyTo,
      recipients,
    });
    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    sendJson(res, 200, { ok: failed === 0, sent, failed, results });
  } catch (e) {
    console.error("[api/admin/outreach]", e);
    const status = (e as { status?: number }).status ?? 500;
    sendJson(res, status, { error: e instanceof Error ? e.message : "Internal server error" });
  }
}
