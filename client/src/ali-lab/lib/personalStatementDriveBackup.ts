import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/cafe/lib/firebase";
import { backupDocumentToGoogleDrive } from "@/cafe/lib/googleDriveClient";

/** Best-effort: store a personal statement under documents/{uid}/personal/{date}/ then
 * mirror to Google Drive Paystack Documents/Personal/{date}/. Never throws to callers. */
export async function backupPersonalStatementToGoogleDrive(
  file: File,
  uid: string | undefined,
  opts?: { documentDate?: string }
): Promise<void> {
  if (!uid || !storage) return;

  try {
    const dateFolder =
      opts?.documentDate && /^\d{4}-\d{2}-\d{2}/.test(opts.documentDate)
        ? opts.documentDate.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const safeName = (file.name || "statement.bin").replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const filename = safeName || "statement.bin";
    const storagePath = `documents/${uid}/personal/${dateFolder}/${Date.now()}_${filename}`;
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
  } catch (error) {
    console.warn("Personal statement Drive backup skipped:", error);
  }
}
