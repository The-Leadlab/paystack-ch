const apiBase = () => (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";

/** From URL after Stripe redirects to `/sign-up?checkout=success&session_id=...`. */
export function checkoutSuccessSessionId(search: string): string | null {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  if (params.get("checkout") !== "success") return null;
  return params.get("session_id");
}

export async function startGuestCheckoutSession(planId: string | undefined): Promise<string> {
  const res = await fetch(`${apiBase()}/api/stripe/create-checkout-session-guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: planId ?? undefined }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error || "Checkout failed");
  if (!data.url) throw new Error("No checkout URL returned");
  return data.url;
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
  return `${path}?${params.toString()}`;
}

export async function linkCheckoutSessionAfterAuth(idToken: string, sessionId: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/stripe/link-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error || "Could not link subscription to your account");
}
