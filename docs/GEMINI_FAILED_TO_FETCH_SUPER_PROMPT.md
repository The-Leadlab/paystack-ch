# Fix: "Cannot reach the AI server (Failed to fetch)" on PDF process

## Symptoms

Document rows show red **ERROR** with:
`Cannot reach the AI server. Check your connection and try again. (Failed to fetch)`
and **PROCESS AGAIN**. Amounts stay `0.00 CHF`.

## Causes

1. **Local:** Vite used to proxy `/api/gemini` → `127.0.0.1:8787`. If `pnpm dev:stripe-server` was not running, the browser got a raw network failure (`Failed to fetch`) instead of a JSON error.
2. **Parallel PDFs:** Default concurrency was 5 — several long Gemini calls at once can fail at the edge / proxy and surface the same message.
3. **Empty `GEMINI_API_KEY`:** server cannot call Google; should return 503 (clear message), not a hang.

## Fixes

| Change | File |
|--------|------|
| Mount `/api/gemini/*` **in Vite** (no 8787 required for AI) | `vite.config.ts` → `vitePluginGeminiLocalApi` |
| Stop proxying `/api/gemini` to 8787 | `vite.config.ts` |
| Retry once + clearer local error; `same-origin` for relative URLs | `client/src/cafe/lib/geminiApiFetch.ts` |
| Default document concurrency **4** (was 1). Cap 6. Huge PDFs still share the proxy. | `client/src/cafe/lib/runDocumentBatches.ts` |
| Default proxy rate limit **120 / 10 min** per uid (was 30). Override `GEMINI_RATE_LIMIT_MAX` on Vercel. | `lib/geminiProxy.ts` |
| Guard oversized inline bodies before fetch | `client/src/cafe/lib/geminiClient.ts` |

## Local checklist

1. Set `GEMINI_API_KEY=...` in `.env` (server-only; not `VITE_*`).
2. Restart `pnpm dev` (Gemini is now in-process).
3. Optional: still run `pnpm dev:stripe-server` for Stripe/Drive/OAuth.
4. Click **PROCESS AGAIN** on failed PDFs — one at a time by default.

## Production

Redeploy after push. Ensure Vercel has `GEMINI_API_KEY` and Firebase admin credentials for `generate-from-storage`.
