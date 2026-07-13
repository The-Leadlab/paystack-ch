import { getStorage } from "firebase-admin/storage";
import {
  ensureFirebaseAdmin,
  hasFirebaseAdminCredentials,
  parseServiceAccountJson,
} from "./firebaseAdmin.js";

export function assertOwnedStoragePath(uid: string, storagePath: string): void {
  const normalized = storagePath.replace(/^\/+/, "").trim();
  const prefix = `documents/${uid}/`;
  if (!normalized.startsWith(prefix)) {
    throw Object.assign(new Error("Storage path is not allowed for this account"), { status: 403 });
  }
}

export function isAllowedFirebaseStorageUrl(fileUrl: string, uid: string): boolean {
  try {
    const u = new URL(fileUrl);
    if (!/\.googleapis\.com$/i.test(u.hostname) && !u.hostname.includes("firebasestorage")) {
      return false;
    }
    const decoded = decodeURIComponent(`${u.pathname}${u.search}`);
    return decoded.includes(`/documents/${uid}/`) || decoded.includes(`documents%2F${uid}%2F`);
  } catch {
    return false;
  }
}

function loadServiceAccountProjectId(): string | null {
  try {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
    const jsonText = inline || (b64 ? Buffer.from(b64.replace(/\s/g, ""), "base64").toString("utf8") : "");
    if (!jsonText) return null;
    const cred = parseServiceAccountJson(jsonText);
    return typeof cred.project_id === "string" ? cred.project_id : null;
  } catch {
    return null;
  }
}

export function resolveFirebaseStorageBucket(): string {
  const explicit = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (explicit) return explicit;
  const projectId = loadServiceAccountProjectId();
  if (projectId) return `${projectId}.firebasestorage.app`;
  throw Object.assign(new Error("Server missing FIREBASE_STORAGE_BUCKET"), { status: 503 });
}

/** Read a stored document with Admin SDK (bypasses owner-only Storage rules). */
export async function downloadStorageObject(
  storagePath: string
): Promise<{ bytes: Buffer; mimeType: string }> {
  ensureFirebaseAdmin();
  const normalized = storagePath.replace(/^\/+/, "").trim();
  const bucket = getStorage().bucket(resolveFirebaseStorageBucket());
  const file = bucket.file(normalized);
  const [bytes] = await file.download();
  let mimeType = "application/octet-stream";
  try {
    const [metadata] = await file.getMetadata();
    if (typeof metadata.contentType === "string" && metadata.contentType) {
      mimeType = metadata.contentType.split(";")[0].trim();
    }
  } catch {
    // metadata optional
  }
  return { bytes: Buffer.from(bytes), mimeType };
}

export async function readStorageFileForUser(
  uid: string,
  storagePath: string,
  fileUrl?: string
): Promise<{ bytes: Buffer; mimeType: string }> {
  assertOwnedStoragePath(uid, storagePath);

  if (hasFirebaseAdminCredentials()) {
    try {
      return await downloadStorageObject(storagePath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw Object.assign(new Error(`Could not read file from storage (admin): ${msg}`), { status: 502 });
    }
  }

  if (!fileUrl) {
    throw Object.assign(
      new Error(
        "Server cannot read Firebase Storage without FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 on Vercel."
      ),
      { status: 503 }
    );
  }
  if (!isAllowedFirebaseStorageUrl(fileUrl, uid)) {
    throw Object.assign(new Error("fileUrl is not allowed for this account"), { status: 403 });
  }

  const res = await fetch(fileUrl, { redirect: "follow", cache: "no-store" });
  if (!res.ok) {
    throw Object.assign(
      new Error(
        `Could not read file from storage (HTTP ${res.status}). ` +
          "Add FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 on Vercel so the server can read uploaded files."
      ),
      { status: 502 }
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  return { bytes: Buffer.from(arrayBuffer), mimeType };
}
