/**
 * Admin-only: recent user activity events + document metadata (no file content).
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

export async function listAdminUserActivity(
  uid: string,
  options?: { limit?: number; errorsOnly?: boolean }
): Promise<{ events: AdminActivityEvent[]; documents: AdminDocumentSnapshot[] }> {
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(new Error("Firebase Admin credentials are not configured."), { status: 503 });
  }
  ensureFirebaseAdmin();
  const db = getFirestore();
  const limit = Math.min(Math.max(options?.limit ?? 80, 1), 200);

  let activityQuery = db
    .collection("userActivity")
    .where("uid", "==", uid)
    .orderBy("at", "desc")
    .limit(limit);

  if (options?.errorsOnly) {
    activityQuery = db
      .collection("userActivity")
      .where("uid", "==", uid)
      .where("type", "==", "document_process_error")
      .orderBy("at", "desc")
      .limit(limit);
  }

  let activitySnap;
  try {
    activitySnap = await activityQuery.get();
  } catch {
    const fallback = await db.collection("userActivity").where("uid", "==", uid).limit(300).get();
    const sorted = fallback.docs
      .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      .filter((r) => !options?.errorsOnly || r.data.type === "document_process_error")
      .sort((a, b) => String(b.data.at || "").localeCompare(String(a.data.at || "")))
      .slice(0, limit);
    const eventsFromFallback: AdminActivityEvent[] = sorted.map((r) => ({
      id: r.id,
      type: typeof r.data.type === "string" ? r.data.type : "unknown",
      at: typeof r.data.at === "string" ? r.data.at : tsToIso(r.data.at) ?? "",
      meta: asMeta(r.data.meta),
    }));

    let documentsFb: AdminDocumentSnapshot[] = [];
    try {
      const docsSnap = await db.collection("documents").where("restaurantId", "==", uid).limit(80).get();
      documentsFb = docsSnap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
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
        })
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 40);
    } catch {
      documentsFb = [];
    }
    return { events: eventsFromFallback, documents: documentsFb };
  }

  const events: AdminActivityEvent[] = activitySnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      type: typeof data.type === "string" ? data.type : "unknown",
      at: typeof data.at === "string" ? data.at : tsToIso(data.at) ?? "",
      meta: asMeta(data.meta),
    };
  });

  let documents: AdminDocumentSnapshot[] = [];
  try {
    let docsSnap;
    try {
      docsSnap = await db
        .collection("documents")
        .where("restaurantId", "==", uid)
        .orderBy("created_at", "desc")
        .limit(40)
        .get();
    } catch {
      docsSnap = await db.collection("documents").where("restaurantId", "==", uid).limit(80).get();
    }
    documents = docsSnap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
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
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 40);
  } catch {
    documents = [];
  }

  return { events, documents };
}
