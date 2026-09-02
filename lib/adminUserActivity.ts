/**
 * Admin-only: usage insights for demo / customer-success review.
 * Metadata only — never document body / OCR / line items.
 */
import { getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { tsToIso } from "./adminUsersList.js";

export type AdminActivityEvent = {
  id: string;
  type: string;
  at: string;
  meta: {
    errorCode?: string;
    errorMessage?: string;
    fileName?: string;
    pageCount?: number;
    durationMs?: number;
    fileSizeBytes?: number;
    mimeType?: string;
    sessionId?: string;
    pdfPageSplit?: boolean;
  } | null;
};

export type AdminDocumentSnapshot = {
  id: string;
  fileName: string | null;
  status: string | null;
  error: string | null;
  errorCode: string | null;
  pageCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  sessionId: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
};

export type AdminWorkSession = {
  id: string;
  name: string;
  createdAt: string | null;
  isActive: boolean;
  isPinned: boolean;
  documentCount: number;
  completedCount: number;
  errorCount: number;
  pendingCount: number;
  processingCount: number;
  totalPages: number | null;
  avgDurationMs: number | null;
  errors: Array<{
    fileName: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    at: string | null;
  }>;
};

export type AdminLoginVisit = {
  id: string;
  at: string;
};

export type AdminUsageSummary = {
  loginCount: number;
  lastLoginAt: string | null;
  workSessionCount: number;
  documentCount: number;
  completedCount: number;
  errorCount: number;
  lastWorkSessionId: string | null;
  lastWorkSessionName: string | null;
  lastWorkSessionDocs: number;
  lastWorkSessionErrors: number;
  lastWorkSessionCompleted: number;
};

export type AdminUserUsageInsights = {
  summary: AdminUsageSummary;
  logins: AdminLoginVisit[];
  workSessions: AdminWorkSession[];
  events: AdminActivityEvent[];
  documents: AdminDocumentSnapshot[];
};

function asMeta(raw: unknown): AdminActivityEvent["meta"] {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const out: NonNullable<AdminActivityEvent["meta"]> = {};
  if (typeof m.errorCode === "string") out.errorCode = m.errorCode;
  if (typeof m.errorMessage === "string") out.errorMessage = m.errorMessage;
  if (typeof m.fileName === "string") out.fileName = m.fileName;
  if (typeof m.pageCount === "number") out.pageCount = m.pageCount;
  if (typeof m.durationMs === "number") out.durationMs = m.durationMs;
  if (typeof m.fileSizeBytes === "number") out.fileSizeBytes = m.fileSizeBytes;
  if (typeof m.mimeType === "string") out.mimeType = m.mimeType;
  if (typeof m.sessionId === "string") out.sessionId = m.sessionId;
  if (typeof m.pdfPageSplit === "boolean") out.pdfPageSplit = m.pdfPageSplit;
  return Object.keys(out).length ? out : null;
}

function mapDocument(id: string, data: Record<string, unknown>): AdminDocumentSnapshot {
  return {
    id,
    fileName: typeof data.fileName === "string" ? data.fileName : null,
    status: typeof data.status === "string" ? data.status : null,
    error: typeof data.error === "string" ? data.error.slice(0, 280) : null,
    errorCode: typeof data.errorCode === "string" ? data.errorCode : null,
    pageCount:
      typeof data.pageCount === "number"
        ? data.pageCount
        : typeof data.pdfPageCount === "number"
          ? data.pdfPageCount
          : null,
    createdAt:
      typeof data.created_at === "string"
        ? data.created_at
        : tsToIso(data.created_at) ?? tsToIso(data.createdAt),
    updatedAt:
      typeof data.updated_at === "string"
        ? data.updated_at
        : tsToIso(data.updated_at) ?? tsToIso(data.updatedAt),
    sessionId:
      typeof data.session_id === "string"
        ? data.session_id
        : typeof data.sessionId === "string"
          ? data.sessionId
          : null,
    mimeType: typeof data.mimeType === "string" ? data.mimeType : null,
    fileSizeBytes:
      typeof data.fileSizeBytes === "number"
        ? data.fileSizeBytes
        : typeof data.fileSize === "number"
          ? data.fileSize
          : null,
  };
}

function mapEvent(id: string, data: Record<string, unknown>): AdminActivityEvent {
  return {
    id,
    type: typeof data.type === "string" ? data.type : "unknown",
    at: typeof data.at === "string" ? data.at : tsToIso(data.at) ?? "",
    meta: asMeta(data.meta),
  };
}

async function loadActivityEvents(
  uid: string,
  limit: number,
  errorsOnly?: boolean
): Promise<AdminActivityEvent[]> {
  const db = getFirestore();
  try {
    let q = db.collection("userActivity").where("uid", "==", uid).orderBy("at", "desc").limit(limit);
    if (errorsOnly) {
      q = db
        .collection("userActivity")
        .where("uid", "==", uid)
        .where("type", "==", "document_process_error")
        .orderBy("at", "desc")
        .limit(limit);
    }
    const snap = await q.get();
    return snap.docs.map((d) => mapEvent(d.id, d.data() as Record<string, unknown>));
  } catch {
    const fallback = await db.collection("userActivity").where("uid", "==", uid).limit(400).get();
    return fallback.docs
      .map((d) => mapEvent(d.id, d.data() as Record<string, unknown>))
      .filter((e) => !errorsOnly || e.type === "document_process_error")
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }
}

async function loadDocuments(uid: string, limit = 200): Promise<AdminDocumentSnapshot[]> {
  const db = getFirestore();
  try {
    let snap;
    try {
      snap = await db
        .collection("documents")
        .where("restaurantId", "==", uid)
        .orderBy("created_at", "desc")
        .limit(limit)
        .get();
    } catch {
      snap = await db.collection("documents").where("restaurantId", "==", uid).limit(limit).get();
    }
    return snap.docs
      .map((d) => mapDocument(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  } catch {
    return [];
  }
}

async function loadWorkSessions(uid: string): Promise<
  Array<{
    id: string;
    name: string;
    createdAt: string | null;
    isActive: boolean;
    isPinned: boolean;
  }>
> {
  const db = getFirestore();
  try {
    let snap;
    try {
      snap = await db
        .collection("sessions")
        .where("restaurantId", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
    } catch {
      snap = await db.collection("sessions").where("restaurantId", "==", uid).limit(100).get();
    }
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: typeof data.name === "string" && data.name.trim() ? data.name : "Untitled session",
          createdAt:
            typeof data.created_at === "string"
              ? data.created_at
              : tsToIso(data.createdAt) ?? tsToIso(data.created_at),
          isActive: data.isActive === true || data.is_active === true,
          isPinned: data.isPinned === true || data.is_pinned === true,
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  } catch {
    return [];
  }
}

function buildWorkSessionRollups(
  sessions: Array<{
    id: string;
    name: string;
    createdAt: string | null;
    isActive: boolean;
    isPinned: boolean;
  }>,
  documents: AdminDocumentSnapshot[],
  events: AdminActivityEvent[]
): AdminWorkSession[] {
  const bySession = new Map<string, AdminDocumentSnapshot[]>();
  const unassigned: AdminDocumentSnapshot[] = [];
  for (const doc of documents) {
    if (doc.sessionId) {
      const list = bySession.get(doc.sessionId) ?? [];
      list.push(doc);
      bySession.set(doc.sessionId, list);
    } else {
      unassigned.push(doc);
    }
  }

  const errorEventsBySession = new Map<string, AdminActivityEvent[]>();
  for (const ev of events) {
    if (ev.type !== "document_process_error") continue;
    const sid = ev.meta?.sessionId;
    if (!sid) continue;
    const list = errorEventsBySession.get(sid) ?? [];
    list.push(ev);
    errorEventsBySession.set(sid, list);
  }

  const durationBySession = new Map<string, number[]>();
  for (const ev of events) {
    if (ev.type !== "doc_processed" || !ev.meta?.sessionId || ev.meta.durationMs == null) continue;
    const list = durationBySession.get(ev.meta.sessionId) ?? [];
    list.push(ev.meta.durationMs);
    durationBySession.set(ev.meta.sessionId, list);
  }

  const knownIds = new Set(sessions.map((s) => s.id));
  const rows: AdminWorkSession[] = sessions.map((s) => {
    const docs = bySession.get(s.id) ?? [];
    const completedCount = docs.filter((d) => d.status === "completed" || d.status === "needs_review").length;
    const errorCount = docs.filter((d) => d.status === "error").length;
    const pendingCount = docs.filter((d) => d.status === "pending" || d.status === "queued").length;
    const processingCount = docs.filter((d) => d.status === "processing").length;
    const pages = docs.map((d) => d.pageCount).filter((n): n is number => typeof n === "number");
    const durations = durationBySession.get(s.id) ?? [];
    const docErrors = docs
      .filter((d) => d.status === "error" || d.error || d.errorCode)
      .map((d) => ({
        fileName: d.fileName,
        errorCode: d.errorCode,
        errorMessage: d.error,
        at: d.updatedAt || d.createdAt,
      }));
    const eventErrors = (errorEventsBySession.get(s.id) ?? []).map((ev) => ({
      fileName: ev.meta?.fileName ?? null,
      errorCode: ev.meta?.errorCode ?? null,
      errorMessage: ev.meta?.errorMessage ?? null,
      at: ev.at || null,
    }));
    const seen = new Set(docErrors.map((e) => `${e.fileName}|${e.errorCode}|${e.at}`));
    for (const e of eventErrors) {
      const key = `${e.fileName}|${e.errorCode}|${e.at}`;
      if (!seen.has(key)) docErrors.push(e);
    }

    return {
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      isActive: s.isActive,
      isPinned: s.isPinned,
      documentCount: docs.length,
      completedCount,
      errorCount: Math.max(errorCount, docErrors.length),
      pendingCount,
      processingCount,
      totalPages: pages.length ? pages.reduce((a, b) => a + b, 0) : null,
      avgDurationMs: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      errors: docErrors.slice(0, 40),
    };
  });

  // Orphan docs without a known session row
  for (const [sid, docs] of bySession) {
    if (knownIds.has(sid)) continue;
    const completedCount = docs.filter((d) => d.status === "completed" || d.status === "needs_review").length;
    const errorCount = docs.filter((d) => d.status === "error").length;
    rows.push({
      id: sid,
      name: `Session ${sid.slice(0, 8)}…`,
      createdAt: docs[0]?.createdAt ?? null,
      isActive: false,
      isPinned: false,
      documentCount: docs.length,
      completedCount,
      errorCount,
      pendingCount: docs.filter((d) => d.status === "pending").length,
      processingCount: docs.filter((d) => d.status === "processing").length,
      totalPages: null,
      avgDurationMs: null,
      errors: docs
        .filter((d) => d.status === "error" || d.error)
        .map((d) => ({
          fileName: d.fileName,
          errorCode: d.errorCode,
          errorMessage: d.error,
          at: d.updatedAt || d.createdAt,
        }))
        .slice(0, 40),
    });
  }

  if (unassigned.length > 0) {
    rows.push({
      id: "__unassigned__",
      name: "Unassigned documents",
      createdAt: unassigned[0]?.createdAt ?? null,
      isActive: false,
      isPinned: false,
      documentCount: unassigned.length,
      completedCount: unassigned.filter((d) => d.status === "completed").length,
      errorCount: unassigned.filter((d) => d.status === "error").length,
      pendingCount: unassigned.filter((d) => d.status === "pending").length,
      processingCount: unassigned.filter((d) => d.status === "processing").length,
      totalPages: null,
      avgDurationMs: null,
      errors: unassigned
        .filter((d) => d.status === "error" || d.error)
        .map((d) => ({
          fileName: d.fileName,
          errorCode: d.errorCode,
          errorMessage: d.error,
          at: d.updatedAt || d.createdAt,
        }))
        .slice(0, 40),
    });
  }

  return rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

/** @deprecated Prefer listAdminUserUsageInsights — kept for older callers. */
export async function listAdminUserActivity(
  uid: string,
  options?: { limit?: number; errorsOnly?: boolean }
): Promise<{ events: AdminActivityEvent[]; documents: AdminDocumentSnapshot[] }> {
  const insights = await listAdminUserUsageInsights(uid, options);
  return { events: insights.events, documents: insights.documents };
}

export async function listAdminUserUsageInsights(
  uid: string,
  options?: { limit?: number; errorsOnly?: boolean }
): Promise<AdminUserUsageInsights> {
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Firebase Admin credentials are not configured."), { status: 503 });
  }
  ensureFirebaseAdmin();

  const limit = Math.min(Math.max(options?.limit ?? 120, 1), 300);
  const [events, documents, sessions] = await Promise.all([
    loadActivityEvents(uid, limit, options?.errorsOnly),
    loadDocuments(uid, 250),
    loadWorkSessions(uid),
  ]);

  // Always include login events even when errorsOnly filter is on for the event table —
  // fetch a dedicated login list from the full activity when needed.
  let loginEvents = events.filter((e) => e.type === "login");
  if (options?.errorsOnly || loginEvents.length === 0) {
    const allForLogins = await loadActivityEvents(uid, 200, false);
    loginEvents = allForLogins.filter((e) => e.type === "login");
  }

  const workSessions = buildWorkSessionRollups(sessions, documents, events);
  const last = workSessions.find((s) => s.id !== "__unassigned__") ?? workSessions[0] ?? null;

  const summary: AdminUsageSummary = {
    loginCount: loginEvents.length,
    lastLoginAt: loginEvents[0]?.at ?? null,
    workSessionCount: workSessions.filter((s) => s.id !== "__unassigned__").length,
    documentCount: documents.length,
    completedCount: documents.filter((d) => d.status === "completed" || d.status === "needs_review")
      .length,
    errorCount: documents.filter((d) => d.status === "error").length,
    lastWorkSessionId: last?.id ?? null,
    lastWorkSessionName: last?.name ?? null,
    lastWorkSessionDocs: last?.documentCount ?? 0,
    lastWorkSessionErrors: last?.errorCount ?? 0,
    lastWorkSessionCompleted: last?.completedCount ?? 0,
  };

  return {
    summary,
    logins: loginEvents.map((e) => ({ id: e.id, at: e.at })),
    workSessions,
    events,
    documents: documents.slice(0, 60),
  };
}
