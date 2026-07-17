export type ReportEmailCadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

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

/** One-shot email periods. Monthly/quarterly use the *previous* completed calendar period. */
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
    // Previous calendar month
    const firstOfThisMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const lastOfPrev = new Date(firstOfThisMonth);
    lastOfPrev.setDate(0);
    const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
    return {
      cadence,
      from: toIso(firstOfPrev),
      to: toIso(lastOfPrev),
      labelEn: "Monthly report (previous month)",
      labelFr: "Rapport mensuel (mois précédent)",
    };
  }

  if (cadence === "quarterly") {
    const month = end.getMonth();
    const currentQuarterStart = Math.floor(month / 3) * 3;
    const firstOfCurrentQuarter = new Date(end.getFullYear(), currentQuarterStart, 1);
    const lastOfPrevQuarter = new Date(firstOfCurrentQuarter);
    lastOfPrevQuarter.setDate(0);
    const prevQuarterStartMonth = lastOfPrevQuarter.getMonth() - (lastOfPrevQuarter.getMonth() % 3);
    const firstOfPrevQuarter = new Date(lastOfPrevQuarter.getFullYear(), prevQuarterStartMonth, 1);
    return {
      cadence,
      from: toIso(firstOfPrevQuarter),
      to: toIso(lastOfPrevQuarter),
      labelEn: "Quarterly report (previous quarter)",
      labelFr: "Rapport trimestriel (trimestre précédent)",
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
