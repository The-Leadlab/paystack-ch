type ResendAttachment = {
  filename: string;
  content: string;
};

export async function sendReportEmail(opts: {
  to: string;
  subject: string;
  html: string;
  reportHtml: string;
  reportFilename: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error("RESEND_API_KEY is not configured on the server."), { status: 503 });
  }

  const from =
    process.env.REPORT_EMAIL_FROM?.trim() || "Paystack Reports <reports@paystack.ch>";

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
      attachments: [
        {
          filename: opts.reportFilename,
          content: Buffer.from(opts.reportHtml, "utf8").toString("base64"),
        } satisfies ResendAttachment,
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Resend API error (${res.status}): ${body.slice(0, 200)}`), {
      status: 502,
    });
  }
}
