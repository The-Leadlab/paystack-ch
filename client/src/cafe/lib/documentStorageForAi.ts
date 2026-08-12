import { auth } from "./firebase";
import { uploadDocument, type UploadedDocumentMeta } from "../services/storageService";
import { normalizeBusinessDocumentMime } from "./businessDocumentFile";

export type DocumentStorageRef = UploadedDocumentMeta & {
  mimeType: string;
};

export function guessMimeType(fileName: string, fileType: string): string {
  return normalizeBusinessDocumentMime(fileName, fileType);
}

/**
 * Upload (or reuse) a document in Firebase Storage so the server can fetch it for Gemini
 * without sending multi-megabyte base64 through the Vercel request body limit.
 * Google Drive backup happens once after AI processing (see backupDocumentToGoogleDrive),
 * so we do not dual-upload here.
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

  return {
    ...uploaded,
    mimeType,
  };
}
