import { GEMINI_CLIENT_FETCH_TIMEOUT_MS } from "@shared/geminiTimeouts";

export type GeminiApiFetchOptions = {
  url: string;
  token: string;
  body: unknown;
  /** Per-request override (ms). */
  timeoutMs?: number;
  signal?: AbortSignal;
};

export function resolveGeminiFetchTimeoutMs(): number {
  const env = import.meta.env.VITE_GEMINI_FETCH_TIMEOUT_MS?.trim();
  const fromEnv = env ? Number(env) : NaN;
  if (!Number.isNaN(fromEnv) && fromEnv >= 60_000) {
    return Math.min(fromEnv, GEMINI_CLIENT_FETCH_TIMEOUT_MS);
  }
  return GEMINI_CLIENT_FETCH_TIMEOUT_MS;
}

export function mapGeminiHttpError(status: number, message: string): string {
  if (status === 504 || /timed out|timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(message)) {
    return (
      "AI processing timed out on the server. Large PDFs can take several minutes — please retry. " +
      "If this keeps happening, try splitting the file or processing fewer documents at once."
    );
  }
  if (status === 503 && /GEMINI_API_KEY/i.test(message)) {
    return (
      "AI server is missing GEMINI_API_KEY. Set it in the server environment (Vercel / .env), " +
      "then restart `pnpm dev:stripe-server` or redeploy."
    );
  }
  if (status === 429) {
    return message || "Too many AI requests. Please wait a minute and try again.";
  }
  return message || `AI request failed (HTTP ${status})`;
}

function isNetworkReachabilityError(detail: string): boolean {
  return /failed to fetch|networkerror|load failed|network request failed|err_connection_refused|econnrefused/i.test(
    detail
  );
}

function networkReachabilityMessage(detail: string, url: string): string {
  const isLocal =
    typeof window !== "undefined" &&
    /localhost|127\.0\.0\.1/i.test(window.location.hostname) &&
    (url.startsWith("/") || /localhost|127\.0\.0\.1/.test(url));
  if (isLocal) {
    return (
      "Cannot reach the local AI server. Start it with `pnpm dev:stripe-server` (port 8787) " +
      "alongside `pnpm dev`, and ensure GEMINI_API_KEY is set in `.env`. " +
      `(${detail})`
    );
  }
  return `Cannot reach the AI server. Check your connection and try again. (${detail})`;
}

async function postOnce<T extends { text?: string; error?: string }>(
  options: GeminiApiFetchOptions,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const absolute = /^https?:\/\//i.test(options.url);
  try {
    const res = await fetch(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify(options.body),
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      // Relative /api/* URLs are same-origin; avoid CORS mode quirks on some browsers.
      mode: absolute ? "cors" : "same-origin",
    });

    const json = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      throw new Error(mapGeminiHttpError(res.status, json?.error || `HTTP ${res.status}`));
    }
    return (json || {}) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new Error("AI request was cancelled.");
      }
      throw new Error(
        `AI request timed out after ${Math.round(timeoutMs / 1000)}s. Retry, or use a smaller PDF.`
      );
    }
    const detail = error instanceof Error ? error.message : "Failed to fetch";
    if (isNetworkReachabilityError(detail)) {
      throw new Error(networkReachabilityMessage(detail, options.url));
    }
    throw error instanceof Error ? error : new Error(detail);
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) options.signal.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Long-running POST for Gemini proxies — AbortController works in Safari, Firefox, and Chrome.
 * Retries once on transient network failures (common when the local proxy is still starting).
 */
export async function postGeminiApi<T extends { text?: string; error?: string }>(
  options: GeminiApiFetchOptions
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? resolveGeminiFetchTimeoutMs();
  try {
    return await postOnce<T>(options, timeoutMs);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const canRetry =
      !options.signal?.aborted &&
      (/Cannot reach the (local )?AI server|Failed to fetch|ECONNREFUSED/i.test(detail) ||
        isNetworkReachabilityError(detail));
    if (!canRetry) throw error;
    await new Promise((r) => setTimeout(r, 700));
    return postOnce<T>(options, timeoutMs);
  }
}
