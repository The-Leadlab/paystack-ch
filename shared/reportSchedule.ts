export const REPORT_SCHEDULE_CADENCE_DAYS = [7, 14, 30] as const;

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
