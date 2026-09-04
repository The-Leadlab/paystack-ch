/** How concurrent logins on the same credential behave. */
export type LoginMode = "exclusive" | "shared";

export const SELECTED_LOGIN_MODE_STORAGE_KEY = "paystack_selected_login_mode";

/**
 * Default is shared (multi-browser view + ask host).
 * Exclusive only when explicitly chosen (`exclusive` / `single` / `one`).
 */
export function parseLoginMode(raw: unknown): LoginMode {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "exclusive" || v === "single" || v === "one") return "exclusive";
  if (v === "shared" || v === "multi" || v === "multiple") return "shared";
  return "shared";
}

export function isMultiLoginMode(mode: LoginMode | unknown): boolean {
  return parseLoginMode(mode) === "shared";
}

export function loginModeLabel(mode: LoginMode | unknown): string {
  return isMultiLoginMode(mode) ? "shared" : "exclusive";
}
