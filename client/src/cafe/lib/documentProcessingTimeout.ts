/**
 * Gemini document analysis can exceed several minutes for large PDFs (multiple API passes).
 * Override with VITE_DOCUMENT_PROCESSING_TIMEOUT_MS (milliseconds), min 120000.
 */
export function resolveDocumentProcessingTimeoutMs(file: File): number {
  const env = import.meta.env.VITE_DOCUMENT_PROCESSING_TIMEOUT_MS?.trim();
  const fromEnv = env ? Number(env) : NaN;
  if (!Number.isNaN(fromEnv) && fromEnv >= 120_000) {
    return Math.min(fromEnv, 1_200_000);
  }
  const mb = file.size / (1024 * 1024);
  if (mb > 24) return 900_000;
  if (mb > 12) return 600_000;
  if (mb > 5) return 420_000;
  return 300_000;
}
