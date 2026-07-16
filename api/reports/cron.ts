import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin } from "../../lib/firebaseAdmin.js";
import {
  buildReportPdfBuffer,
  type ReportPdfLine,
} from "../../lib/reportEmailPdf.js";
import { buildReportEmailHtml } from "../../lib/reportEmailTemplate.js";
import { sendReportEmail } from "../../lib/resendReports.js";
import {
  isIsoDate,
  parseReportScheduleCadenceDays,
  parseReportScheduleLocale,
  type ReportScheduleCadenceDays,
} from "../../shared/reportSchedule.js";
import type { ReportEmailCadence } from "../../shared/reportPeriod.js";

type ReportRow = {
  date?: unknown;
  amount?: unknown;
  vatAmount?: unknown;
  description?: unknown;
  type?: unknown;
  category?: unknown;
};

type StoredSchedule = {
  enabled?: unknown;
  cadenceDays?: unknown;
  anchorDate?: unknown;
  lastSentAt?: unknown;
  locale?: unknown;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000
  );
}

function yesterdayIso(now = new Date()): string {
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
  );
  return isoDate(yesterday);
}

function periodStart(
  end: string,
  cadenceDays: ReportScheduleCadenceDays
): string {
  const date = dayStart(end);
  date.setUTCDate(date.getUTCDate() - (cadenceDays - 1));
  return isoDate(date);
}

function scheduleLastSentDate(lastSentAt: unknown): string | null {
  if (typeof lastSentAt === "string") {
    const parsed = new Date(lastSentAt);
    return Number.isNaN(parsed.getTime()) ? null : isoDate(parsed);
  }
  if (
    lastSentAt &&
    typeof (lastSentAt as { toDate?: unknown }).toDate === "function"
  ) {
    return isoDate((lastSentAt as { toDate: () => Date }).toDate());
  }
  return null;
}

function isDue(
  schedule: StoredSchedule,
  end: string
): schedule is Required<
  Pick<StoredSchedule, "enabled" | "cadenceDays" | "anchorDate">
> &
  StoredSchedule {
  const cadenceDays = parseReportScheduleCadenceDays(schedule.cadenceDays);
  if (
    schedule.enabled !== true ||
    !cadenceDays ||
    !isIsoDate(schedule.anchorDate)
  )
    return false;
  const lastSent = scheduleLastSentDate(schedule.lastSentAt);
  if (lastSent) return daysBetween(lastSent, end) >= cadenceDays;
  return daysBetween(schedule.anchorDate, end) >= cadenceDays - 1;
}

function cronIsAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authorization = req.headers.authorization?.trim();
  const headerSecret =
    typeof req.headers.cron_secret === "string"
      ? req.headers.cron_secret
      : undefined;
  const received =
    authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    headerSecret?.trim();
  if (!received) return false;
  const expectedBuffer = Buffer.from(secret);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function valueAsString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function valueAsNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function reportCadence(
  cadenceDays: ReportScheduleCadenceDays
): ReportEmailCadence {
  if (cadenceDays === 7) return "weekly";
  if (cadenceDays === 14) return "biweekly";
  return "monthly";
}

async function sendScheduledReport(
  uid: string,
  email: string,
  schedule: StoredSchedule,
  end: string
): Promise<void> {
  const cadenceDays = parseReportScheduleCadenceDays(schedule.cadenceDays);
  if (!cadenceDays || !isIsoDate(schedule.anchorDate)) return;
  const from = periodStart(end, cadenceDays);
  const locale = parseReportScheduleLocale(schedule.locale);
  const periodLabel =
    locale === "fr"
      ? `Rapport des ${cadenceDays} derniers jours`
      : `Report for the last ${cadenceDays} days`;
  const db = getFirestore();
  const [incomeSnapshot, expenseSnapshot] = await Promise.all([
    db.collection("income").where("restaurantId", "==", uid).get(),
    db.collection("expenses").where("restaurantId", "==", uid).get(),
  ]);

  const income = incomeSnapshot.docs
    .map(entry => entry.data() as ReportRow)
    .filter(
      row => typeof row.date === "string" && row.date >= from && row.date <= end
    );
  const expenses = expenseSnapshot.docs
    .map(entry => entry.data() as ReportRow)
    .filter(
      row => typeof row.date === "string" && row.date >= from && row.date <= end
    );
  const totalIncome = income.reduce(
    (sum, row) => sum + valueAsNumber(row.amount),
    0
  );
  const totalExpenses = expenses.reduce(
    (sum, row) => sum + valueAsNumber(row.amount),
    0
  );
  const vatReceived = income.reduce(
    (sum, row) => sum + valueAsNumber(row.vatAmount),
    0
  );
  const vatPaid = expenses.reduce(
    (sum, row) => sum + valueAsNumber(row.vatAmount),
    0
  );
  const lines: ReportPdfLine[] = [
    ...income.map(row => ({
      date: row.date as string,
      label:
        valueAsString(row.description) || valueAsString(row.type) || "Income",
      amount: valueAsNumber(row.amount),
      kind: "income" as const,
    })),
    ...expenses.map(row => ({
      date: row.date as string,
      label:
        valueAsString(row.description) ||
        valueAsString(row.category) ||
        "Expense",
      amount: valueAsNumber(row.amount),
      kind: "expense" as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const cadence = reportCadence(cadenceDays);
  const pdfBuffer = buildReportPdfBuffer({
    cadence,
    periodLabel,
    sessionName: locale === "fr" ? "Toutes les sessions" : "All sessions",
    dateFrom: from,
    dateTo: end,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    vatReceived,
    vatPaid,
    lines,
  });
  const html = buildReportEmailHtml({
    locale,
    periodLabel,
    sessionName: locale === "fr" ? "Toutes les sessions" : "All sessions",
    dateFrom: from,
    dateTo: end,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
  });
  await sendReportEmail({
    to: email,
    subject: `Paystack — ${periodLabel} (${from} → ${end})`,
    html,
    pdfBuffer,
    pdfFilename: `paystack-report-${cadenceDays}-days-${end}.pdf`,
  });
  await db.collection("users").doc(uid).update({
    "reportSchedule.lastSentAt": new Date().toISOString(),
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.CRON_SECRET?.trim()) {
    res.status(503).json({ error: "CRON_SECRET is not configured" });
    return;
  }
  if (!cronIsAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    ensureFirebaseAdmin();
    const db = getFirestore();
    const end = yesterdayIso();
    const scheduledUsers = await db
      .collection("users")
      .where("reportSchedule.enabled", "==", true)
      .get();
    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const user of scheduledUsers.docs) {
      const schedule = (user.data().reportSchedule ?? {}) as StoredSchedule;
      if (!isDue(schedule, end)) {
        skipped += 1;
        continue;
      }
      try {
        const account = await getAuth().getUser(user.id);
        const email = account.email?.trim();
        if (!email) {
          skipped += 1;
          continue;
        }
        await sendScheduledReport(user.id, email, schedule, end);
        sent += 1;
      } catch (error) {
        console.error(`[api] reports/cron failed for ${user.id}:`, error);
        failures.push(user.id);
      }
    }

    res.status(200).json({
      ok: true,
      checked: scheduledUsers.size,
      sent,
      skipped,
      failures,
    });
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api] reports/cron:", message);
    res.status(status).json({ error: message });
  }
}
