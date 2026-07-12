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
