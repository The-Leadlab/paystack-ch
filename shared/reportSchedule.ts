export const REPORT_SCHEDULE_CADENCE_DAYS = [7, 14, 30, 90] as const;

export type ReportScheduleCadenceDays =
  (typeof REPORT_SCHEDULE_CADENCE_DAYS)[number];
export type ReportScheduleLocale = "en" | "fr";

export type ReportSchedule = {
  enabled: boolean;
  cadenceDays: ReportScheduleCadenceDays;
  anchorDate: string;
  lastSentAt?: string;
  locale: ReportScheduleLocale;
};

export function parseReportScheduleCadenceDays(
  raw: unknown
): ReportScheduleCadenceDays | null {
  const value = typeof raw === "number" ? raw : Number(raw);
  return REPORT_SCHEDULE_CADENCE_DAYS.includes(
    value as ReportScheduleCadenceDays
  )
    ? (value as ReportScheduleCadenceDays)
    : null;
}

export function parseReportScheduleLocale(raw: unknown): ReportScheduleLocale {
  return raw === "fr" ? "fr" : "en";
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Inclusive start of the reporting window for a schedule cadence ending on `end` (YYYY-MM-DD).
 * For monthly/quarterly, `end` is expected to be the last day of the completed period. */
export function schedulePeriodStart(
  end: string,
  cadenceDays: ReportScheduleCadenceDays
): string {
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (cadenceDays === 30) {
    return toIsoUtc(new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1)));
  }
  if (cadenceDays === 90) {
    const month = endDate.getUTCMonth();
    const quarterStart = Math.floor(month / 3) * 3;
    return toIsoUtc(new Date(Date.UTC(endDate.getUTCFullYear(), quarterStart, 1)));
  }
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() - (cadenceDays - 1));
  return toIsoUtc(start);
}

/** Inclusive end of the calendar period — for monthly/quarterly the cron end date is already the period end. */
export function schedulePeriodEnd(
  end: string,
  cadenceDays: ReportScheduleCadenceDays
): string {
  if (cadenceDays === 30 || cadenceDays === 90) return end;
  return end;
}

export function schedulePeriodLabel(
  cadenceDays: ReportScheduleCadenceDays,
  locale: ReportScheduleLocale
): string {
  if (cadenceDays === 30) {
    return locale === "fr" ? "Rapport mensuel (mois précédent)" : "Monthly report (previous month)";
  }
  if (cadenceDays === 90) {
    return locale === "fr"
      ? "Rapport trimestriel (trimestre précédent)"
      : "Quarterly report (previous quarter)";
  }
  if (cadenceDays === 14) {
    return locale === "fr" ? "Rapport bihebdomadaire (14 jours)" : "Biweekly report (last 14 days)";
  }
  return locale === "fr" ? "Rapport hebdomadaire (7 jours)" : "Weekly report (last 7 days)";
}

/**
 * Whether a scheduled report is due for `end` (typically yesterday UTC).
 * Monthly fires on month-end; quarterly on quarter-end; weekly/biweekly use rolling days.
 */
export function isScheduleDue(opts: {
  enabled: boolean;
  cadenceDays: ReportScheduleCadenceDays;
  anchorDate: string;
  lastSentAt: string | null;
  end: string;
}): boolean {
  if (!opts.enabled || !isIsoDate(opts.anchorDate) || !isIsoDate(opts.end)) return false;
  const endDate = new Date(`${opts.end}T00:00:00.000Z`);
  const nextDay = new Date(endDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const isCalendarMonthEnd = nextDay.getUTCDate() === 1;

  if (opts.cadenceDays === 30) {
    if (!isCalendarMonthEnd) return false;
    if (opts.lastSentAt && opts.lastSentAt >= opts.end) return false;
    return opts.end >= opts.anchorDate;
  }

  if (opts.cadenceDays === 90) {
    const month = endDate.getUTCMonth(); // 0-11; quarter ends Mar/Jun/Sep/Dec
    const isQuarterEnd = isCalendarMonthEnd && [2, 5, 8, 11].includes(month);
    if (!isQuarterEnd) return false;
    if (opts.lastSentAt && opts.lastSentAt >= opts.end) return false;
    return opts.end >= opts.anchorDate;
  }

  const baseline = opts.lastSentAt || opts.anchorDate;
  const days = Math.floor(
    (endDate.getTime() - new Date(`${baseline}T00:00:00.000Z`).getTime()) / 86_400_000
  );
  if (opts.lastSentAt) return days >= opts.cadenceDays;
  return days >= opts.cadenceDays - 1;
}
