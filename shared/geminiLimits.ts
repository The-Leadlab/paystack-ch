/** Must match `maxDuration` for api/gemini/* in vercel.json (Pro: up to 300). */
export const GEMINI_SERVER_MAX_DURATION_SEC = 300;
export const GEMINI_SERVER_MAX_DURATION_MS = GEMINI_SERVER_MAX_DURATION_SEC * 1000;

/** Client fetch should end slightly before the serverless hard limit. */
export const GEMINI_CLIENT_FETCH_TIMEOUT_MS = GEMINI_SERVER_MAX_DURATION_MS - 8_000;

/** Firebase Storage + Gemini File API (PDFs up to ~50 MB). */
export const MAX_STORAGE_DOCUMENT_BYTES = 50 * 1024 * 1024;

/** Use Firebase resumable upload above this size (uploadBytes limit ~32 MB). */
export const FIREBASE_RESUMABLE_UPLOAD_THRESHOLD_BYTES = 28 * 1024 * 1024;

/** Server may fetch this much from Firebase Storage per request. */
export const MAX_STORAGE_FETCH_BYTES = MAX_STORAGE_DOCUMENT_BYTES;

/**
 * Below this size we inline base64 in the Gemini request; above it we use Gemini Files API
 * (avoids "Document is too large for secure processing" on ~15–20 MB PDFs).
 */
export const GEMINI_INLINE_DOCUMENT_MAX_BYTES = 3_500_000;
