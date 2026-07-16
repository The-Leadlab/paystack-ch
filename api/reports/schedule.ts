import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "firebase-admin/firestore";
import { stripeCorsApplyHeaders } from "../lib/stripeCors.js";
import { ensureFirebaseAdmin } from "../../lib/firebaseAdmin.js";
import { verifyFirebaseUser } from "../../lib/verifyFirebaseIdToken.js";
import {
  isIsoDate,
  parseReportScheduleCadenceDays,
  parseReportScheduleLocale,
  type ReportSchedule,
} from "../../shared/reportSchedule.js";

type ScheduleBody = {
  enabled?: unknown;
  cadenceDays?: unknown;
  anchorDate?: unknown;
  locale?: unknown;
};

function readBearerToken(req: VercelRequest): string | null {
  return (
    req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null
  );
}

function toSchedule(raw: unknown): ReportSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const cadenceDays = parseReportScheduleCadenceDays(value.cadenceDays);
  if (
    typeof value.enabled !== "boolean" ||
    !cadenceDays ||
    !isIsoDate(value.anchorDate)
  )
    return null;
  return {
    enabled: value.enabled,
    cadenceDays,
    anchorDate: value.anchorDate,
    ...(typeof value.lastSentAt === "string"
      ? { lastSentAt: value.lastSentAt }
      : {}),
    locale: parseReportScheduleLocale(value.locale),
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  stripeCorsApplyHeaders(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = readBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { uid } = await verifyFirebaseUser(token);
    ensureFirebaseAdmin();
    const userRef = getFirestore().collection("users").doc(uid);

    if (req.method === "GET") {
      const user = await userRef.get();
      res
        .status(200)
        .json({ schedule: toSchedule(user.data()?.reportSchedule) });
      return;
    }

    const body = (
      typeof req.body === "string" ? JSON.parse(req.body) : req.body
    ) as ScheduleBody;
    const cadenceDays = parseReportScheduleCadenceDays(body.cadenceDays);
    if (
      typeof body.enabled !== "boolean" ||
      !cadenceDays ||
      !isIsoDate(body.anchorDate)
    ) {
      res.status(400).json({ error: "Invalid report schedule." });
      return;
    }

    const schedule: Omit<ReportSchedule, "lastSentAt"> = {
      enabled: body.enabled,
      cadenceDays,
      anchorDate: body.anchorDate,
      locale: parseReportScheduleLocale(body.locale),
    };
    await userRef.set({ reportSchedule: schedule }, { merge: true });
    res.status(200).json({ schedule });
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api] reports/schedule:", message);
    res.status(status).json({ error: message });
  }
}
