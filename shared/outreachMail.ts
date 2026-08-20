/** Cold-outreach CSV merge + branded email HTML (admin / Resend). */

import { FONT_BODY, FONT_DISPLAY, FONT_UI, PLATFORM_CONTACT_EMAIL, PLATFORM_FONTS_HREF } from "./const.js";

export const OUTREACH_MAX_RECIPIENTS = 200;

export const OUTREACH_LOCKUP_URL = "https://www.paystack.ch/brand/paystack-lockup.png";

/** Animated drag-and-drop demo for beta invite emails (GIF; PNG fallback also hosted). */
export const OUTREACH_UPLOAD_DEMO_GIF_URL = "https://www.paystack.ch/outreach/upload-demo.gif";
export const OUTREACH_UPLOAD_DEMO_PNG_URL = "https://www.paystack.ch/outreach/upload-demo.png";

/** Public Google Calendar booking link for beta demos. */
export const OUTREACH_DEMO_CALENDAR_URL = "https://calendar.app.google/gjusbBhAfBKaEh1J6";

/** Verified Resend mailboxes operators can send cold outreach from. */
export const OUTREACH_FROM_MAILBOXES = [
  "lucas@paystack.ch",
  "joshua@paystack.ch",
  "ali@paystack.ch",
] as const;

const PAYSTACK_FROM_EMAIL_RE = /^[a-z0-9._%+-]+@paystack\.ch$/;

