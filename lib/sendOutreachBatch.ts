import { sendResendEmail } from "./resendEmail.js";
import {
  OUTREACH_MAX_RECIPIENTS,
  isValidOutreachEmail,
  mergeOutreachTemplate,
  renderOutreachHtml,
  type OutreachRecipient,
} from "../shared/outreachMail.js";

export type OutreachSendItemResult = {
  email: string;
  ok: boolean;
  error?: string;
};

export async function sendOutreachBatch(opts: {
  subject: string;
  mode: "html" | "text";
  body: string;
  sender?: string;
  replyTo?: string;
  recipients: OutreachRecipient[];
}): Promise<{ results: OutreachSendItemResult[] }> {
  if (!opts.subject.trim()) {
    throw Object.assign(new Error("Subject is required."), { status: 400 });
  }
  if (!opts.body.trim()) {
    throw Object.assign(new Error("Email body is required."), { status: 400 });
  }
  if (opts.recipients.length === 0) {
    throw Object.assign(new Error("No recipients."), { status: 400 });
  }
  if (opts.recipients.length > OUTREACH_MAX_RECIPIENTS) {
    throw Object.assign(new Error(`Maximum ${OUTREACH_MAX_RECIPIENTS} recipients per send.`), {
      status: 400,
    });
  }

  const results: OutreachSendItemResult[] = [];
  for (const recipient of opts.recipients) {
    const email = recipient.email?.trim().toLowerCase() || "";
    if (!isValidOutreachEmail(email)) {
      results.push({ email: email || "(missing)", ok: false, error: "Invalid email" });
      continue;
    }
    try {
      const mergedSubject = mergeOutreachTemplate(opts.subject, recipient, { sender: opts.sender });
      const rendered = renderOutreachHtml({
        mode: opts.mode,
        body: opts.body,
        recipient,
        sender: opts.sender,
        title: mergedSubject,
      });
      await sendResendEmail({
        to: [email],
        subject: mergedSubject,
        html: rendered.html,
        text: rendered.text,
        replyTo: opts.replyTo?.trim() || "info@paystack.ch",
      });
      results.push({ email, ok: true });
    } catch (e) {
      results.push({
        email,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { results };
}
