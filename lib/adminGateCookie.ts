import { createHmac } from "crypto";

/** Must match `middleware.ts` (Edge) message bytes. */
export const ADMIN_SESSION_COOKIE_MSG = "paystack-admin-cookie-v1";

export const ADMIN_SESSION_COOKIE_NAME = "paystack_admin_session";

/** HMAC-SHA256 (hex key material = UTF-8 password), output base64url — same algorithm as Edge middleware. */
export function adminSessionCookieValue(password: string): string {
  return createHmac("sha256", password).update(ADMIN_SESSION_COOKIE_MSG).digest("base64url");
}

export function adminSessionSetCookieHeader(token: string, maxAgeSec: number): string {
  const secure = useSecureCookieFlag();
  return `${ADMIN_SESSION_COOKIE_NAME}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/admin; Max-Age=${maxAgeSec}`;
}

export function adminSessionClearCookieHeader(): string {
  const secure = useSecureCookieFlag();
  return `${ADMIN_SESSION_COOKIE_NAME}=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/admin; Max-Age=0`;
}

function useSecureCookieFlag(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}
