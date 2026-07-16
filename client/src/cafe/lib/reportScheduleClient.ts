import type {
  ReportSchedule,
  ReportScheduleCadenceDays,
} from "@shared/reportSchedule";
import { auth } from "./firebase";

export type ReportScheduleInput = {
  enabled: boolean;
  cadenceDays: ReportScheduleCadenceDays;
  anchorDate: string;
  locale: "en" | "fr";
};

async function authorizationHeaders(): Promise<HeadersInit> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in to schedule reports.");
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse(
  response: Response
): Promise<{ schedule: ReportSchedule | null }> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    schedule?: ReportSchedule | null;
  };
  if (!response.ok)
    throw new Error(
      body.error || `Could not save report schedule (${response.status})`
    );
  return { schedule: body.schedule ?? null };
}

export async function loadReportSchedule(): Promise<ReportSchedule | null> {
  const response = await fetch("/api/reports/schedule", {
    headers: await authorizationHeaders(),
  });
  return (await parseResponse(response)).schedule;
}

export async function saveReportSchedule(
  input: ReportScheduleInput
): Promise<ReportSchedule> {
  const response = await fetch("/api/reports/schedule", {
    method: "POST",
    headers: await authorizationHeaders(),
    body: JSON.stringify(input),
  });
  const schedule = (await parseResponse(response)).schedule;
  if (!schedule)
    throw new Error("Report schedule saved but no schedule was returned.");
  return schedule;
}
