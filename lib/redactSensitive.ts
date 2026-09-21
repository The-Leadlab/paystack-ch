/**
 * Strip secrets from debug/cache payloads before they are written to disk.
 * Used by the Vite debug collector so brute-force or session-replay dumps
 * cannot leak passwords, cookies, or API keys.
 */

const SENSITIVE_KEY =
  /^(password|passwd|pwd|pass|secret|token|access_token|refresh_token|id_token|authorization|cookie|set-cookie|api[_-]?key|apikey|private[_-]?key|client[_-]?secret|credit[_-]?card|card[_-]?number|cvv|ssn)$/i;

const SENSITIVE_QUERY = /(?:password|passwd|pwd|token|secret|api[_-]?key|authorization)=([^&]*)/gi;

const MASK = "[redacted]";

function maskString(value: string): string {
  return value.replace(SENSITIVE_QUERY, (match, _captured: string) => {
    const eq = match.indexOf("=");
    return `${match.slice(0, eq + 1)}${MASK}`;
  });
}

export function redactSensitive<T>(value: T, depth = 0): T {
  if (depth > 12 || value == null) return value;
  if (typeof value === "string") return maskString(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1)) as T;
  }
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = nested == null || nested === "" ? nested : MASK;
      continue;
    }
    out[key] = redactSensitive(nested, depth + 1);
  }
  return out as T;
}
