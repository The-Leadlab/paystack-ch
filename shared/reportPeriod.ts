export type ReportEmailCadence = "weekly" | "biweekly" | "monthly" | "annual";

export type ReportPeriodRange = {
  cadence: ReportEmailCadence;
  from: string;
  to: string;
  labelEn: string;
  labelFr: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function resolveReportPeriod(cadence: ReportEmailCadence, ref = new Date()): ReportPeriodRange {
  const end = new Date(ref);
  const start = new Date(ref);

  if (cadence === "weekly") {
    start.setDate(end.getDate() - 6);
    return {
      cadence,
      from: toIso(start),
      to: toIso(end),
      labelEn: "Weekly report (last 7 days)",
      labelFr: "Rapport hebdomadaire (7 derniers jours)",
    };
  }

  if (cadence === "biweekly") {
    start.setDate(end.getDate() - 13);
    return {
      cadence,
      from: toIso(start),
      to: toIso(end),
      labelEn: "Biweekly report (last 14 days)",
      labelFr: "Rapport bihebdomadaire (14 derniers jours)",
    };
  }

  if (cadence === "monthly") {
    start.setDate(1);
    return {
      cadence,
      from: toIso(start),
      to: toIso(end),
      labelEn: "Monthly report",
      labelFr: "Rapport mensuel",
    };
  }

  start.setMonth(0, 1);
  return {
    cadence,
    from: toIso(start),
    to: toIso(end),
    labelEn: "Annual report",
    labelFr: "Rapport annuel",
  };
}
