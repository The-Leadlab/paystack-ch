import { GEMINI_CLIENT_FETCH_TIMEOUT_MS } from "@shared/geminiTimeouts";

const MAX_WALL_MS = 12 * 60_000;
const TYPICAL_PDF_MS = 240_000;
const IMAGE_MS = 120_000;
const DEEP_PDF_MS = 420_000;
const PAGE_SPLIT_BASE_MS = 90_000;
const PAGE_SPLIT_PER_PAGE_MS = 50_000;

/**
 * Wall-clock limit for one document.
 * Override with VITE_DOCUMENT_PROCESSING_TIMEOUT_MS (milliseconds), min 120000.
 *
 * Do not multiply the full serverless Gemini timeout (~292s) by 3 for ordinary PDFs —
 * that made a 41-file serial queue take over an hour even when most files were healthy.
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
    return Math.min(fromEnv, MAX_WALL_MS);
  }
  const mb = file.size / (1024 * 1024);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return mb <= 8 ? IMAGE_MS : 180_000;
  }

  const pages = Math.max(1, opts?.pdfPageCount || 1);
  if (opts?.pdfPageSplit === true) {
    const pageSplitBudget = PAGE_SPLIT_BASE_MS + pages * PAGE_SPLIT_PER_PAGE_MS;
    return Math.min(MAX_WALL_MS, Math.max(TYPICAL_PDF_MS, pageSplitBudget));
  }

  if (opts?.forceDeepPdfReads === true) {
    return Math.min(MAX_WALL_MS, Math.max(DEEP_PDF_MS, GEMINI_CLIENT_FETCH_TIMEOUT_MS + 45_000));
  }

  if (mb > 24) return Math.min(MAX_WALL_MS, 540_000);
  if (mb > 12) return 360_000;
  if (mb > 5) return 300_000;
  return TYPICAL_PDF_MS;
}

/** Swiss account classify is optional — must not inherit the main Gemini fetch timeout. */
export const SWISS_ACCOUNT_CLASSIFY_TIMEOUT_MS = 20_000;
