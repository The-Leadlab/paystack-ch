/**
 * Keep uploaded File objects across the local→Firestore mirror handoff.
 * DocumentProcessor drops local rows when Firestore has the same doc, which
 * previously discarded fileRaw and forced a flaky Storage re-download.
 */
const filesByKey = new Map<string, File>();

function remember(key: string | undefined | null, file: File | undefined | null): void {
  if (!key || !file) return;
  filesByKey.set(key, file);
}

export function rememberDocumentFile(opts: {
  file: File;
  firestoreId?: string | null;
  fileHash?: string | null;
  fileName?: string | null;
}): void {
  const { file, firestoreId, fileHash, fileName } = opts;
  remember(firestoreId, file);
  remember(fileHash, file);
  if (fileName) remember(`name:${fileName}`, file);
}

export function recallDocumentFile(opts: {
  firestoreId?: string | null;
  persistedDocumentId?: string | null;
  fileHash?: string | null;
  fileName?: string | null;
}): File | undefined {
  const keys = [
    opts.firestoreId,
    opts.persistedDocumentId,
    opts.fileHash,
    opts.fileName ? `name:${opts.fileName}` : null,
  ];
  for (const key of keys) {
    if (key && filesByKey.has(key)) return filesByKey.get(key);
  }
  return undefined;
}

export function forgetDocumentFile(opts: {
  firestoreId?: string | null;
  persistedDocumentId?: string | null;
  fileHash?: string | null;
  fileName?: string | null;
}): void {
  for (const key of [
    opts.firestoreId,
    opts.persistedDocumentId,
    opts.fileHash,
    opts.fileName ? `name:${opts.fileName}` : null,
  ]) {
    if (key) filesByKey.delete(key);
  }
}