/** Pull the address out of `Paystack <lucas@paystack.ch>` or a bare email. */
export function parseOutreachFromAddress(raw: string | undefined | null): {
  email: string;
  name: string;
} | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angled = trimmed.match(/^(.*?)<([^>]+)>\s*$/);
  const email = (angled ? angled[2] : trimmed).trim().toLowerCase();
  const name = (angled ? angled[1] : "").trim().replace(/^["']|["']$/g, "");
  if (!PAYSTACK_FROM_EMAIL_RE.test(email)) return null;
  return { email, name };
}

export function formatOutreachFromHeader(email: string, fromName?: string): string {
  const name = (fromName?.trim() || "Paystack").replace(/[<>\r\n]/g, "");
  return `${name} <${email}>`;
}

/** Require @paystack.ch. Empty falls back to Lucas. */
export function resolveOutreachFromHeader(raw: string | undefined, fromName?: string): string {
  const parsed = parseOutreachFromAddress(raw);
  if (raw?.trim() && !parsed) {
    throw Object.assign(
      new Error("From address must be a verified @paystack.ch mailbox."),
      { status: 400 }
    );
  }
  const email = parsed?.email || PLATFORM_CONTACT_EMAIL;
  const name = parsed?.name || fromName || "Paystack";
  return formatOutreachFromHeader(email, name);
}

export type OutreachRecipient = {
  name: string;
  email: string;
  company: string;
  extra: string;
  fields: Record<string, string>;
};

export type OutreachParseResult = {
  recipients: OutreachRecipient[];
  skipped: Array<{ row: number; reason: string }>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidOutreachEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function headerKind(h: string): "name" | "email" | "company" | "extra" | "other" {
  const n = normHeader(h);
  if (["name", "first_name", "firstname", "full_name", "fullname", "prenom", "prénom"].includes(n)) {
    return "name";
  }
  if (["email", "e_mail", "mail", "e_mail_address", "email_address"].includes(n)) return "email";
  if (
    ["company", "company_name", "business", "business_name", "societe", "société", "entreprise"].includes(
      n
    )
  ) {
    return "company";
  }
  if (["extra", "notes", "note", "comment", "comments", "other"].includes(n)) return "extra";
  return "other";
}

/** RFC 4180-ish CSV split that keeps quoted commas. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function parseOutreachCsv(text: string): OutreachParseResult {
  const rows = parseCsvRows(text);
  const recipients: OutreachRecipient[] = [];
  const skipped: OutreachParseResult["skipped"] = [];
  if (rows.length === 0) return { recipients, skipped };

  const headers = rows[0].map((h) => h.trim());
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const fields: Record<string, string> = {};
    let name = "";
    let email = "";
    let company = "";
    const extraParts: string[] = [];

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c] || `col_${c + 1}`;
      const value = (cols[c] ?? "").trim();
      fields[normHeader(header)] = value;
      fields[header] = value;
      const kind = headerKind(header);
      if (kind === "name" && !name) name = value;
      else if (kind === "email" && !email) email = value;
      else if (kind === "company" && !company) company = value;
      else if (kind === "extra" && value) extraParts.push(value);
      else if (kind === "other" && value) extraParts.push(`${header}: ${value}`);
    }

    const extra = extraParts.join(" · ");
    const emailNorm = email.trim().toLowerCase();
    if (!isValidOutreachEmail(emailNorm)) {
      skipped.push({ row: r + 1, reason: email ? `Invalid email (${email})` : "Missing email" });
      continue;
    }
    if (seen.has(emailNorm)) {
      skipped.push({ row: r + 1, reason: `Duplicate ${emailNorm}` });
      continue;
    }
    seen.add(emailNorm);
    recipients.push({
      name: name || emailNorm.split("@")[0] || "",
      email: emailNorm,
      company,
      extra,
      fields: {
        ...fields,
        name,
        first_name: name,
        email: emailNorm,
        company,
        extra,
      },
    });
  }

  return { recipients, skipped };
}

export function mergeOutreachTemplate(
  template: string,
  recipient: OutreachRecipient,
  extras?: { sender?: string }
): string {
  const sender = extras?.sender?.trim() || "";
  const map: Record<string, string> = {
    name: recipient.name,
    first_name: recipient.name,
    firstname: recipient.name,
    email: recipient.email,
    company: recipient.company,
    business: recipient.company,
    extra: recipient.extra,
    sender,
    your_name: sender,
    ...recipient.fields,
  };

  let out = template.replace(/\{\{\s*([a-zA-Z0-9_ -]+)\s*\}\}/g, (_, raw: string) => {
    const key = normHeader(raw);
    return map[key] ?? map[raw.trim()] ?? "";
  });

  out = out.replace(/\[First name\]/gi, recipient.name);
  out = out.replace(/\[Business name\]/gi, recipient.company);
  out = out.replace(/\[Your name\]/gi, sender);
  return out;
}

export function isFullHtmlDocument(body: string): boolean {
  return /<!DOCTYPE\s+html/i.test(body) || /<html[\s>]/i.test(body);
}

function letterParagraphsFromPlain(text: string): string {
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length === 0) return "";
  return blocks
    .map((block) => {
      const html = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:16px;line-height:1.7;color:#2B2B2B;">${html}</p>`;
    })
    .join("\n");
}

const CTA_HREF_DEFAULT = `mailto:${PLATFORM_CONTACT_EMAIL}?subject=Paystack%20beta`;

function ctaBlock(opts: {
  ctaHref: string;
  ctaLabel: string;
  ctaHint?: string;
}): string {
  return `
          <tr>
            <td align="center" style="padding:28px 48px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#E8423F" style="background-color:#E8423F;">
                    <a href="${escapeHtml(opts.ctaHref)}" style="display:inline-block;padding:13px 26px;font-family:${FONT_DISPLAY};font-size:13px;letter-spacing:0.4px;font-weight:700;color:#FFFFFF;text-decoration:none;">
                      ${escapeHtml(opts.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
              ${
                opts.ctaHint
                  ? `<p style="margin:14px 0 0;font-family:${FONT_UI};font-size:12px;line-height:18px;color:#6F6669;">${opts.ctaHint}</p>`
                  : ""
              }
            </td>
          </tr>`;
}

function langDivider(label: string): string {
  return `
          <tr>
            <td style="padding:32px 48px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #E8E2E0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:18px 0 0;font-family:${FONT_UI};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#E8423F;text-align:center;">${escapeHtml(label)}</p>
            </td>
          </tr>`;
}

export function wrapBrandedLetterHtml(opts: {
  preheader?: string;
  title: string;
  /** English body HTML (paragraphs). */
  innerHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaHint?: string;
  frenchLabel?: string;
  frenchTitle?: string;
  frenchInnerHtml?: string;
  frenchCtaLabel?: string;
  frenchCtaHint?: string;
  /** When true, French block comes first (Geneva SME default). */
  frenchFirst?: boolean;
  englishLabel?: string;
  /** Optional product demo image under the logo (GIF preferred). */
  demoImageUrl?: string;
  demoImageAlt?: string;
  demoImageWidth?: number;
  signoffHtml?: string;
}): string {
  const ctaHref = opts.ctaHref || CTA_HREF_DEFAULT;
  const ctaLabel = opts.ctaLabel || "Reply";
  const signoff =
    opts.signoffHtml ||
    `Best regards,<br>
                The Paystack.ch team`;
  const hasFrench = Boolean(opts.frenchInnerHtml?.trim());
  const frenchFirst = opts.frenchFirst === true && hasFrench;
  const demoWidth = opts.demoImageWidth ?? 504;
  const demoBlock = opts.demoImageUrl
    ? `
          <tr>
            <td align="center" style="padding:0 48px 24px;">
              <img src="${escapeHtml(opts.demoImageUrl)}" width="${demoWidth}" alt="${escapeHtml(opts.demoImageAlt || "Paystack product demo")}" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0;border-radius:8px;">
            </td>
          </tr>`
    : "";

  const enTitle = escapeHtml(opts.title);
  const frTitle = escapeHtml(opts.frenchTitle || opts.title);
  const enSection = `
          <tr>
            <td style="padding:0 48px 8px;">
              <p style="margin:0 0 22px;font-family:${FONT_DISPLAY};font-size:22px;line-height:30px;font-weight:600;color:#2B2B2B;text-align:center;">
                ${enTitle}
              </p>
              ${opts.innerHtml}
            </td>
          </tr>
          ${ctaBlock({ ctaHref, ctaLabel, ctaHint: opts.ctaHint })}`;

  const frSection = hasFrench
    ? `
          <tr>
            <td style="padding:${frenchFirst ? "0" : "8px"} 48px 8px;">
              <p style="margin:0 0 22px;font-family:${FONT_DISPLAY};font-size:22px;line-height:30px;font-weight:600;color:#2B2B2B;text-align:center;">
                ${frTitle}
              </p>
              ${opts.frenchInnerHtml}
            </td>
          </tr>
          ${
            opts.frenchCtaLabel
              ? ctaBlock({
                  ctaHref,
                  ctaLabel: opts.frenchCtaLabel,
                  ctaHint: opts.frenchCtaHint,
                })
              : ""
          }`
    : "";

  const bilingualBody = frenchFirst
    ? `${frSection}
          ${langDivider(opts.englishLabel || "English")}
          ${enSection.replace('padding:0 48px 8px;', 'padding:8px 48px 8px;')}`
    : `${enSection}
          ${hasFrench ? langDivider(opts.frenchLabel || "Français") : ""}
          ${frSection}`;

  return `<!DOCTYPE html>
<html lang="${frenchFirst ? "fr" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${enTitle}</title>
  <link rel="stylesheet" href="${PLATFORM_FONTS_HREF}">
</head>
<body style="margin:0;padding:0;background-color:#FFF5F4;" bgcolor="#FFF5F4">
  ${
    opts.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFF5F4;" bgcolor="#FFF5F4">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E8E2E0;" bgcolor="#FFFFFF">
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background-color:#E8423F;" bgcolor="#E8423F">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:40px 48px ${demoBlock ? "20px" : "28px"};">
              <img src="${OUTREACH_LOCKUP_URL}" width="200" alt="Paystack.ch" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;">
            </td>
          </tr>
          ${demoBlock}
          ${bilingualBody}
          <tr>
            <td style="padding:36px 48px 40px;border-top:1px solid #E8E2E0;">
              <p style="margin:0 0 6px;font-family:${FONT_BODY};font-size:15px;line-height:22px;color:#2B2B2B;">
                ${signoff}
              </p>
              <p style="margin:12px 0 0;font-family:${FONT_UI};font-size:12px;line-height:18px;color:#6F6669;">
                Geneva, Switzerland<br>
                <a href="mailto:${PLATFORM_CONTACT_EMAIL}" style="color:#E8423F;text-decoration:none;">${PLATFORM_CONTACT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderOutreachHtml(opts: {
  mode: "html" | "text";
  body: string;
  recipient: OutreachRecipient;
  sender?: string;
  title?: string;
}): { html: string; text: string } {
  const merged = mergeOutreachTemplate(opts.body, opts.recipient, { sender: opts.sender });
  if (opts.mode === "html") {
    if (isFullHtmlDocument(merged)) {
      return { html: merged, text: stripHtmlToText(merged) };
    }
    const html = wrapBrandedLetterHtml({
      title: opts.title || "Paystack.ch",
      innerHtml: merged,
      ctaLabel: "Reply",
      ctaHref: `mailto:${PLATFORM_CONTACT_EMAIL}`,
      ctaHint: `<a href="https://www.paystack.ch" style="color:#E8423F;text-decoration:none;">www.paystack.ch</a>`,
    });
    return { html, text: stripHtmlToText(merged) };
  }
  const html = wrapBrandedLetterHtml({
    title: opts.title || "Paystack.ch",
    innerHtml: letterParagraphsFromPlain(merged),
    ctaLabel: "Reply",
    ctaHref: `mailto:${PLATFORM_CONTACT_EMAIL}`,
    ctaHint: `Or reply to this email · <a href="https://www.paystack.ch" style="color:#E8423F;text-decoration:none;">www.paystack.ch</a>`,
  });
  return { html, text: merged };
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const SAMPLE_OUTREACH_CSV = `name,email,company,extra
Joshua,joshua@the-leadlab.com,The Leadlab,Geneva
`;
