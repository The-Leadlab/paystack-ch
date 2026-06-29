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

export function resolveDocumentBatchSize(): number {
  const raw = (import.meta.env.VITE_DOCUMENT_PROCESSING_CONCURRENCY || "5").trim();
  const n = parseInt(raw, 10);
  return Math.min(6, Math.max(1, Number.isFinite(n) ? n : 5));
}
