#!/usr/bin/env node
/**
 * Send the two bilingual outreach HTML emails via Resend.
 * Usage: RESEND_API_KEY=re_... node scripts/send-outreach-resend.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const to = process.env.OUTREACH_TO?.trim() || "joshua@the-leadlab.com";
const from =
  process.env.NEW_USER_NOTIFY_FROM?.trim() ||
  process.env.REPORT_EMAIL_FROM?.trim() ||
  "Lucas | Paystack <lucas@paystack.ch>";
const apiKey = process.env.RESEND_API_KEY?.trim();

const emails = [
  {
    subject: "You've been chosen / Vous avez été choisi",
    file: "docs/outreach/send/joshua-invite.html",
  },
  {
    subject: "You are one of 200 beta testers / Vous faites partie des 200 testeurs",
    file: "docs/outreach/send/joshua-direct.html",
  },
];

async function sendOne({ subject, file }) {
  const html = await readFile(path.join(root, file), "utf8");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: ["lucas@paystack.ch"],
      subject,
      html,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${file}: Resend ${res.status} ${body.slice(0, 400)}`);
  }
  console.log(`Sent: ${subject}\n  ${body}`);
}

if (!apiKey) {
  console.error("RESEND_API_KEY is not set in this environment. HTML is ready; cannot send.");
  process.exit(2);
}

for (const email of emails) {
  await sendOne(email);
}
