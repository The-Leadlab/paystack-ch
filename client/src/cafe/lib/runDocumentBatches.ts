/**
 * Run work in fixed-size batches: wait for the whole batch to finish before starting the next.
 */
export async function runInDocumentBatches<T>(
  items: T[],
  batchSize: number,
  shouldStop: () => boolean,
  runItem: (item: T) => Promise<void>
): Promise<void> {
  const size = Math.max(1, Math.min(6, batchSize));
  for (let i = 0; i < items.length; i += size) {
    if (shouldStop()) break;
    const batch = items.slice(i, i + size);
    await Promise.allSettled(
      batch.map(async (item) => {
        if (shouldStop()) return;
        await runItem(item);
      })
    );
  }
}

/**
 * Default 1 — parallel Gemini calls on large PDFs often surface as browser "Failed to fetch"
 * when the local proxy is down or Vercel cold-starts several 300s functions at once.
 * Override with VITE_DOCUMENT_PROCESSING_CONCURRENCY=2..6 if needed.
 */
export function resolveDocumentBatchSize(): number {
  const raw = (import.meta.env.VITE_DOCUMENT_PROCESSING_CONCURRENCY || "1").trim();
  const n = parseInt(raw, 10);
  return Math.min(6, Math.max(1, Number.isFinite(n) ? n : 1));
}
