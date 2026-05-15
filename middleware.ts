/**
 * Vercel Edge: require signed admin cookie before the SPA for `/admin` is served.
 * Password entry lives at `/operator` (POST `/api/admin/verify` sets HttpOnly cookie).
 * Local `vite` dev does not run this file — use `vercel dev` to test middleware locally.
 *
 * Token = base64url(HMAC-SHA256(UTF-8(ADMIN_ACCESS_PASSWORD), "paystack-admin-cookie-v1")) — must match `lib/adminGateCookie.ts`.
 */
export const config = {
  matcher: ["/admin", "/admin/"],
};

const COOKIE_NAME = "paystack_admin_session";
const COOKIE_MSG = "paystack-admin-cookie-v1";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) return decodeURIComponent(p.slice(prefix.length).trim());
  }
  return null;
}

async function adminSessionCookieValue(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(COOKIE_MSG)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const password = process.env.ADMIN_ACCESS_PASSWORD?.trim();
  if (!password) {
    return fetch(request);
  }

  const expected = await adminSessionCookieValue(password);
  const got = cookieValue(request.headers.get("cookie"), COOKIE_NAME);
  if (got && timingSafeEqualStr(got, expected)) {
    return fetch(request);
  }

  const dest = new URL("/operator", url.origin);
  dest.searchParams.set("next", "/admin");
  return Response.redirect(dest.toString(), 302);
}
