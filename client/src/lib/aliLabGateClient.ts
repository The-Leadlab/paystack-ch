import { apiUrl } from "@/lib/apiBase";

const DEV_SESSION_KEY = "paystack_ali_lab_dev_session";

export async function verifyAliLabPassword(password: string): Promise<void> {
  try {
    const res = await fetch(apiUrl("/api/ali/verify"), {
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
      return;
    }
    if (import.meta.env.DEV) {
      const expected = (import.meta.env.VITE_ALI_LAB_PASSWORD as string | undefined)?.trim();
      if (expected && password === expected) {
        sessionStorage.setItem(DEV_SESSION_KEY, "1");
        return;
      }
    }
    throw new Error(typeof data.error === "string" ? data.error : "Verification failed");
  } catch (err) {
    if (import.meta.env.DEV) {
      const expected = (import.meta.env.VITE_ALI_LAB_PASSWORD as string | undefined)?.trim();
      if (expected && password === expected) {
        sessionStorage.setItem(DEV_SESSION_KEY, "1");
        return;
      }
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Dev-only fallback when Vite does not run Edge middleware. */
export function hasAliLabDevSession(): boolean {
  if (!import.meta.env.DEV) return false;
  return sessionStorage.getItem(DEV_SESSION_KEY) === "1";
}

/**
 * Production: validates HttpOnly cookie via GET /api/ali/session.
 * Dev: sessionStorage after gate, or cookie when using stripe dev server + vercel dev.
 */
export async function checkAliLabSession(): Promise<boolean> {
  if (import.meta.env.DEV && hasAliLabDevSession()) return true;
  try {
    const res = await fetch(apiUrl("/api/ali/session"), {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return import.meta.env.DEV && hasAliLabDevSession();
  }
}

export function clearAliLabDevSession(): void {
  sessionStorage.removeItem(DEV_SESSION_KEY);
}

export async function logoutAliLab(): Promise<void> {
  clearAliLabDevSession();
  try {
    await fetch(apiUrl("/api/ali/logout"), { method: "POST", credentials: "same-origin" });
  } catch {
    /* ignore */
  }
}
