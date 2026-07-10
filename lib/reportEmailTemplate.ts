import { BRAND_COLORS, resolveBrandLogoUrl } from "../shared/brandAssets.js";

export type ReportEmailTemplateData = {
  locale: "en" | "fr";
  periodLabel: string;
  sessionName: string;
  dateFrom: string;
  dateTo: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtChf(n: number): string {
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COPY = {
  en: {
    greeting: "Hello,",
    intro: (period: string, session: string) =>
      `Your <strong>${period}</strong> for <strong>${session}</strong> is attached as a PDF.`,
    period: "Period",
    income: "Income",
    expenses: "Expenses",
    balance: "Balance",
    attachment: "Open the PDF attachment for the full transaction list.",
    cta: "Open Paystack",
    footer: "Swiss hospitality financial management",
  },
  fr: {
    greeting: "Bonjour,",
    intro: (period: string, session: string) =>
      `Votre <strong>${period}</strong> pour <strong>${session}</strong> est en pièce jointe (PDF).`,
    period: "Période",
    income: "Revenus",
    expenses: "Dépenses",
    balance: "Solde",
    attachment: "Ouvrez la pièce jointe PDF pour la liste complète des transactions.",
    cta: "Ouvrir Paystack",
    footer: "Gestion financière pour l'hôtellerie suisse",
  },
} as const;

function metricCell(label: string, value: string, accent = false): string {
  const valueColor = accent ? BRAND_COLORS.red : BRAND_COLORS.charcoal;
  return `
    <td style="width:33.33%;padding:12px 10px;background:${BRAND_COLORS.white};border:1px solid ${BRAND_COLORS.border};border-radius:8px;text-align:center;">
      <div style="font-size:11px;line-height:16px;color:${BRAND_COLORS.muted};text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</div>
      <div style="margin-top:6px;font-size:18px;line-height:24px;font-weight:700;color:${valueColor};font-family:Arial,Helvetica,sans-serif;">CHF ${escapeHtml(value)}</div>
    </td>`;
}

/** Branded HTML body for Resend financial report emails (table layout for client compatibility). */
export function buildReportEmailHtml(data: ReportEmailTemplateData): string {
  const t = COPY[data.locale];
  const period = escapeHtml(data.periodLabel);
  const session = escapeHtml(data.sessionName);
  const logoUrl = resolveBrandLogoUrl();
  const appUrl = (process.env.PUBLIC_APP_URL || "https://www.paystack.ch").trim().replace(/\/$/, "");

  return `<!DOCTYPE html>
<html lang="${data.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Paystack Report</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_COLORS.cream};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_COLORS.cream};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${BRAND_COLORS.white};border:1px solid ${BRAND_COLORS.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:${BRAND_COLORS.red};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 20px;text-align:center;">
              <img src="${logoUrl}" width="64" height="64" alt="Paystack.ch" style="display:block;margin:0 auto 12px;border:0;" />
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;font-weight:700;color:${BRAND_COLORS.charcoal};">
                paystack<span style="color:${BRAND_COLORS.red};">.ch</span>
              </div>
              <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND_COLORS.muted};letter-spacing:0.12em;text-transform:uppercase;">
                Financial Report
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${BRAND_COLORS.charcoal};">
              <p style="margin:0 0 12px;">${t.greeting}</p>
              <p style="margin:0 0 16px;">${t.intro(period, session)}</p>
              <p style="margin:0 0 20px;font-size:13px;color:${BRAND_COLORS.muted};">
                ${escapeHtml(t.period)}: ${escapeHtml(data.dateFrom)} → ${escapeHtml(data.dateTo)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  ${metricCell(t.income, fmtChf(data.totalIncome))}
                  <td style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                  ${metricCell(t.expenses, fmtChf(data.totalExpenses))}
                  <td style="width:8px;font-size:0;line-height:0;">&nbsp;</td>
                  ${metricCell(t.balance, fmtChf(data.balance), true)}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND_COLORS.muted};">
              ${escapeHtml(t.attachment)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;text-align:center;">
              <a href="${appUrl}/app" style="display:inline-block;padding:12px 22px;background:${BRAND_COLORS.red};color:${BRAND_COLORS.white};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;">
                ${escapeHtml(t.cta)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid ${BRAND_COLORS.border};text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:${BRAND_COLORS.muted};">
              <a href="${appUrl}" style="color:${BRAND_COLORS.red};text-decoration:none;font-weight:600;">paystack.ch</a>
              · ${escapeHtml(t.footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
