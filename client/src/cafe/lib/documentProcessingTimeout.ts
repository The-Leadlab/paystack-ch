import { GEMINI_CLIENT_FETCH_TIMEOUT_MS } from "@shared/geminiTimeouts";

/**
 * Wall-clock limit for one document (may include 2 Gemini API calls for multi-invoice PDFs).
 * Override with VITE_DOCUMENT_PROCESSING_TIMEOUT_MS (milliseconds), min 120000.
 */
export function resolveDocumentProcessingTimeoutMs(file: File): number {
  const env = import.meta.env.VITE_DOCUMENT_PROCESSING_TIMEOUT_MS?.trim();
  const fromEnv = env ? Number(env) : NaN;
  if (!Number.isNaN(fromEnv) && fromEnv >= 120_000) {
    return Math.min(fromEnv, 1_200_000);
  }
  const mb = file.size / (1024 * 1024);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  // Small non-PDF images rarely need the exhaustive second pass — use a tighter timeout.
  if (!isPdf && mb <= 5) return 180_000;
  if (!isPdf) return 300_000;

  // PDFs: size-tiered timeouts
  let perFile = 300_000;
  if (mb > 24) perFile = 900_000;
  else if (mb > 12) perFile = 600_000;
  else if (mb > 5) perFile = 420_000;

  // Two serverless invocations (main + exhaustive PDF pass) plus upload margin.
  const twoPassFloor = GEMINI_CLIENT_FETCH_TIMEOUT_MS * 2 + 45_000;
  return Math.max(perFile, twoPassFloor);
}
