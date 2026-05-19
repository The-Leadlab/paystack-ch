/** Must match `maxDuration` for api/gemini/* in vercel.json (Pro: up to 300). */
export const GEMINI_SERVER_MAX_DURATION_SEC = 300;
export const GEMINI_SERVER_MAX_DURATION_MS = GEMINI_SERVER_MAX_DURATION_SEC * 1000;

/** Client fetch should end slightly before the serverless hard limit. */
export const GEMINI_CLIENT_FETCH_TIMEOUT_MS = GEMINI_SERVER_MAX_DURATION_MS - 8_000;

/**
 * Firebase Storage uploads — no practical app cap (Firebase allows very large objects).
 * Override client: VITE_MAX_STORAGE_UPLOAD_BYTES
 */
export const MAX_STORAGE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Gemini document analysis — Google caps PDFs at ~50 MB on the Files API.
 * We default to that; server env GEMINI_MAX_ANALYSIS_BYTES can lower it, not raise above what Gemini accepts.
 * Override client display: VITE_MAX_GEMINI_ANALYSIS_BYTES
 */
export const MAX_GEMINI_ANALYSIS_BYTES = 50 * 1024 * 1024;

/** @deprecated Use MAX_STORAGE_UPLOAD_BYTES */
export const MAX_STORAGE_DOCUMENT_BYTES = MAX_STORAGE_UPLOAD_BYTES;

/** Server fetch from Storage for AI (same as analysis cap). */
export const MAX_STORAGE_FETCH_BYTES = MAX_GEMINI_ANALYSIS_BYTES;

/** Use Firebase resumable upload above this size (uploadBytes limit ~32 MB). */
export const FIREBASE_RESUMABLE_UPLOAD_THRESHOLD_BYTES = 28 * 1024 * 1024;

/**
 * Below this size we inline base64 in the Gemini request; above it we use Gemini Files API.
 */
export const GEMINI_INLINE_DOCUMENT_MAX_BYTES = 3_500_000;

export function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
