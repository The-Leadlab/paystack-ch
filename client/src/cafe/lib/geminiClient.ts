import { auth } from "./firebase";
import { apiUrl } from "@/lib/apiBase";
import { postGeminiApi } from "./geminiApiFetch";
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

export async function generateGeminiContent(
  body: GeminiGenerateRequest,
  options?: { signal?: AbortSignal }
): Promise<GeminiGenerateResponse> {
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

  const json = await postGeminiApi<{ text?: string; error?: string }>({
    url: apiUrl("/api/gemini/generate"),
    token,
    body,
    signal: options?.signal,
  });

  return { text: json?.text || "" };
}

/** Send only metadata + prompt; server fetches the file from Firebase Storage and calls Gemini. */
export async function generateGeminiContentFromStorage(
  body: GeminiStorageBackedRequest,
  options?: { signal?: AbortSignal }
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

  const json = await postGeminiApi<{ text?: string; error?: string }>({
    url: apiUrl("/api/gemini/generate-from-storage"),
    token,
    body,
    signal: options?.signal,
  });

  return { text: json?.text || "" };
}
