import { auth } from "./firebase";
import { uploadDocument, type UploadedDocumentMeta } from "../services/storageService";
import { saveUploadedDocumentToDrive } from "./googleDriveClient";

export type DocumentStorageRef = UploadedDocumentMeta & {
  mimeType: string;
};

function guessMimeType(fileName: string, fileType: string): string {
  if (fileType) return fileType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.(jpe?g)$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/**
 * Upload (or reuse) a document in Firebase Storage so the server can fetch it for Gemini
 * without sending multi-megabyte base64 through the Vercel request body limit.
 */
export async function ensureDocumentStorageForAi(
  file: File,
  existing?: { fileUrl?: string; storagePath?: string }
): Promise<DocumentStorageRef | null> {
  const user = auth?.currentUser;
  if (!user?.uid) return null;

  if (existing?.fileUrl && existing?.storagePath) {
    return {
      downloadURL: existing.fileUrl,
      storagePath: existing.storagePath,
      mimeType: guessMimeType(file.name, file.type),
    };
  }

  const uploaded = await uploadDocument(file, user.uid, file.name);
  const mimeType = guessMimeType(file.name, file.type);

  // Fire-and-forget: a Drive save failure (not connected, quota, revoked access, etc.) must
  // never block or fail the upload/scan flow itself — see saveDocumentToDrive's own contract.
  void saveUploadedDocumentToDrive({
    storagePath: uploaded.storagePath,
    fileUrl: uploaded.downloadURL,
    filename: file.name,
    mimeType,
  }).catch((error) => {
    console.warn("⚠️ Could not save document to Google Drive:", error);
  });

  return {
    ...uploaded,
    mimeType,
  };
}
