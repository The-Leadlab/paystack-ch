/**
 * Run work with a worker pool: when one item finishes, start the next.
 * (Old batch-wait meant one slow PDF froze the whole group.)
 */
export async function runInDocumentBatches<T>(
  items: T[],
  batchSize: number,
  shouldStop: () => boolean,
  runItem: (item: T) => Promise<void>
): Promise<void> {
  const size = Math.max(1, Math.min(6, batchSize));
  if (items.length === 0) return;

  let nextIndex = 0;
  const workerCount = Math.min(size, items.length);

  const worker = async () => {
    while (true) {
      if (shouldStop()) return;
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      try {
        await runItem(items[i]);
      } catch (err) {
        console.error("Document pool item failed:", err);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

/**
 * Default 4 — serial (1) made ~40 invoices take over an hour.
 * Huge PDFs still share the same Gemini proxy; cap at 6.
 * Override with VITE_DOCUMENT_PROCESSING_CONCURRENCY=1..6 if needed.
 */
export function resolveDocumentBatchSize(): number {
  const raw = (import.meta.env.VITE_DOCUMENT_PROCESSING_CONCURRENCY || "4").trim();
  const n = parseInt(raw, 10);
  return Math.min(6, Math.max(1, Number.isFinite(n) ? n : 4));
}
