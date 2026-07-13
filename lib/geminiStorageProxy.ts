import { GoogleGenAI } from "@google/genai";
import { runGeminiGenerate, type GeminiProxyResult } from "./geminiProxy.js";
import {
  buildGeminiContentsWithDocument,
  deleteGeminiFileQuietly,
} from "./geminiDocumentParts.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";
import type { HeaderMap } from "./stripeBilling.js";
import {
  isAllowedFirebaseStorageUrl,
  readStorageFileForUser,
} from "./firebaseStorageAdmin.js";
import {
  MAX_GEMINI_ANALYSIS_BYTES,
  formatMegabytes,
} from "../shared/geminiLimits.js";

const MAX_FETCH_BYTES = Number(
  process.env.GEMINI_MAX_ANALYSIS_BYTES || MAX_GEMINI_ANALYSIS_BYTES
);

export type GeminiGenerateFromStorageRequest = {
  model?: unknown;
  storagePath?: unknown;
  fileUrl?: unknown;
  mimeType?: unknown;
  contents?: unknown;
  config?: unknown;
};

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function enforceMaxBytes(bytes: Buffer): void {
  if (bytes.byteLength > MAX_FETCH_BYTES) {
    throw Object.assign(
      new Error(
        `This file is ${formatMegabytes(bytes.byteLength)} MB. AI analysis supports up to ${formatMegabytes(MAX_FETCH_BYTES)} MB per Google Gemini — compress or split the PDF. The file remains stored.`
      ),
      { status: 413 }
    );
  }
}

function resolveApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured on the server");
  return key;
}

export async function runGeminiGenerateFromStorage(
  authorization: string | undefined,
  body: GeminiGenerateFromStorageRequest,
  headers: HeaderMap = {}
): Promise<GeminiProxyResult> {
  try {
    const uid = await verifyFirebaseAuthorizationHeader(authorization);
    void normalizeHeader(headers["x-forwarded-for"]);

    if (!body || typeof body !== "object") {
      return { status: 400, json: { error: "Invalid request body" } };
    }

    const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (!storagePath || !fileUrl) {
      return { status: 400, json: { error: "storagePath and fileUrl are required" } };
    }

    if (!isAllowedFirebaseStorageUrl(fileUrl, uid)) {
      return { status: 403, json: { error: "fileUrl is not allowed for this account" } };
    }

    const { bytes, mimeType: fetchedMime } = await readStorageFileForUser(uid, storagePath, fileUrl);
    enforceMaxBytes(bytes);
    const mimeType =
      (typeof body.mimeType === "string" && body.mimeType.trim()) || fetchedMime || "application/octet-stream";

    const ai = new GoogleGenAI({ apiKey: resolveApiKey() });
    const { contents: mergedContents, geminiFileToDelete } = await buildGeminiContentsWithDocument(
      ai,
      bytes,
      mimeType,
      body.contents
    );

    try {
      return await runGeminiGenerate(
        authorization,
        {
          model: body.model,
          contents: mergedContents,
          config: body.config,
        },
        headers,
        { allowLargeDocumentPayload: true }
      );
    } finally {
      await deleteGeminiFileQuietly(ai, geminiFileToDelete);
    }
  } catch (error) {
    const err = error as { status?: number; message?: string };
    const status = typeof err.status === "number" ? err.status : 502;
    return { status, json: { error: err.message || "Storage-backed AI request failed" } };
  }
}
