import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/cafe/lib/firebase";
import { backupDocumentToGoogleDrive } from "@/cafe/lib/googleDriveClient";
import {
  addPersonalDriveFingerprint,
  fingerprintPersonalFile,
  hasPersonalDriveFingerprint,
} from "./personalSessionsStore";

/** Best-effort: store a personal statement under documents/{uid}/personal/{date}/ then
 * mirror to Google Drive Paystack Documents/Personal/{date}/. Skips duplicates per session. */
export async function backupPersonalStatementToGoogleDrive(
  file: File,
  uid: string | undefined,
  opts?: { documentDate?: string; sessionId?: string }
): Promise<"uploaded" | "skipped-duplicate" | "skipped"> {
  if (!uid || !storage) return "skipped";

  try {
    const sessionId = opts?.sessionId;
    const fingerprint = await fingerprintPersonalFile(file);
    if (sessionId && (await hasPersonalDriveFingerprint(sessionId, fingerprint))) {
      return "skipped-duplicate";
    }

    const dateFolder =
      opts?.documentDate && /^\d{4}-\d{2}-\d{2}/.test(opts.documentDate)
        ? opts.documentDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const safeName = (file.name || "statement.bin").replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const filename = safeName || "statement.bin";
    // Stable path segment for Drive dedupe key (same fingerprint → same sourceId)
    const storagePath = `documents/${uid}/personal/${dateFolder}/${fingerprint}_${filename}`;
    const storageRef = ref(storage, storagePath);
    const mimeType = file.type || "application/octet-stream";
    await uploadBytes(storageRef, file, { contentType: mimeType });
    const fileUrl = await getDownloadURL(storageRef);

    await backupDocumentToGoogleDrive({
      storagePath,
      fileUrl,
      filename,
      mimeType,
      workspace: "personal",
      documentDate: dateFolder,
    });

    if (sessionId) await addPersonalDriveFingerprint(sessionId, fingerprint);
    return "uploaded";
  } catch (error) {
    console.warn("Personal statement Drive backup skipped:", error);
    return "skipped";
  }
}
