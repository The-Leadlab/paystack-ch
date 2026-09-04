import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  parseLoginMode,
  SELECTED_LOGIN_MODE_STORAGE_KEY,
  type LoginMode,
} from "@shared/loginMode";

export function readSelectedLoginMode(): LoginMode {
  try {
    const raw = sessionStorage.getItem(SELECTED_LOGIN_MODE_STORAGE_KEY);
    if (raw == null || String(raw).trim() === "") return "shared";
    return parseLoginMode(raw);
  } catch {
    return "shared";
  }
}

export function storeSelectedLoginMode(mode: LoginMode): void {
  try {
    sessionStorage.setItem(SELECTED_LOGIN_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/**
 * Persist login mode on the user doc.
 * - Explicit `mode` (e.g. from checkout) wins.
 * - Checkout selection in sessionStorage wins when present.
 * - Otherwise always write `shared` so existing exclusive accounts migrate
 *   without manual Firestore edits.
 */
export async function persistLoginModeToUser(uid: string, mode?: LoginMode): Promise<void> {
  if (!db) return;
  if (mode) {
    await setDoc(doc(db, "users", uid), { loginMode: mode }, { merge: true });
    return;
  }

  let fromCheckout: LoginMode | null = null;
  try {
    const raw = sessionStorage.getItem(SELECTED_LOGIN_MODE_STORAGE_KEY);
    if (raw != null && String(raw).trim() !== "") {
      fromCheckout = parseLoginMode(raw);
    }
  } catch {
    /* ignore */
  }

  await setDoc(
    doc(db, "users", uid),
    { loginMode: fromCheckout ?? "shared" },
    { merge: true }
  );
}
