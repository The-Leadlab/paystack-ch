type ResendAttachment = {
  filename: string;
  content: string;
};

export type ReportEmailAttachment = {
  filename: string;
  /** UTF-8 text or binary Buffer / Uint8Array */
  content: string | Buffer | Uint8Array;
};

function toBase64(content: string | Buffer | Uint8Array): string {
  if (typeof content === "string") {
    return Buffer.from(content, "utf8").toString("base64");
  }
  return Buffer.from(content).toString("base64");
}

export async function sendReportEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** @deprecated Prefer `attachments` — kept for callers that only send HTML */
  reportHtml?: string;
  reportFilename?: string;
  /** Full list of attachments (PDF/HTML report + Excel, etc.) */
  attachments?: ReportEmailAttachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error("RESEND_API_KEY is not configured on the server."), { status: 503 });
  }

  const from =
    process.env.REPORT_EMAIL_FROM?.trim() || "Paystack Reports <reports@paystack.ch>";

  const attachments: ResendAttachment[] = [];
  if (Array.isArray(opts.attachments) && opts.attachments.length > 0) {
    for (const a of opts.attachments) {
      if (!a?.filename) continue;
      attachments.push({
        filename: a.filename,
        content: toBase64(a.content),
      });
    }
  } else if (opts.reportHtml && opts.reportFilename) {
    attachments.push({
      filename: opts.reportFilename,
      content: Buffer.from(opts.reportHtml, "utf8").toString("base64"),
    });
  }

  if (attachments.length === 0) {
    throw Object.assign(new Error("Report email requires at least one attachment."), { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      attachments,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Resend API error (${res.status}): ${body.slice(0, 200)}`), {
      status: 502,
    });
  }
}
