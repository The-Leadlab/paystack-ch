function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

function apiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";
  if (!configured || typeof window === "undefined") return configured;
  try {
    const configuredUrl = new URL(configured);
    const currentUrl = new URL(window.location.origin);
    const sameApex =
      configuredUrl.protocol === currentUrl.protocol &&
      stripWww(configuredUrl.hostname) === stripWww(currentUrl.hostname);
    return sameApex ? "" : configured;
  } catch {
    return configured;
  }
}

export async function verifyAdminPassword(password: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/admin/verify`, {
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
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Verification failed");
  }
  if (data.ok !== true) {
    throw new Error("Verification failed");
  }
}

export async function logoutAdmin(): Promise<void> {
  const res = await fetch(`${apiBase()}/api/admin/logout`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) {
    let msg = "Logout failed";
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === "string") msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}
