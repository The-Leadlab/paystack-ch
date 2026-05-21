import { createHmac } from "crypto";

/** Must match Edge middleware message bytes for `/ali`. */
export const ALI_LAB_SESSION_COOKIE_MSG = "paystack-ali-lab-cookie-v1";

export const ALI_LAB_SESSION_COOKIE_NAME = "paystack_ali_lab_session";

export function aliLabSessionCookieValue(password: string): string {
  return createHmac("sha256", password).update(ALI_LAB_SESSION_COOKIE_MSG).digest("base64url");
}

export function aliLabSessionSetCookieHeader(token: string, maxAgeSec: number): string {
  const secure = useSecureCookieFlag();
  return `${ALI_LAB_SESSION_COOKIE_NAME}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`;
}

export function aliLabSessionClearCookieHeader(): string {
  const secure = useSecureCookieFlag();
  return `${ALI_LAB_SESSION_COOKIE_NAME}=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`;
}

function useSecureCookieFlag(): boolean {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}
