import { GoogleGenAI } from "@google/genai";
import { GEMINI_INLINE_DOCUMENT_MAX_BYTES } from "../shared/geminiLimits.js";

function extractTextParts(contents: unknown): unknown[] {
  if (contents && typeof contents === "object" && Array.isArray((contents as { parts?: unknown }).parts)) {
    return ((contents as { parts: unknown[] }).parts as unknown[]).filter((p) => {
      if (!p || typeof p !== "object") return true;
      const part = p as Record<string, unknown>;
      return !("inlineData" in part) && !("fileData" in part);
    });
  }
  if (typeof contents === "string") return [{ text: contents }];
  return [{ text: "Analyze this document." }];
}

export function contentsUsesGeminiFileApi(contents: unknown): boolean {
  const parts =
    contents && typeof contents === "object" && Array.isArray((contents as { parts?: unknown }).parts)
      ? ((contents as { parts: unknown[] }).parts as unknown[])
      : [];
  return parts.some((p) => p && typeof p === "object" && "fileData" in (p as Record<string, unknown>));
}

function mergeInlineBase64(contents: unknown, mimeType: string, base64: string): unknown {
  const textParts = extractTextParts(contents);
  return {
    ...(typeof contents === "object" && contents !== null && !Array.isArray(contents) ? contents : {}),
    parts: [{ inlineData: { mimeType, data: base64 } }, ...textParts],
  };
}

async function waitForGeminiFileReady(ai: GoogleGenAI, name: string): Promise<{ uri: string; mimeType: string }> {
  const deadline = Date.now() + 180_000;
  let file = await ai.files.get({ name });
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name });
  }
  if (file.state !== "ACTIVE" || !file.uri) {
    throw new Error(
      file.state === "FAILED"
        ? "Gemini could not prepare this PDF for analysis. Try a smaller export or split the file."
        : `Gemini file not ready (state=${file.state || "unknown"})`
    );
  }
  return { uri: file.uri, mimeType: file.mimeType || "application/pdf" };
}

/**
 * Attach a document to Gemini contents — inline for small files, Files API for large PDFs/images.
 * Returns merged contents and optional Gemini file name to delete after generateContent.
 */
export async function buildGeminiContentsWithDocument(
  ai: GoogleGenAI,
  bytes: Buffer,
  mimeType: string,
  contents: unknown
): Promise<{ contents: unknown; geminiFileToDelete?: string }> {
  if (bytes.length <= GEMINI_INLINE_DOCUMENT_MAX_BYTES) {
    return {
      contents: mergeInlineBase64(contents, mimeType, bytes.toString("base64")),
    };
  }

  const blob = new Blob([bytes], { type: mimeType });
  const uploaded = await ai.files.upload({
    file: blob,
    config: {
      mimeType,
      displayName: "paystack-document",
    },
  });

  if (!uploaded.name) {
    throw new Error("Gemini file upload did not return a file name");
  }

  const ready = await waitForGeminiFileReady(ai, uploaded.name);
  const textParts = extractTextParts(contents);

  return {
    contents: {
      ...(typeof contents === "object" && contents !== null && !Array.isArray(contents) ? contents : {}),
      parts: [{ fileData: { fileUri: ready.uri, mimeType: ready.mimeType } }, ...textParts],
    },
    geminiFileToDelete: uploaded.name,
  };
}

export async function deleteGeminiFileQuietly(ai: GoogleGenAI, name: string | undefined): Promise<void> {
  if (!name) return;
  try {
    await ai.files.delete({ name });
  } catch (error) {
    console.warn("[gemini] could not delete temp file:", error instanceof Error ? error.message : String(error));
  }
}
