import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stripeCorsApplyHeaders } from "../lib/stripeCors.js";
import { verifyFirebaseUser } from "../../lib/verifyFirebaseIdToken.js";
import { resolveReportPeriod, type ReportEmailCadence } from "../../shared/reportPeriod.js";
import { buildServerFinancialReportHtml } from "../../lib/buildServerFinancialReport.js";
import { buildReportEmailHtml } from "../../lib/reportEmailTemplate.js";
import { sendReportEmail } from "../../lib/resendReports.js";
import { ensureFirebaseAdmin } from "../../lib/firebaseAdmin.js";
import { getFirestore } from "firebase-admin/firestore";

type IncomeRow = {
  date: string;
  amount: number;
  vat_amount?: number;
  description?: string;
  type?: string;
  account_code?: string;
};

type ExpenseRow = {
  date: string;
  amount: number;
  vat_amount?: number;
  description?: string;
  category?: string;
  account_code?: string;
};

type Body = {
  cadence?: ReportEmailCadence;
  sessionName?: string;
  locale?: "en" | "fr";
  includeLedger?: boolean;
  income?: IncomeRow[];
  expenses?: ExpenseRow[];
};

const CADENCES: ReportEmailCadence[] = ["weekly", "biweekly", "monthly", "annual"];

function filterByRange<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((r) => r.date >= from && r.date <= to);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  stripeCorsApplyHeaders(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const auth = await verifyFirebaseUser(token);
    ensureFirebaseAdmin();
    const email = auth.email?.trim();
    if (!email) {
      res.status(400).json({ error: "No email on Firebase account." });
      return;
    }

    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Body;
    const cadence = body.cadence;
    if (!cadence || !CADENCES.includes(cadence)) {
      res.status(400).json({ error: "Invalid cadence. Use weekly, biweekly, monthly, or annual." });
      return;
    }

    const period = resolveReportPeriod(cadence);
    const locale = body.locale === "fr" ? "fr" : "en";
    const periodLabel = locale === "fr" ? period.labelFr : period.labelEn;
    const sessionName = body.sessionName?.trim() || (locale === "fr" ? "Toutes les sessions" : "All sessions");

    const income = filterByRange(body.income ?? [], period.from, period.to);
    const expenses = filterByRange(body.expenses ?? [], period.from, period.to);

    const totalIncome = income.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);

    let includeLedger = body.includeLedger === true;
    if (body.includeLedger === undefined) {
      const userDoc = await getFirestore().collection("users").doc(auth.uid).get();
      includeLedger = userDoc.data()?.revenueLedgerEnabled === true;
    }

    const reportHtml = buildServerFinancialReportHtml({
      income: income.map((r) => ({
        date: r.date,
        amount: Number(r.amount || 0),
        vat_amount: Number(r.vat_amount || 0),
        description: r.description,
        type: r.type,
        account_code: r.account_code,
      })),
      expenses: expenses.map((r) => ({
        date: r.date,
        amount: Number(r.amount || 0),
        vat_amount: Number(r.vat_amount || 0),
        description: r.description,
        category: r.category,
        account_code: r.account_code,
      })),
      dateFrom: period.from,
      dateTo: period.to,
      sessionName,
      locale,
      includeLedger,
    });

    const subject =
      locale === "fr"
        ? `Paystack — ${periodLabel} (${period.from} → ${period.to})`
        : `Paystack — ${periodLabel} (${period.from} → ${period.to})`;

    const html = buildReportEmailHtml({
      locale,
      periodLabel,
      sessionName,
      dateFrom: period.from,
      dateTo: period.to,
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
    });

    const reportFilename = `paystack-financial-report-${cadence}-${period.to}.html`;

    await sendReportEmail({ to: email, subject, html, reportHtml, reportFilename });

    res.status(200).json({ ok: true, sentTo: email, cadence, period });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api] reports/email:", message);
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    }
  }
}
