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
};

/** Fire-and-forget backup of a platform upload to the user's Drive folder. */
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
