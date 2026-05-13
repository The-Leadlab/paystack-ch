import { auth } from "./firebase";

type GeminiGenerateRequest = {
  model: string;
  contents: unknown;
  config?: unknown;
};

type GeminiGenerateResponse = {
  text: string;
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "";
}

export async function generateGeminiContent(body: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in before using AI document analysis.");
  }

  const token = await user.getIdToken();
  const res = await fetch(`${apiBase()}/api/gemini/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!res.ok) {
    throw new Error(json?.error || "AI request failed");
  }

  return { text: json?.text || "" };
}
