function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

/** Strip trailing slashes and a mistaken `/api` suffix (paths already start with `/api/`). */
function normalizeConfiguredBase(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  if (/\/api$/i.test(base)) {
    base = base.replace(/\/api$/i, "");
  }
  return base;
}

/**
 * Base URL for serverless routes under `/api/*`.
 * Use empty string when the SPA and API share the same host (paystack.ch).
 *
 * `VITE_API_BASE_URL` must be the site origin only, e.g. `https://paystack.ch`
 * — not `https://paystack.ch/api` (that produces `/api/api/...` and fails).
 */
export function resolveApiBaseUrl(): string {
  const configured = normalizeConfiguredBase(
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
  );
  if (!configured || typeof window === "undefined") return configured;
  try {
    const configuredUrl = new URL(
      configured.startsWith("http") ? configured : `https://${configured}`
    );
    const currentUrl = new URL(window.location.origin);
    const sameApex =
      configuredUrl.protocol === currentUrl.protocol &&
      stripWww(configuredUrl.hostname) === stripWww(currentUrl.hostname);
    return sameApex ? "" : configured;
  } catch {
    return configured;
  }
}

/** Build full URL for an API path such as `/api/gemini/generate`. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${p}`;
}
