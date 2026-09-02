import { fetchGoogleDriveStatus } from './googleDriveClient';
import { guessMimeType } from './documentStorageForAi';
import { loadStoragePrefs } from './storagePrefs';
import { downloadDocumentLocally } from './localDocumentDownload';

export async function postProcessDocumentStorage(opts: {
  uid: string;
  fileName: string;
  mimeType?: string;
  fileUrl?: string;
  storagePath?: string;
  fileRaw?: File | Blob;
  documentDate?: string;
}): Promise<void> {
  if (!opts.uid) return;
  const prefs = await loadStoragePrefs(opts.uid);
  const mimeType = opts.mimeType || guessMimeType(opts.fileName, opts.fileRaw?.type || '');

  let driveConnected = false;
  try {
    const status = await fetchGoogleDriveStatus();
    driveConnected = status.connected && !status.needsReconnect;
  } catch {
    driveConnected = false;
  }

  if (
    driveConnected &&
    prefs.driveMirror &&
    opts.storagePath &&
    opts.fileUrl
  ) {
    try {
      const { backupDocumentToGoogleDrive } = await import('./googleDriveClient');
      await backupDocumentToGoogleDrive({
        storagePath: opts.storagePath,
        fileUrl: opts.fileUrl,
        filename: opts.fileName,
        mimeType,
        documentDate: opts.documentDate || undefined,
      });
    } catch (driveErr) {
      console.warn('Google Drive backup skipped:', driveErr);
    }
  }

  if (prefs.localDownload && (opts.fileRaw || opts.fileUrl)) {
    try {
      await downloadDocumentLocally({
        fileName: opts.fileName,
        fileUrl: opts.fileUrl,
        fileRaw: opts.fileRaw,
      });
    } catch (downloadErr) {
      console.warn('Local document download skipped:', downloadErr);
    }
  }
}
