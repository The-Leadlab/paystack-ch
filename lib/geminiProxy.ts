import { GoogleGenAI } from "@google/genai";
import type { HeaderMap } from "./stripeBilling.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";

type GeminiGenerateRequest = {
  model?: unknown;
  contents?: unknown;
  config?: unknown;
};

type GeminiProxyResult = {
  status: number;
  json: Record<string, unknown>;
};

const MAX_BODY_BYTES = Number(process.env.GEMINI_MAX_REQUEST_BYTES || 18 * 1024 * 1024);
const RATE_LIMIT_WINDOW_MS = Number(process.env.GEMINI_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.GEMINI_RATE_LIMIT_MAX || 30);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allowedModels(): Set<string> {
  const configured = (process.env.GEMINI_ALLOWED_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : ["gemini-2.5-flash", "gemini-2.5-flash-image"]);
}

function resolveApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }
  return key;
}

function consumeRateLimit(uid: string, ip: string | undefined): boolean {
  const key = `${uid}:${ip || "unknown"}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function estimateJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return MAX_BODY_BYTES + 1;
  }
}

function extractGoogleApiMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const j = JSON.parse(raw.slice(jsonStart)) as { error?: { message?: string; code?: number } };
      if (typeof j?.error?.message === "string") return j.error.message;
    } catch {
      /* ignore */
    }
  }
  return raw;
}

function toClientError(error: unknown): GeminiProxyResult {
  const err = error as { status?: number; message?: string };
  const googleMsg = extractGoogleApiMessage(error);
  const rawMsg = err.message || googleMsg || "Gemini request rejected";

  if (
    /FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_WEB_API_KEY|GEMINI_API_KEY is not configured/i.test(
      rawMsg
    )
  ) {
    return { status: 503, json: { error: rawMsg } };
  }

  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 502;
  return {
    status,
    json: {
      error: status === 502 ? `Gemini API error: ${googleMsg}` : rawMsg,
    },
  };
}

export async function runGeminiGenerate(
  authorization: string | undefined,
  body: GeminiGenerateRequest,
  headers: HeaderMap = {}
): Promise<GeminiProxyResult> {
  try {
    const uid = await verifyFirebaseAuthorizationHeader(authorization);
    const ip =
      normalizeHeader(headers["x-forwarded-for"])?.split(",")[0]?.trim() ||
      normalizeHeader(headers["x-real-ip"]);

    if (!consumeRateLimit(uid, ip)) {
      return { status: 429, json: { error: "Too many AI requests. Please wait and try again." } };
    }

    if (!body || typeof body !== "object") {
      return { status: 400, json: { error: "Invalid Gemini request body" } };
    }
    if (estimateJsonBytes(body) > MAX_BODY_BYTES) {
      return { status: 413, json: { error: "Document is too large for secure processing" } };
    }

    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (!model || !allowedModels().has(model)) {
      return { status: 400, json: { error: "Gemini model is not allowed for this app" } };
    }
    if (!body.contents) {
      return { status: 400, json: { error: "Gemini contents are required" } };
    }

    const ai = new GoogleGenAI({ apiKey: resolveApiKey() });
    const response = await ai.models.generateContent({
      model,
      contents: body.contents as never,
      config: body.config as never,
    });

    return {
      status: 200,
      json: {
        text: response.text ?? "",
      },
    };
  } catch (error) {
    const msg = extractGoogleApiMessage(error);
    console.error("[gemini] proxy error:", msg);
    if (/timed out|timeout|DEADLINE_EXCEEDED/i.test(msg)) {
      return {
        status: 504,
        json: {
          error:
            "Gemini processing timed out. Retry with a smaller file or fewer pages — large PDFs can take several minutes.",
        },
      };
    }
    return toClientError(error);
  }
}
