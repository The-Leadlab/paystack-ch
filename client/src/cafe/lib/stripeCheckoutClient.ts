function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

const apiBase = () => {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";
  if (!configured || typeof window === "undefined") return configured;
  try {
    const configuredUrl = new URL(configured);
    const currentUrl = new URL(window.location.origin);
    const sameApex =
      configuredUrl.protocol === currentUrl.protocol &&
      stripWww(configuredUrl.hostname) === stripWww(currentUrl.hostname);
    return sameApex ? "" : configured;
  } catch {
    return configured;
  }
};

/** Live vs test billing API prefix (see `StripeBillingPathProvider`). */
export const STRIPE_BILLING_PATH_LIVE = "/api/stripe";
export const STRIPE_BILLING_PATH_TEST = "/api/stripe-test";

export function billingPathFromSearch(search: string): string {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  return params.get("stripe_test") === "1" ? STRIPE_BILLING_PATH_TEST : STRIPE_BILLING_PATH_LIVE;
}

function truncateForMessage(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * Read a Stripe billing API response without assuming JSON (static hosts / proxies may return HTML or plain text).
 * Exported for use in SubscriptionContext (authenticated checkout / portal).
 */
export async function parseStripeFetchResponse(res: Response): Promise<{
  json: Record<string, unknown> | null;
  /** Set when the response is not usable as JSON or HTTP status indicates failure */
  errorMessage: string | null;
}> {
  const status = res.status;
  const text = await res.text();
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      json: null,
      errorMessage: `Empty response (HTTP ${status}). If the app is hosted separately from the API, set VITE_API_BASE_URL to your API origin (e.g. your Vercel deployment URL).`,
    };
  }

  const looksJson =
    ct.includes("application/json") || ct.includes("+json") || /^[\[{]/.test(trimmed);

  if (!looksJson) {
    return {
      json: null,
      errorMessage: `Server returned HTTP ${status} (not JSON). ${truncateForMessage(text, 200)}`,
    };
  }

  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    if (!res.ok) {
      const serverErr = typeof json.error === "string" ? json.error : null;
      return { json, errorMessage: serverErr || `Request failed (HTTP ${status})` };
    }
    return { json, errorMessage: null };
  } catch {
    return {
      json: null,
      errorMessage: `Invalid JSON (HTTP ${status}). ${truncateForMessage(text, 200)}`,
    };
  }
}

/** From URL after Stripe redirects to `/sign-up?checkout=success&session_id=...`. */
export function checkoutSuccessSessionId(search: string): string | null {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  if (params.get("checkout") !== "success") return null;
  return params.get("session_id");
}

export async function startGuestCheckoutSession(
  planId: string | undefined,
  billingPath: string = STRIPE_BILLING_PATH_LIVE
): Promise<string> {
  const res = await fetch(`${apiBase()}${billingPath}/guest-trial-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: planId ?? undefined }),
  });
  const { json, errorMessage } = await parseStripeFetchResponse(res);
  if (!json) throw new Error(errorMessage || "Checkout failed");
  if (!res.ok) throw new Error(errorMessage || "Checkout failed");
  const url = json.url;
  if (typeof url !== "string" || !url) {
    const err = typeof json.error === "string" ? json.error : null;
    throw new Error(err || "No checkout URL returned");
  }
  return url;
}

/** Append `checkout=success&session_id=` from the current page query onto sign-in / sign-up links. */
export function preserveCheckoutInAuthHref(baseHref: string, currentSearch: string): string {
  const sid = checkoutSuccessSessionId(currentSearch);
  if (!sid) return baseHref;
  const qIdx = baseHref.indexOf("?");
  const path = qIdx >= 0 ? baseHref.slice(0, qIdx) : baseHref;
  const existing = qIdx >= 0 ? baseHref.slice(qIdx + 1) : "";
  const params = new URLSearchParams(existing);
  params.set("checkout", "success");
  params.set("session_id", sid);
  const curQs = currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch;
  if (new URLSearchParams(curQs).get("stripe_test") === "1") {
    params.set("stripe_test", "1");
  }
  return `${path}?${params.toString()}`;
}

export async function linkCheckoutSessionAfterAuth(
  idToken: string,
  sessionId: string,
  billingPath: string = STRIPE_BILLING_PATH_LIVE
): Promise<void> {
  const res = await fetch(`${apiBase()}${billingPath}/link-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  const { json, errorMessage } = await parseStripeFetchResponse(res);
  if (!json || !res.ok) {
    throw new Error(errorMessage || "Could not link subscription to your account");
  }
  if (json.ok !== true) {
    const err = typeof json.error === "string" ? json.error : "Could not link subscription to your account";
    throw new Error(err);
  }
}
