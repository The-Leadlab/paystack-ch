import { apiUrl } from "@/lib/apiBase";
import type { OutreachRecipient } from "@shared/outreachMail";

export type OutreachSendResult = {
  ok: boolean;
  sent: number;
  failed: number;
  results: Array<{ email: string; ok: boolean; error?: string }>;
};

export async function sendAdminOutreach(payload: {
  subject: string;
  mode: "html" | "text";
  body: string;
  sender?: string;
  from?: string;
  replyTo?: string;
  recipients: OutreachRecipient[];
}): Promise<OutreachSendResult> {
  const res = await fetch(apiUrl("/api/admin/outreach"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let data: { error?: unknown } & Partial<OutreachSendResult> = {};
  try {
    data = raw ? (JSON.parse(raw) as { error?: unknown } & Partial<OutreachSendResult>) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const err =
      typeof data.error === "string"
        ? data.error
        : raw.includes("FUNCTION_INVOCATION_FAILED")
          ? `Outreach API crashed (HTTP ${res.status}). Check Vercel logs.`
          : `Request failed (HTTP ${res.status})`;
    throw new Error(err);
  }
  return {
    ok: data.ok === true,
    sent: data.sent ?? 0,
    failed: data.failed ?? 0,
    results: data.results ?? [],
  };
}
