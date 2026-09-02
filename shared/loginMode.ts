/**
 * Concurrent logins on the same credential.
 * Product policy: all accounts use shared multi-login (view-only → request → new session).
 * `exclusive` is retained only for legacy Firestore reads; runtime always treats accounts as shared.
 */
export type LoginMode = "exclusive" | "shared";

export const SELECTED_LOGIN_MODE_STORAGE_KEY = "paystack_selected_login_mode";

/** Canonical mode written on every auth/session claim. */
export const DEFAULT_LOGIN_MODE: LoginMode = "shared";

export function parseLoginMode(_raw?: unknown): LoginMode {
  // Legacy exclusive values are ignored — shared multi-login is universal.
  return "shared";
}

export function isMultiLoginMode(_mode?: LoginMode | unknown): boolean {
  return true;
}

export function loginModeLabel(_mode?: LoginMode | unknown): string {
  return "shared";
}
