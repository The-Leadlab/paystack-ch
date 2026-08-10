import { GEMINI_CLIENT_FETCH_TIMEOUT_MS } from "@shared/geminiTimeouts";

/**
 * Wall-clock limit for one document (may include 2–3 Gemini API calls for multi-invoice PDFs,
 * or N sequential page-image analyses for ticket sheets).
 * Override with VITE_DOCUMENT_PROCESSING_TIMEOUT_MS (milliseconds), min 120000.
 */
export function resolveDocumentProcessingTimeoutMs(
  file: File,
  opts?: {
    forceDeepPdfReads?: boolean;
    /** Known PDF page count (ticket sheets → one AI call per page). */
    pdfPageCount?: number;
    /** Explicit page-split path (N JPEGs analyzed sequentially). */
    pdfPageSplit?: boolean;
  }
): number {
  const env = import.meta.env.VITE_DOCUMENT_PROCESSING_TIMEOUT_MS?.trim();
  const fromEnv = env ? Number(env) : NaN;
  if (!Number.isNaN(fromEnv) && fromEnv >= 120_000) {
    return Math.min(fromEnv, 1_800_000);
  }
  const mb = file.size / (1024 * 1024);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // Small non-PDF images rarely need the exhaustive second pass — use a tighter timeout.
  if (!isPdf && mb <= 5) return 180_000;
  if (!isPdf) return 300_000;

  // PDFs: size-tiered timeouts
  let perFile = 300_000;
  if (mb > 24) perFile = 900_000;
  else if (mb > 12) perFile = 600_000;
  else if (mb > 5) perFile = 420_000;

  // Main + exhaustive + product recovery (+ upload margin).
  const deepLikely = opts?.forceDeepPdfReads === true || mb >= 0.08;
  const passMultiplier = deepLikely ? 3 : 2;
  const multiPassFloor = GEMINI_CLIENT_FETCH_TIMEOUT_MS * passMultiplier + 45_000;

  // Ticket/receipt page-split: one Gemini call per page (+ render margin).
  const pages = Math.max(1, opts?.pdfPageCount || 1);
  if (opts?.pdfPageSplit === true || pages >= 2) {
    const pageSplitBudget =
      pages * (GEMINI_CLIENT_FETCH_TIMEOUT_MS + 30_000) + 90_000;
    return Math.min(1_800_000, Math.max(perFile, multiPassFloor, pageSplitBudget));
  }

  return Math.max(perFile, multiPassFloor);
}
