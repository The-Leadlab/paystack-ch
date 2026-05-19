import { auth } from "./firebase";
import { apiUrl } from "@/lib/apiBase";
import { MAX_GEMINI_PROXY_BODY_BYTES } from "./prepareDocumentForAi";

type GeminiGenerateRequest = {
  model: string;
  contents: unknown;
  config?: unknown;
};

type GeminiGenerateResponse = {
  text: string;
};

export type GeminiStorageBackedRequest = {
  model: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
  contents: unknown;
  config?: unknown;
};

function estimateRequestBytes(body: GeminiGenerateRequest): number {
  try {
    return new Blob([JSON.stringify(body)]).size;
  } catch {
    return 0;
  }
}

export async function generateGeminiContent(body: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in before using AI document analysis.");
  }

  const bytes = estimateRequestBytes(body);
  if (bytes > MAX_GEMINI_PROXY_BODY_BYTES) {
    throw new Error(
      `Document is too large to send for AI analysis (${(bytes / (1024 * 1024)).toFixed(1)} MB). ` +
        "Try a smaller PDF or split the file."
    );
  }

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new Error("Session expired. Sign out and sign in again, then retry.");
  }

  const url = apiUrl("/api/gemini/generate");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const detail = networkErr instanceof Error ? networkErr.message : "Failed to fetch";
    throw new Error(
      `Cannot reach the AI server (${url}). ` +
        "If VITE_API_BASE_URL is set, use the site origin only (https://paystack.ch), not https://paystack.ch/api. " +
        "Also confirm api/gemini is deployed and GEMINI_API_KEY + FIREBASE_WEB_API_KEY are set on Vercel. " +
        `Network: ${detail}`
    );
  }

  const json = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!res.ok) {
    throw new Error(json?.error || `AI request failed (HTTP ${res.status})`);
  }

  return { text: json?.text || "" };
}

/** Send only metadata + prompt; server fetches the file from Firebase Storage and calls Gemini. */
export async function generateGeminiContentFromStorage(
  body: GeminiStorageBackedRequest
): Promise<GeminiGenerateResponse> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in before using AI document analysis.");
  }

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new Error("Session expired. Sign out and sign in again, then retry.");
  }

  const url = apiUrl("/api/gemini/generate-from-storage");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const detail = networkErr instanceof Error ? networkErr.message : "Failed to fetch";
    throw new Error(`Cannot reach the AI server (${url}). Network: ${detail}`);
  }

  const json = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!res.ok) {
    throw new Error(json?.error || `AI request failed (HTTP ${res.status})`);
  }

  return { text: json?.text || "" };
}
