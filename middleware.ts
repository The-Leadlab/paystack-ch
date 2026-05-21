/**
 * Vercel Edge gates:
 * - `/admin` → `ADMIN_ACCESS_PASSWORD` via `/operator` + `paystack_admin_session`
 * - `/ali` → `ALI_LAB_PASSWORD` via `/ali-gate` + `paystack_ali_lab_session`
 *
 * Local `vite` dev does not run this file — use client gate on `/ali` or `vercel dev`.
 */
export const config = {
  matcher: ["/admin", "/admin/", "/ali", "/ali/", "/ali/:path*"],
};

const ADMIN_COOKIE = "paystack_admin_session";
const ADMIN_MSG = "paystack-admin-cookie-v1";

const ALI_COOKIE = "paystack_ali_lab_session";
const ALI_MSG = "paystack-ali-lab-cookie-v1";

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

async function hmacCookieValue(password: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function gateOrRedirect(
  request: Request,
  url: URL,
  password: string | undefined,
  cookieName: string,
  cookieMsg: string,
  gatePath: string,
  nextPath: string
): Promise<Response> {
  if (!password) {
    return fetch(request);
  }
  const expected = await hmacCookieValue(password, cookieMsg);
  const got = cookieValue(request.headers.get("cookie"), cookieName);
  if (got && timingSafeEqualStr(got, expected)) {
    return fetch(request);
  }
  const dest = new URL(gatePath, url.origin);
  dest.searchParams.set("next", nextPath);
  return Response.redirect(dest.toString(), 302);
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (path === "/ali" || path.startsWith("/ali/")) {
    return gateOrRedirect(
      request,
      url,
      process.env.ALI_LAB_PASSWORD?.trim(),
      ALI_COOKIE,
      ALI_MSG,
      "/ali-gate",
      path
    );
  }

  return gateOrRedirect(
    request,
    url,
    process.env.ADMIN_ACCESS_PASSWORD?.trim(),
    ADMIN_COOKIE,
    ADMIN_MSG,
    "/operator",
    "/admin"
  );
}
