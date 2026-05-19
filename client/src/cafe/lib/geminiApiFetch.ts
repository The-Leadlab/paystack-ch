import { GEMINI_CLIENT_FETCH_TIMEOUT_MS } from "@shared/geminiTimeouts";

export type GeminiApiFetchOptions = {
  url: string;
  token: string;
  body: unknown;
  /** Per-request override (ms). */
  timeoutMs?: number;
  signal?: AbortSignal;
};

function parsePositiveIntEnv(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

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
  if (status === 429) {
    return message || "Too many AI requests. Please wait a minute and try again.";
  }
  return message || `AI request failed (HTTP ${status})`;
}

/**
 * Long-running POST for Gemini proxies — AbortController works in Safari, Firefox, and Chrome.
 */
export async function postGeminiApi<T extends { text?: string; error?: string }>(
  options: GeminiApiFetchOptions
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? resolveGeminiFetchTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

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
      mode: "cors",
    });

    const json = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      throw new Error(mapGeminiHttpError(res.status, json?.error || `HTTP ${res.status}`));
    }
    return (json || {}) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `AI request timed out after ${Math.round(timeoutMs / 1000)}s. Retry, or use a smaller PDF.`
      );
    }
    const detail = error instanceof Error ? error.message : "Failed to fetch";
    if (/failed to fetch|networkerror|load failed/i.test(detail)) {
      throw new Error(
        `Cannot reach the AI server. Check your connection and try again. (${detail})`
      );
    }
    throw error instanceof Error ? error : new Error(detail);
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) options.signal.removeEventListener("abort", onExternalAbort);
  }
}
