/**
 * Minimal Resend send helper (reports, admin alerts, etc.).
 */
export async function sendResendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error("RESEND_API_KEY is not configured on the server."), { status: 503 });
  }

  const recipients = opts.to.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (recipients.length === 0) {
    throw Object.assign(new Error("No email recipients."), { status: 400 });
  }

  const from =
    opts.from?.trim() ||
    process.env.NEW_USER_NOTIFY_FROM?.trim() ||
    process.env.REPORT_EMAIL_FROM?.trim() ||
    "Paystack <notifications@paystack.ch>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text?.trim() ? { text: opts.text } : {}),
      ...(opts.replyTo
        ? { reply_to: Array.isArray(opts.replyTo) ? opts.replyTo : [opts.replyTo] }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Resend API error (${res.status}): ${body.slice(0, 200)}`), {
      status: 502,
    });
  }
}
