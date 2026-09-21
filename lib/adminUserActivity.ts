/**
 * Admin-only: usage insights for demo / customer-success review.
 * Metadata only — never document body / OCR / line items.
 */
import { getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { tsToIso } from "./adminUsersList.js";
import {
  buildErrorLog,
  summarizeErrorLog,
  type ErrorLogEntry,
} from "./errorLog.js";

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
    documentId?: string;
    pdfPageSplit?: boolean;
  } | null;
};

export type AdminDocumentSnapshot = {
  id: string;
  fileName: string | null;
  status: string | null;
  error: string | null;
  errorCode: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  errorResolvedAt: string | null;
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
    status?: "open" | "resolved" | "archived";
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
  openErrorCount: number;
  resolvedErrorCount: number;
  lastWorkSessionId: string | null;
  lastWorkSessionName: string | null;
  lastWorkSessionDocs: number;
  lastWorkSessionErrors: number;
  lastWorkSessionCompleted: number;
  generatedAt: string;
};

export type AdminUserUsageInsights = {
  summary: AdminUsageSummary;
  logins: AdminLoginVisit[];
  workSessions: AdminWorkSession[];
  events: AdminActivityEvent[];
  documents: AdminDocumentSnapshot[];
  errorLog: ErrorLogEntry[];
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
  if (typeof m.documentId === "string") out.documentId = m.documentId;
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
    lastError: typeof data.lastError === "string" ? data.lastError.slice(0, 280) : null,
    lastErrorCode: typeof data.lastErrorCode === "string" ? data.lastErrorCode : null,
    lastErrorAt: typeof data.lastErrorAt === "string" ? data.lastErrorAt : tsToIso(data.lastErrorAt),
    errorResolvedAt:
      typeof data.errorResolvedAt === "string" ? data.errorResolvedAt : tsToIso(data.errorResolvedAt),
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

const OWNER_FIELDS = ["restaurantId", "restaurant_id", "userId", "uid"] as const;

function newerIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function preferRicherDocument(a: AdminDocumentSnapshot, b: AdminDocumentSnapshot): AdminDocumentSnapshot {
  return {
    id: a.id,
    fileName: a.fileName || b.fileName,
    status: a.status || b.status,
    error: a.error || b.error,
    errorCode: a.errorCode || b.errorCode,
    lastError: a.lastError || b.lastError,
    lastErrorCode: a.lastErrorCode || b.lastErrorCode,
    lastErrorAt: newerIso(a.lastErrorAt, b.lastErrorAt),
    errorResolvedAt: newerIso(a.errorResolvedAt, b.errorResolvedAt),
    pageCount: a.pageCount ?? b.pageCount,
    createdAt: newerIso(a.createdAt, b.createdAt) ?? a.createdAt,
    updatedAt: newerIso(a.updatedAt, b.updatedAt),
    sessionId: a.sessionId || b.sessionId,
    mimeType: a.mimeType || b.mimeType,
    fileSizeBytes: a.fileSizeBytes ?? b.fileSizeBytes,
  };
}

export function mergeDocumentsById(lists: AdminDocumentSnapshot[][]): AdminDocumentSnapshot[] {
  const map = new Map<string, AdminDocumentSnapshot>();
  for (const list of lists) {
    for (const doc of list) {
      if (!doc.id) continue;
      const existing = map.get(doc.id);
      map.set(doc.id, existing ? preferRicherDocument(existing, doc) : doc);
    }
  }
  return [...map.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

/** Files logged in userActivity but missing from the documents query (owner-field mismatch). */
export function documentsFromActivityEvents(events: AdminActivityEvent[]): AdminDocumentSnapshot[] {
  const out: AdminDocumentSnapshot[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (ev.type !== "doc_upload" && ev.type !== "doc_processed" && ev.type !== "document_process_error") {
      continue;
    }
    const id = ev.meta?.documentId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const status =
      ev.type === "doc_processed" ? "completed" : ev.type === "document_process_error" ? "error" : "processing";
    out.push({
      id,
      fileName: ev.meta?.fileName ?? null,
      status,
      error: ev.type === "document_process_error" ? ev.meta?.errorMessage ?? null : null,
      errorCode: ev.type === "document_process_error" ? ev.meta?.errorCode ?? null : null,
      lastError: ev.type === "document_process_error" ? ev.meta?.errorMessage ?? null : null,
      lastErrorCode: ev.type === "document_process_error" ? ev.meta?.errorCode ?? null : null,
      lastErrorAt: ev.type === "document_process_error" ? ev.at || null : null,
      errorResolvedAt: null,
      pageCount: ev.meta?.pageCount ?? null,
      createdAt: ev.at || null,
      updatedAt: ev.at || null,
      sessionId: ev.meta?.sessionId ?? null,
      mimeType: ev.meta?.mimeType ?? null,
      fileSizeBytes: ev.meta?.fileSizeBytes ?? null,
    });
  }
  return out;
}

async function queryByOwnerField(
  collection: string,
  field: string,
  uid: string,
  limit: number,
  orderField?: string
) {
  const db = getFirestore();
  const col = db.collection(collection);
  if (orderField) {
    try {
      return await col.where(field, "==", uid).orderBy(orderField, "desc").limit(limit).get();
    } catch {
      /* missing composite index — fall through */
    }
  }
  return col.where(field, "==", uid).limit(limit).get();
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

async function loadDocuments(uid: string, limit = 250): Promise<AdminDocumentSnapshot[]> {
  const lists = await Promise.all(
    OWNER_FIELDS.map(async (field) => {
      try {
        const snap = await queryByOwnerField("documents", field, uid, limit, "created_at");
        return snap.docs.map((d) => mapDocument(d.id, d.data() as Record<string, unknown>));
      } catch {
        return [] as AdminDocumentSnapshot[];
      }
    })
  );
  return mergeDocumentsById(lists).slice(0, limit);
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
  const map = new Map<
    string,
    { id: string; name: string; createdAt: string | null; isActive: boolean; isPinned: boolean }
  >();
  await Promise.all(
    OWNER_FIELDS.map(async (field) => {
      try {
        const snap = await queryByOwnerField("sessions", field, uid, 100, "createdAt");
        for (const d of snap.docs) {
          if (map.has(d.id)) continue;
          const data = d.data() as Record<string, unknown>;
          map.set(d.id, {
            id: d.id,
            name: typeof data.name === "string" && data.name.trim() ? data.name : "Untitled session",
            createdAt:
              typeof data.created_at === "string"
                ? data.created_at
                : tsToIso(data.createdAt) ?? tsToIso(data.created_at),
            isActive: data.isActive === true || data.is_active === true,
            isPinned: data.isPinned === true || data.is_pinned === true,
          });
        }
      } catch {
        /* ignore this owner field */
      }
    })
  );
  return [...map.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function errorsForSession(entries: ErrorLogEntry[]) {
  return entries.slice(0, 40).map((e) => ({
    fileName: e.fileName,
    errorCode: e.errorCode,
    errorMessage: e.errorMessage,
    at: e.at,
    status: e.status,
  }));
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
  events: AdminActivityEvent[],
  errorLog: ErrorLogEntry[]
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

  const logBySession = new Map<string, ErrorLogEntry[]>();
  const unassignedLog: ErrorLogEntry[] = [];
  for (const entry of errorLog) {
    if (entry.sessionId) {
      const list = logBySession.get(entry.sessionId) ?? [];
      list.push(entry);
      logBySession.set(entry.sessionId, list);
    } else {
      unassignedLog.push(entry);
    }
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
    const logged = logBySession.get(s.id) ?? [];
    const completedCount = docs.filter((d) => d.status === "completed" || d.status === "needs_review").length;
    const pendingCount = docs.filter((d) => d.status === "pending" || d.status === "queued").length;
    const processingCount = docs.filter((d) => d.status === "processing").length;
    const pages = docs.map((d) => d.pageCount).filter((n): n is number => typeof n === "number");
    const durations = durationBySession.get(s.id) ?? [];

    return {
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      isActive: s.isActive,
      isPinned: s.isPinned,
      documentCount: docs.length,
      completedCount,
      errorCount: logged.length,
      pendingCount,
      processingCount,
      totalPages: pages.length ? pages.reduce((a, b) => a + b, 0) : null,
      avgDurationMs: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      errors: errorsForSession(logged),
    };
  });

  // Orphan docs without a known session row
  for (const [sid, docs] of bySession) {
    if (knownIds.has(sid)) continue;
    const completedCount = docs.filter((d) => d.status === "completed" || d.status === "needs_review").length;
    const logged = logBySession.get(sid) ?? [];
    rows.push({
      id: sid,
      name: `Session ${sid.slice(0, 8)}…`,
      createdAt: docs[0]?.createdAt ?? null,
      isActive: false,
      isPinned: false,
      documentCount: docs.length,
      completedCount,
      errorCount: logged.length,
      pendingCount: docs.filter((d) => d.status === "pending").length,
      processingCount: docs.filter((d) => d.status === "processing").length,
      totalPages: null,
      avgDurationMs: null,
      errors: errorsForSession(logged),
    });
  }

  if (unassigned.length > 0 || unassignedLog.length > 0) {
    rows.push({
      id: "__unassigned__",
      name: "Unassigned documents",
      createdAt: unassigned[0]?.createdAt ?? unassignedLog[0]?.at ?? null,
      isActive: false,
      isPinned: false,
      documentCount: unassigned.length,
      completedCount: unassigned.filter((d) => d.status === "completed").length,
      errorCount: unassignedLog.length,
      pendingCount: unassigned.filter((d) => d.status === "pending").length,
      processingCount: unassigned.filter((d) => d.status === "processing").length,
      totalPages: null,
      avgDurationMs: null,
      errors: errorsForSession(unassignedLog),
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
  const [events, errorEvents, documents, sessions] = await Promise.all([
    loadActivityEvents(uid, limit, options?.errorsOnly),
    loadActivityEvents(uid, 300, true),
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

  const errorLog = buildErrorLog(
    errorEvents.map((e) => ({ id: e.id, at: e.at, meta: e.meta })),
    documents
  );
  const mergedDocuments = mergeDocumentsById([documents, documentsFromActivityEvents(events)]);
  const errorSummary = summarizeErrorLog(errorLog);
  const workSessions = buildWorkSessionRollups(sessions, mergedDocuments, events, errorLog);
  const last = workSessions.find((s) => s.id !== "__unassigned__") ?? workSessions[0] ?? null;

  const summary: AdminUsageSummary = {
    loginCount: loginEvents.length,
    lastLoginAt: loginEvents[0]?.at ?? null,
    workSessionCount: workSessions.filter((s) => s.id !== "__unassigned__").length,
    documentCount: mergedDocuments.length,
    completedCount: mergedDocuments.filter((d) => d.status === "completed" || d.status === "needs_review")
      .length,
    errorCount: errorSummary.loggedCount,
    openErrorCount: errorSummary.openCount,
    resolvedErrorCount: errorSummary.resolvedCount,
    lastWorkSessionId: last?.id ?? null,
    lastWorkSessionName: last?.name ?? null,
    lastWorkSessionDocs: last?.documentCount ?? 0,
    lastWorkSessionErrors: last?.errorCount ?? 0,
    lastWorkSessionCompleted: last?.completedCount ?? 0,
    generatedAt: new Date().toISOString(),
  };

  return {
    summary,
    logins: loginEvents.map((e) => ({ id: e.id, at: e.at })),
    workSessions,
    events,
    documents: mergedDocuments.slice(0, 200),
    errorLog,
  };
}
