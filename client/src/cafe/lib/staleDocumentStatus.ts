import type { ProcessedDocument } from '../types';

/** Rows stuck in `processing` after a crash/tab close — demo shows spinners forever. */
export const STALE_PROCESSING_MS = 20 * 60_000;

export function documentActivityTimestamp(doc: ProcessedDocument): number | null {
  const raw = doc.updated_at || doc.created_at;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function isStaleProcessingDocument(doc: ProcessedDocument): boolean {
  if (doc.status !== 'processing') return false;
  const ms = documentActivityTimestamp(doc);
  if (ms == null) return true;
  return Date.now() - ms > STALE_PROCESSING_MS;
}

export function displayStatusForDocument(
  doc: ProcessedDocument,
  opts?: { isBatchRunning?: boolean; activeKeys?: Set<string> }
): ProcessedDocument['status'] | 'queued' {
  const key = doc.persistedDocumentId || doc.id;
  const active = opts?.activeKeys?.has(key) ?? false;
  if (doc.status === 'processing') {
    if (isStaleProcessingDocument(doc)) return 'pending';
    if (opts?.isBatchRunning && !active) return 'queued';
    if (!opts?.isBatchRunning && !active) return 'pending';
    return 'processing';
  }
  if (doc.status === 'pending' && opts?.isBatchRunning) return 'queued';
  return doc.status;
}
