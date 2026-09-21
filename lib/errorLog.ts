/**
 * Persistent admin error log: document-process failures stay visible after
 * the live document is retried, corrected, or deleted.
 */

export type ErrorLogStatus = "open" | "resolved" | "archived";

export type ErrorLogEvent = {
  id: string;
  at: string;
  meta: {
    errorCode?: string;
    errorMessage?: string;
    fileName?: string;
    sessionId?: string;
    documentId?: string;
  } | null;
};

export type ErrorLogDocument = {
  id: string;
  fileName: string | null;
  status: string | null;
  error: string | null;
  errorCode: string | null;
  sessionId: string | null;
  lastErrorAt?: string | null;
  errorResolvedAt?: string | null;
};

export type ErrorLogEntry = {
  id: string;
  at: string;
  fileName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sessionId: string | null;
  documentId: string | null;
  status: ErrorLogStatus;
  resolvedAt: string | null;
};

export type ErrorLogSummary = {
  loggedCount: number;
  openCount: number;
  resolvedCount: number;
  archivedCount: number;
};

function norm(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function matchDocument(event: ErrorLogEvent, documents: ErrorLogDocument[]): ErrorLogDocument | null {
  const meta = event.meta;
  if (!meta) return null;
  const docId = meta.documentId?.trim();
  if (docId) {
    const byId = documents.find((d) => d.id === docId);
    if (byId) return byId;
  }
  const file = norm(meta.fileName);
  const session = norm(meta.sessionId);
  if (!file) return null;
  const candidates = documents.filter((d) => norm(d.fileName) === file);
  if (candidates.length === 0) return null;
  if (session) {
    const inSession = candidates.find((d) => norm(d.sessionId) === session);
    if (inSession) return inSession;
  }
  return candidates[0] ?? null;
}

export function classifyErrorLogEntry(
  event: ErrorLogEvent,
  documents: ErrorLogDocument[]
): ErrorLogEntry {
  const meta = event.meta;
  const matched = matchDocument(event, documents);
  let status: ErrorLogStatus = "archived";
  let resolvedAt: string | null = null;
  if (matched) {
    const stillFailing =
      matched.status === "error" ||
      (Boolean(matched.error || matched.errorCode) && matched.status !== "completed" && matched.status !== "needs_review");
    if (stillFailing) {
      status = "open";
    } else {
      status = "resolved";
      resolvedAt = matched.errorResolvedAt || matched.lastErrorAt || null;
    }
  }
  return {
    id: event.id,
    at: event.at,
    fileName: meta?.fileName ?? matched?.fileName ?? null,
    errorCode: meta?.errorCode ?? matched?.errorCode ?? null,
    errorMessage: meta?.errorMessage ?? matched?.error ?? null,
    sessionId: meta?.sessionId ?? matched?.sessionId ?? null,
    documentId: meta?.documentId ?? matched?.id ?? null,
    status,
    resolvedAt,
  };
}

export function buildErrorLog(
  events: ErrorLogEvent[],
  documents: ErrorLogDocument[]
): ErrorLogEntry[] {
  return events
    .map((event) => classifyErrorLogEntry(event, documents))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function summarizeErrorLog(entries: ErrorLogEntry[]): ErrorLogSummary {
  let openCount = 0;
  let resolvedCount = 0;
  let archivedCount = 0;
  for (const entry of entries) {
    if (entry.status === "open") openCount += 1;
    else if (entry.status === "resolved") resolvedCount += 1;
    else archivedCount += 1;
  }
  return {
    loggedCount: entries.length,
    openCount,
    resolvedCount,
    archivedCount,
  };
}
