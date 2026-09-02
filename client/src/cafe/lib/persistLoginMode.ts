import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  parseLoginMode,
  SELECTED_LOGIN_MODE_STORAGE_KEY,
  type LoginMode,
} from "@shared/loginMode";

export function readSelectedLoginMode(): LoginMode {
  try {
    return parseLoginMode(sessionStorage.getItem(SELECTED_LOGIN_MODE_STORAGE_KEY));
  } catch {
    return "exclusive";
  }
}

export function storeSelectedLoginMode(mode: LoginMode): void {
  try {
    sessionStorage.setItem(SELECTED_LOGIN_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export async function persistLoginModeToUser(uid: string, mode?: LoginMode): Promise<void> {
  if (!db) return;
  const loginMode = mode ?? readSelectedLoginMode();
  await setDoc(doc(db, "users", uid), { loginMode }, { merge: true });
}
