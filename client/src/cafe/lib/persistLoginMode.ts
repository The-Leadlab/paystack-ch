import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  DEFAULT_LOGIN_MODE,
  SELECTED_LOGIN_MODE_STORAGE_KEY,
  type LoginMode,
} from "@shared/loginMode";

export function readSelectedLoginMode(): LoginMode {
  return DEFAULT_LOGIN_MODE;
}

/** No-op store kept for call-site compatibility; product no longer offers a choice. */
export function storeSelectedLoginMode(_mode?: LoginMode): void {
  try {
    sessionStorage.setItem(SELECTED_LOGIN_MODE_STORAGE_KEY, DEFAULT_LOGIN_MODE);
  } catch {
    /* ignore */
  }
}

/** Always persist shared multi-login so second same-account logins enter view mode. */
export async function persistLoginModeToUser(uid: string, _mode?: LoginMode): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, "users", uid), { loginMode: DEFAULT_LOGIN_MODE }, { merge: true });
}
