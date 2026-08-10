/**
 * Keep uploaded File objects across the local→Firestore mirror handoff.
 *
 * IMPORTANT: Use globalThis so Vite code-splitting cannot create two Maps
 * (remember in one chunk, recall miss in another → Missing source file).
 */
type DocFileStore = Map<string, File>;

function store(): DocFileStore {
  const g = globalThis as typeof globalThis & { __paystackDocFiles?: DocFileStore };
  if (!g.__paystackDocFiles) g.__paystackDocFiles = new Map();
  return g.__paystackDocFiles;
}

function remember(key: string | undefined | null, file: File | undefined | null): void {
  if (!key || !file) return;
  store().set(key, file);
}

function nameKey(fileName: string | undefined | null): string | null {
  const n = (fileName || "").trim().toLowerCase();
  return n ? `name:${n}` : null;
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
  remember(nameKey(fileName), file);
  // Also keep raw name for older callers
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
    nameKey(opts.fileName),
    opts.fileName ? `name:${opts.fileName}` : null,
  ];
  const s = store();
  for (const key of keys) {
    if (key && s.has(key)) return s.get(key);
  }
  return undefined;
}

export function forgetDocumentFile(opts: {
  firestoreId?: string | null;
  persistedDocumentId?: string | null;
  fileHash?: string | null;
  fileName?: string | null;
}): void {
  const s = store();
  for (const key of [
    opts.firestoreId,
    opts.persistedDocumentId,
    opts.fileHash,
    nameKey(opts.fileName),
    opts.fileName ? `name:${opts.fileName}` : null,
  ]) {
    if (key) s.delete(key);
  }
}

/** Debug / support: how many Files are retained. */
export function countRememberedDocumentFiles(): number {
  return store().size;
}
