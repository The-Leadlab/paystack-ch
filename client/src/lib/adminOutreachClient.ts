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
  replyTo?: string;
  recipients: OutreachRecipient[];
}): Promise<OutreachSendResult> {
  const res = await fetch(apiUrl("/api/admin/outreach"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data: { error?: string } & Partial<OutreachSendResult> = {};
  try {
    data = (await res.json()) as { error?: string } & Partial<OutreachSendResult>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  }
  return {
    ok: data.ok === true,
    sent: data.sent ?? 0,
    failed: data.failed ?? 0,
    results: data.results ?? [],
  };
}
