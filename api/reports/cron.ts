import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin } from "../../lib/firebaseAdmin.js";
import { buildServerFinancialReportHtml } from "../../lib/buildServerFinancialReport.js";
import { buildReportEmailHtml } from "../../lib/reportEmailTemplate.js";
import { sendReportEmail } from "../../lib/resendReports.js";
import {
  isIsoDate,
  isScheduleDue,
  parseReportScheduleCadenceDays,
  parseReportScheduleLocale,
  schedulePeriodEnd,
  schedulePeriodLabel,
  schedulePeriodStart,
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
  accountCode?: unknown;
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
  return schedulePeriodStart(end, cadenceDays);
}

function periodEndForCadence(
  end: string,
  cadenceDays: ReportScheduleCadenceDays
): string {
  return schedulePeriodEnd(end, cadenceDays);
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
  return isScheduleDue({
    enabled: true,
    cadenceDays,
    anchorDate: schedule.anchorDate as string,
    lastSentAt: scheduleLastSentDate(schedule.lastSentAt),
    end,
  });
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
  if (cadenceDays === 90) return "quarterly";
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
  const to = periodEndForCadence(end, cadenceDays);
  const locale = parseReportScheduleLocale(schedule.locale);
  const periodLabel = schedulePeriodLabel(cadenceDays, locale);
  const db = getFirestore();
  const [incomeSnapshot, expenseSnapshot] = await Promise.all([
    db.collection("income").where("restaurantId", "==", uid).get(),
    db.collection("expenses").where("restaurantId", "==", uid).get(),
  ]);

  const income = incomeSnapshot.docs
    .map(entry => entry.data() as ReportRow)
    .filter(
      row => typeof row.date === "string" && row.date >= from && row.date <= to
    );
  const expenses = expenseSnapshot.docs
    .map(entry => entry.data() as ReportRow)
    .filter(
      row => typeof row.date === "string" && row.date >= from && row.date <= to
    );
  const totalIncome = income.reduce(
    (sum, row) => sum + valueAsNumber(row.amount),
    0
  );
  const totalExpenses = expenses.reduce(
    (sum, row) => sum + valueAsNumber(row.amount),
    0
  );
  const userDoc = await db.collection("users").doc(uid).get();
  const includeLedger = userDoc.data()?.revenueLedgerEnabled === true;
  const cadence = reportCadence(cadenceDays);
  const reportHtml = buildServerFinancialReportHtml({
    income: income.map((row) => ({
      date: row.date as string,
      amount: valueAsNumber(row.amount),
      vat_amount: valueAsNumber(row.vatAmount),
      description: valueAsString(row.description),
      type: valueAsString(row.type),
      account_code: valueAsString(row.accountCode),
    })),
    expenses: expenses.map((row) => ({
      date: row.date as string,
      amount: valueAsNumber(row.amount),
      vat_amount: valueAsNumber(row.vatAmount),
      description: valueAsString(row.description),
      category: valueAsString(row.category),
      account_code: valueAsString(row.accountCode),
    })),
    dateFrom: from,
    dateTo: to,
    sessionName: locale === "fr" ? "Toutes les sessions" : "All sessions",
    locale,
    includeLedger,
  });
  const html = buildReportEmailHtml({
    locale,
    periodLabel,
    sessionName: locale === "fr" ? "Toutes les sessions" : "All sessions",
    dateFrom: from,
    dateTo: to,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
  });
  await sendReportEmail({
    to: email,
    subject: `Paystack — ${periodLabel} (${from} → ${to})`,
    html,
    reportHtml,
    reportFilename: `paystack-financial-report-${cadence}-${to}.html`,
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
