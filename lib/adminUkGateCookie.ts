import { createHmac } from "crypto";

/** Must match `middleware.ts` (Edge) message bytes. */
export const ADMIN_UK_SESSION_COOKIE_MSG = "paystack-admin-uk-cookie-v1";

export const ADMIN_UK_SESSION_COOKIE_NAME = "paystack_admin_uk_session";

/** Default UAT password when `ADMIN_UK_PASSWORD` is unset (local / preview). */
export const ADMIN_UK_PASSWORD_DEFAULT = "admin UK";

export function resolveAdminUkPassword(): string {
  return process.env.ADMIN_UK_PASSWORD?.trim() || ADMIN_UK_PASSWORD_DEFAULT;
}

export function adminUkSessionCookieValue(password: string): string {
  return createHmac("sha256", password).update(ADMIN_UK_SESSION_COOKIE_MSG).digest("base64url");
}

export function adminUkSessionSetCookieHeader(token: string, maxAgeSec: number): string {
  const secure = useSecureCookieFlag();
  return `${ADMIN_UK_SESSION_COOKIE_NAME}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}

export function adminUkSessionClearCookieHeader(): string {
  const secure = useSecureCookieFlag();
  return `${ADMIN_UK_SESSION_COOKIE_NAME}=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`;
}

function useSecureCookieFlag(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}
