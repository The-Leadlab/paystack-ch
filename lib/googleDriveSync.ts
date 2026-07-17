import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import {
  assertOwnedStoragePath,
  isAllowedFirebaseStorageUrl,
  readStorageFileForUser,
  resolveFirebaseStorageBucket,
} from "./firebaseStorageAdmin.js";
import { saveDocumentToDrive, ensureValidRootFolder, type DriveUploadFile } from "./googleServices.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";

const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_SCOPE_READONLY = "https://www.googleapis.com/auth/drive.readonly";
const MAX_DRIVE_IMPORT_BYTES = 25 * 1024 * 1024;

const IMPORTABLE_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type GoogleDriveSyncResult = { status: number; json: Record<string, unknown> };

async function uploadBytesToFirebaseStorage(
  uid: string,
  filename: string,
  bytes: Buffer,
  mimeType: string
): Promise<{ storagePath: string; fileUrl: string }> {
  ensureFirebaseAdmin();
  const bucket = getStorage().bucket(resolveFirebaseStorageBucket());
  const timestamp = Date.now();
  const safeName = filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
  const storagePath = `documents/${uid}/${timestamp}_${safeName || "document.bin"}`;
  const file = bucket.file(storagePath);
  await file.save(bytes, { metadata: { contentType: mimeType } });
  const [fileUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  });
  return { storagePath, fileUrl };
}

type DriveConnection = {
  refreshToken: string;
  folderId: string | null;
  uploadedDocuments: Record<string, string>;
  importedDriveFiles: Record<string, { storagePath: string; fileName: string }>;
};

async function getDriveConnection(uid: string): Promise<DriveConnection | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const googleDrive = (
    snap.data() as
      | {
          googleDrive?: {
            refreshToken?: unknown;
            folderId?: unknown;
            uploadedDocuments?: unknown;
            importedDriveFiles?: unknown;
          };
        }
      | undefined
  )?.googleDrive;
  if (typeof googleDrive?.refreshToken !== "string") {
    return null;
  }
  const uploadedDocuments =
    googleDrive.uploadedDocuments && typeof googleDrive.uploadedDocuments === "object"
      ? (googleDrive.uploadedDocuments as Record<string, string>)
      : {};
  const importedDriveFiles =
    googleDrive.importedDriveFiles && typeof googleDrive.importedDriveFiles === "object"
      ? (googleDrive.importedDriveFiles as Record<string, { storagePath: string; fileName: string }>)
      : {};
  return {
    refreshToken: googleDrive.refreshToken,
    folderId: typeof googleDrive.folderId === "string" ? googleDrive.folderId : null,
    uploadedDocuments,
    importedDriveFiles,
  };
}

async function getGoogleDriveAccessToken(refreshToken: string): Promise<string> {
  const useTestMode =
    process.env.GOOGLE_DRIVE_USE_TEST_MODE?.toLowerCase() === "true" ||
    process.env.GOOGLE_DRIVE_USE_TEST_MODE === "1";
  const clientId = (useTestMode ? process.env.GOOGLE_DRIVE_TEST_CLIENT_ID : process.env.GOOGLE_DRIVE_CLIENT_ID)?.trim();
  const clientSecret = (useTestMode
    ? process.env.GOOGLE_DRIVE_TEST_CLIENT_SECRET
    : process.env.GOOGLE_DRIVE_CLIENT_SECRET)?.trim();
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error("Server missing GOOGLE_DRIVE_CLIENT_ID/SECRET"), { status: 503 });
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw Object.assign(
      new Error(data.error_description || data.error || "Failed to refresh Google Drive access token"),
      { status: 401, code: data.error }
    );
  }
  return data.access_token;
}

async function markGoogleDriveNeedsReconnect(uid: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: { needsReconnect: true } }, { merge: true });
}

async function refreshAccessTokenOrMarkDisconnected(uid: string, refreshToken: string): Promise<string> {
  try {
    return await getGoogleDriveAccessToken(refreshToken);
  } catch (error) {
    if ((error as { code?: string }).code === "invalid_grant") {
      await markGoogleDriveNeedsReconnect(uid);
    }
    throw error;
  }
}

type DriveListedFile = { id: string; name: string; mimeType: string; size?: string };

