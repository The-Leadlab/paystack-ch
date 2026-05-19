/** Must match `maxDuration` for api/gemini/* in vercel.json (Pro: up to 300). */
export const GEMINI_SERVER_MAX_DURATION_SEC = 300;
export const GEMINI_SERVER_MAX_DURATION_MS = GEMINI_SERVER_MAX_DURATION_SEC * 1000;

/** Client fetch should end slightly before the serverless hard limit. */
export const GEMINI_CLIENT_FETCH_TIMEOUT_MS = GEMINI_SERVER_MAX_DURATION_MS - 8_000;
