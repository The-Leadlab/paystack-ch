/** How concurrent logins on the same credential behave. */
export type LoginMode = "exclusive" | "shared";

export const SELECTED_LOGIN_MODE_STORAGE_KEY = "paystack_selected_login_mode";

export function parseLoginMode(raw: unknown): LoginMode {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "shared" || v === "multi" || v === "multiple") return "shared";
  return "exclusive";
}

export function isMultiLoginMode(mode: LoginMode | unknown): boolean {
  return parseLoginMode(mode) === "shared";
}

export function loginModeLabel(mode: LoginMode | unknown): string {
  return isMultiLoginMode(mode) ? "shared" : "exclusive";
}