async function listDriveFolderFiles(accessToken: string, folderId: string): Promise<DriveListedFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,size)");
  const res = await fetch(`${GOOGLE_DRIVE_FILES_URL}?q=${q}&fields=${fields}&pageSize=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as {
    files?: DriveListedFile[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(new Error(data.error?.message || "Failed to list Google Drive folder"), {
      status: res.status === 401 ? 401 : 502,
    });
  }
  return data.files ?? [];
}

/** Lists files directly in `folderId` plus one level into any subfolders (the week-dated
 * subfolders documents get filed into are exactly one level deep) — folder entries themselves
 * are excluded from the result, only actual files are returned. */
async function listDriveFolderFilesRecursive(
  accessToken: string,
  folderId: string
): Promise<DriveListedFile[]> {
  const topLevel = await listDriveFolderFiles(accessToken, folderId);
  const files: DriveListedFile[] = [];
  const subfolders: DriveListedFile[] = [];

  for (const entry of topLevel) {
    if (entry.mimeType === "application/vnd.google-apps.folder") {
      subfolders.push(entry);
    } else {
      files.push(entry);
    }
  }

  for (const subfolder of subfolders) {
    const nested = await listDriveFolderFiles(accessToken, subfolder.id);
    for (const entry of nested) {
      if (entry.mimeType !== "application/vnd.google-apps.folder") {
        files.push(entry);
      }
    }
  }

  return files;
}

async function downloadDriveFileBytes(accessToken: string, fileId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const res = await fetch(`${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to download Drive file (HTTP ${res.status})`), {
      status: res.status === 401 ? 401 : 502,
    });
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DRIVE_IMPORT_BYTES) {
    throw Object.assign(new Error("Drive file exceeds import size limit (25 MB)"), { status: 413 });
  }
  const mimeType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  return { bytes: Buffer.from(arrayBuffer), mimeType };
}

async function recordDriveImport(
  uid: string,
  driveFileId: string,
  meta: { storagePath: string; fileName: string }
): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: { importedDriveFiles: { [driveFileId]: meta } } }, { merge: true });
}

export type DriveSaveDocumentRequest = {
  storagePath?: unknown;
  fileUrl?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  documentDate?: unknown;
};

/** Platform → Drive: fetch from Firebase Storage and upload to the user's Drive folder. */
export async function runDriveSaveDocument(
  authorization: string | undefined,
  body: DriveSaveDocumentRequest
): Promise<GoogleDriveSyncResult> {
  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    return { status: (error as { status?: number }).status || 401, json: { error: (error as Error).message } };
  }

  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }

    const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const mimeTypeHint = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const documentDate = typeof body.documentDate === "string" ? body.documentDate.trim() : "";

    if (!storagePath || !fileUrl || !filename) {
      return { status: 400, json: { error: "storagePath, fileUrl, and filename are required" } };
    }

    assertOwnedStoragePath(uid, storagePath);
    if (!isAllowedFirebaseStorageUrl(fileUrl, uid)) {
      return { status: 403, json: { error: "fileUrl is not allowed for this account" } };
    }

    const { bytes, mimeType: fetchedMime } = await readStorageFileForUser(uid, storagePath, fileUrl);
    const file: DriveUploadFile = {
      bytes,
      filename,
      mimeType: mimeTypeHint || fetchedMime || "application/octet-stream",
      sourceId: storagePath,
      ...(documentDate ? { documentDate } : {}),
    };

    const out = await saveDocumentToDrive(uid, file);
    return { status: out.status, json: "json" in out ? out.json : {} };
  } catch (error) {
    const status = (error as { status?: number }).status || 502;
    return { status, json: { error: (error as Error).message } };
  }
}

export type DriveImportedFile = {
  driveFileId: string;
  fileName: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
};

/** Drive → Platform: import new files from the user's Paystack Documents folder into Firebase Storage. */
export async function runDriveSyncFromDrive(authorization: string | undefined): Promise<GoogleDriveSyncResult> {
  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    return { status: (error as { status?: number }).status || 401, json: { error: (error as Error).message } };
  }

  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }

    const connection = await getDriveConnection(uid);
    if (!connection) {
      return { status: 200, json: { imported: [], skipped: 0, message: "Google Drive not connected" } };
    }

    const uploadedDriveIds = new Set(Object.values(connection.uploadedDocuments));
    let accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
    let rootFolderId = await ensureValidRootFolder(uid, accessToken, connection.folderId);

    let files: DriveListedFile[];
    try {
      files = await listDriveFolderFilesRecursive(accessToken, rootFolderId);
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
        rootFolderId = await ensureValidRootFolder(uid, accessToken, rootFolderId);
        files = await listDriveFolderFilesRecursive(accessToken, rootFolderId);
      } else if (
        (error as { status?: number }).status === 404 ||
        String((error as Error)?.message || "")
          .toLowerCase()
          .includes("not found")
      ) {
        accessToken = await refreshAccessTokenOrMarkDisconnected(uid, connection.refreshToken);
        rootFolderId = await ensureValidRootFolder(uid, accessToken, null);
        files = await listDriveFolderFilesRecursive(accessToken, rootFolderId);
      } else {
        throw error;
      }
    }

    const imported: DriveImportedFile[] = [];
    let skipped = 0;

    for (const file of files) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        skipped += 1;
        continue;
      }
      if (!IMPORTABLE_MIME.has(file.mimeType)) {
        skipped += 1;
        continue;
      }
      if (connection.importedDriveFiles[file.id] || uploadedDriveIds.has(file.id)) {
        skipped += 1;
        continue;
      }

      try {
        const { bytes, mimeType } = await downloadDriveFileBytes(accessToken, file.id);
        const { storagePath, fileUrl } = await uploadBytesToFirebaseStorage(uid, file.name, bytes, mimeType);
        await recordDriveImport(uid, file.id, { storagePath, fileName: file.name });
        imported.push({
          driveFileId: file.id,
          fileName: file.name,
          storagePath,
          fileUrl,
          mimeType,
        });
      } catch (err) {
        console.warn("[googleDrive] import skipped for file", file.id, err instanceof Error ? err.message : err);
        skipped += 1;
      }
    }

    return { status: 200, json: { imported, skipped, count: imported.length } };
  } catch (error) {
    const status = (error as { status?: number }).status || 502;
    return { status, json: { error: (error as Error).message } };
  }
}

/** OAuth scopes required for bidirectional sync (exported for tests). */
export const GOOGLE_DRIVE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  GOOGLE_DRIVE_SCOPE_READONLY,
].join(" ");
