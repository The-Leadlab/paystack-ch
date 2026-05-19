import { auth } from "./firebase";
import { uploadDocument, type UploadedDocumentMeta } from "../services/storageService";
import { MAX_STORAGE_DOCUMENT_BYTES } from "@shared/geminiLimits";

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

  if (file.size > MAX_STORAGE_DOCUMENT_BYTES) {
    throw new Error(
      `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). ` +
        `Maximum is ${(MAX_STORAGE_DOCUMENT_BYTES / (1024 * 1024)).toFixed(0)} MB.`
    );
  }

  if (existing?.fileUrl && existing?.storagePath) {
    return {
      downloadURL: existing.fileUrl,
      storagePath: existing.storagePath,
      mimeType: guessMimeType(file.name, file.type),
    };
  }

  const uploaded = await uploadDocument(file, user.uid, file.name);
  return {
    ...uploaded,
    mimeType: guessMimeType(file.name, file.type),
  };
}
