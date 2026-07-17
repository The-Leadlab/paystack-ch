import { apiUrl } from "@/lib/apiBase";
import { auth } from "./firebase";

export type GoogleDriveStatus = { connected: boolean; needsReconnect: boolean };

async function authHeader(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in before connecting Google Drive.");
  try {
    return `Bearer ${await user.getIdToken()}`;
  } catch {
    throw new Error("Session expired. Sign out and sign in again, then retry.");
  }
}

export async function fetchGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const res = await fetch(apiUrl("/api/oauth/google/status"), {
    headers: { Authorization: await authHeader() },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (HTTP ${res.status})`);
  return { connected: Boolean(json.connected), needsReconnect: Boolean(json.needsReconnect) };
}

/** Redirects the browser to Google's consent screen — does not return on success. */
export async function connectGoogleDrive(): Promise<void> {
  const res = await fetch(apiUrl("/api/oauth/google/start"), {
    method: "POST",
    headers: { Authorization: await authHeader() },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || typeof json.redirectUrl !== "string") {
    throw new Error(json?.error || "Could not start the Google Drive connection.");
  }
  window.location.href = json.redirectUrl;
}

/** Best-effort: fire-and-forget from callers — see saveDocumentToDrive in lib/googleServices.ts
 * for why a failure here must never surface as an upload/scan error to the user. */
export async function saveUploadedDocumentToDrive(params: {
  storagePath: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
}): Promise<void> {
  const res = await fetch(apiUrl("/api/drive/save"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: await authHeader() },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || `Drive save failed (HTTP ${res.status})`);
  }
}

export async function disconnectGoogleDriveAccount(): Promise<void> {
  const res = await fetch(apiUrl("/api/oauth/google/disconnect"), {
    method: "POST",
    headers: { Authorization: await authHeader() },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not disconnect Google Drive.");
}

export type DriveBackupPayload = {
  storagePath: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
  /** The document's own date, extracted by AI processing (ISO or Swiss/European format). When
   * present, the backup is filed directly into that week's subfolder; otherwise it lands in
   * "Uncategorised". Omit when processing failed or no date could be determined. */
  documentDate?: string;
};

/** Fire-and-forget backup of a platform upload to the user's Drive folder — called once AI
 * processing has concluded (success or failure), so the document is placed directly into its
 * correct week folder in a single upload rather than uploaded then moved. */
export async function backupDocumentToGoogleDrive(payload: DriveBackupPayload): Promise<void> {
  const res = await fetch(apiUrl("/api/drive/save-document"), {
    method: "POST",
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 200) {
    throw new Error(json?.error || `Drive backup failed (HTTP ${res.status})`);
  }
  if (json?.error) {
    throw new Error(String(json.error));
  }
}

export type DriveImportedFile = {
  driveFileId: string;
  fileName: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
};

export async function syncDocumentsFromGoogleDrive(): Promise<{ imported: DriveImportedFile[]; skipped: number }> {
  const res = await fetch(apiUrl("/api/drive/sync-from-drive"), {
    method: "POST",
    headers: { Authorization: await authHeader() },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Drive sync failed (HTTP ${res.status})`);
  return {
    imported: Array.isArray(json.imported) ? json.imported : [],
    skipped: typeof json.skipped === "number" ? json.skipped : 0,
  };
}
