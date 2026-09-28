import { apiUrl } from "@/lib/apiBase";

const DEV_SESSION_KEY = "paystack_admin_uk_dev_session";
/** Client-side UAT flag so dashboard + Gemini switch to UK without waiting for cookie round-trip. */
export const ADMIN_UK_UAT_FLAG_KEY = "paystack_admin_uk_uat";

export function markAdminUkUatActive(): void {
  try {
    sessionStorage.setItem(ADMIN_UK_UAT_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearAdminUkUatActive(): void {
  try {
    sessionStorage.removeItem(ADMIN_UK_UAT_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function isAdminUkUatFlagSet(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_UK_UAT_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export async function verifyAdminUkPassword(password: string): Promise<void> {
  try {
    const res = await fetch(apiUrl("/api/admin-uk/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    let data: { error?: string; ok?: boolean } = {};
    try {
      data = (await res.json()) as { error?: string; ok?: boolean };
    } catch {
      /* ignore */
    }
    if (res.ok && data.ok === true) {
      if (import.meta.env.DEV) {
        sessionStorage.setItem(DEV_SESSION_KEY, "1");
      }
      markAdminUkUatActive();
      return;
    }
    if (import.meta.env.DEV) {
      const expected =
        (import.meta.env.VITE_ADMIN_UK_PASSWORD as string | undefined)?.trim() || "admin UK";
      if (password === expected) {
        sessionStorage.setItem(DEV_SESSION_KEY, "1");
        markAdminUkUatActive();
        return;
      }
    }
    throw new Error(typeof data.error === "string" ? data.error : "Verification failed");
  } catch (err) {
    if (import.meta.env.DEV) {
      const expected =
        (import.meta.env.VITE_ADMIN_UK_PASSWORD as string | undefined)?.trim() || "admin UK";
      if (password === expected) {
        sessionStorage.setItem(DEV_SESSION_KEY, "1");
        markAdminUkUatActive();
        return;
      }
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function hasAdminUkDevSession(): boolean {
  if (!import.meta.env.DEV) return false;
  return sessionStorage.getItem(DEV_SESSION_KEY) === "1";
}

export async function checkAdminUkSession(): Promise<boolean> {
  if (import.meta.env.DEV && hasAdminUkDevSession()) {
    markAdminUkUatActive();
    return true;
  }
  try {
    const res = await fetch(apiUrl("/api/admin-uk/session"), {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    if (data.ok === true) {
      markAdminUkUatActive();
      return true;
    }
    return false;
  } catch {
    return import.meta.env.DEV && hasAdminUkDevSession();
  }
}

export function clearAdminUkDevSession(): void {
  sessionStorage.removeItem(DEV_SESSION_KEY);
  clearAdminUkUatActive();
}

export async function logoutAdminUk(): Promise<void> {
  clearAdminUkDevSession();
  try {
    await fetch(apiUrl("/api/admin-uk/logout"), { method: "POST", credentials: "same-origin" });
  } catch {
    /* ignore */
  }
}
