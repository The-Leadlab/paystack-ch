import type { ProcessedDocument } from "../types";

const STATUS_RANK: Record<string, number> = {
  completed: 50,
  needs_review: 40,
  processing: 30,
  verifying: 25,
  pending: 10,
  skipped: 5,
  error: 1,
};

function statusRank(status?: string): number {
  return STATUS_RANK[status || ""] ?? 0;
}

function isProcessedWithData(doc: ProcessedDocument): boolean {
  return ["completed", "needs_review"].includes(doc.status || "") && Boolean(doc.data);
}

/** Prefer the richer / further-along document when collapsing duplicates. */
export function preferDocument(a: ProcessedDocument, b: ProcessedDocument): ProcessedDocument {
  const rankDiff = statusRank(b.status) - statusRank(a.status);
  if (rankDiff !== 0) return rankDiff > 0 ? b : a;
  const aHasData = Boolean(a.data);
  const bHasData = Boolean(b.data);
  if (aHasData !== bHasData) return bHasData ? b : a;
  return (b.created_at || "") >= (a.created_at || "") ? b : a;
}

/** Name twins: only collapse pending/empty ghosts against a real processed row (or double-queue). */
function shouldCollapseNameTwins(a: ProcessedDocument, b: ProcessedDocument): boolean {
  const aDone = isProcessedWithData(a);
  const bDone = isProcessedWithData(b);
  if (aDone && bDone) return false;
  return true;
}

function collapseByKey(
  docs: ProcessedDocument[],
  keyFn: (doc: ProcessedDocument) => string | null,
  shouldCollapse: (a: ProcessedDocument, b: ProcessedDocument) => boolean = () => true
): { keepers: ProcessedDocument[]; duplicateIds: string[] } {
  const byKey = new Map<string, ProcessedDocument>();
  const passthrough: ProcessedDocument[] = [];
  const duplicateIds: string[] = [];

  for (const doc of docs) {
    const key = keyFn(doc);
    if (!key) {
      passthrough.push(doc);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, doc);
      continue;
    }
    if (!shouldCollapse(existing, doc)) {
      passthrough.push(doc);
      continue;
    }
    const winner = preferDocument(existing, doc);
    const loser = winner.id === existing.id ? doc : existing;
    byKey.set(key, winner);
    if (loser.id && loser.id !== winner.id) duplicateIds.push(loser.id);
  }

  return { keepers: [...byKey.values(), ...passthrough], duplicateIds };
}

/**
 * Collapse duplicate Firestore document rows (same file uploaded twice, or
 * Drive re-import creating a pending twin of a completed doc).
 */
export function dedupeProcessedDocuments(docs: ProcessedDocument[]): {
  keepers: ProcessedDocument[];
  duplicateIds: string[];
} {
  const byHash = collapseByKey(docs, (d) =>
    d.fileHash && d.fileHash.length > 8 ? `hash:${d.fileHash}` : null
  );
  const byPath = collapseByKey(byHash.keepers, (d) =>
    d.storagePath ? `path:${d.storagePath}` : null
  );
  const byName = collapseByKey(
    byPath.keepers,
    (d) => {
      const name = (d.fileName || "").trim().toLowerCase();
      return name ? `name:${name}` : null;
    },
    shouldCollapseNameTwins
  );

  const duplicateIds = [
    ...new Set([...byHash.duplicateIds, ...byPath.duplicateIds, ...byName.duplicateIds]),
  ];
  const keepers = byName.keepers
    .filter((d) => !duplicateIds.includes(d.id))
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  return { keepers, duplicateIds };
}

/** True when a local processing row is already represented in Firestore. */
export function isLocalDocMirroredInFirestore(
  local: ProcessedDocument,
  firestoreDocs: ProcessedDocument[]
): boolean {
  return firestoreDocs.some((d) => {
    if (
      local.persistedDocumentId &&
      (d.id === local.persistedDocumentId || d.persistedDocumentId === local.persistedDocumentId)
    ) {
      return true;
    }
    if (local.fileHash && d.fileHash && local.fileHash === d.fileHash) return true;
    if (local.fileName && d.fileName && local.fileName === d.fileName) return true;
    return false;
  });
}
