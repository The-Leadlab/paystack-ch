import { apiUrl } from "@/lib/apiBase";
import { auth } from "./firebase";

export type HmrcMtdStatus = {
  connected: boolean;
  needsReconnect: boolean;
  vrn: string | null;
};

async function authHeader(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in before connecting HMRC MTD.");
  try {
    return `Bearer ${await user.getIdToken()}`;
  } catch {
    throw new Error("Session expired. Sign out and sign in again, then retry.");
  }
}

export async function fetchHmrcStatus(): Promise<HmrcMtdStatus> {
  const res = await fetch(apiUrl("/api/hmrc/oauth/status"), {
    headers: { Authorization: await authHeader() },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (HTTP ${res.status})`);
  return {
    connected: Boolean(json.connected),
    needsReconnect: Boolean(json.needsReconnect),
    vrn: typeof json.vrn === "string" ? json.vrn : null,
  };
}

/** Redirects the browser to HMRC's consent screen — does not return on success. */
export async function connectHmrc(opts?: { returnPath?: string }): Promise<void> {
  const res = await fetch(apiUrl("/api/hmrc/oauth/start"), {
    method: "POST",
    headers: {
      Authorization: await authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(opts?.returnPath ? { returnPath: opts.returnPath } : {}),
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || typeof json.redirectUrl !== "string") {
    throw new Error(json?.error || "Could not start the HMRC MTD connection.");
  }
  window.location.href = json.redirectUrl;
}

export async function disconnectHmrc(): Promise<void> {
  const res = await fetch(apiUrl("/api/hmrc/oauth/disconnect"), {
    method: "POST",
    headers: { Authorization: await authHeader() },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not disconnect HMRC MTD.");
}
