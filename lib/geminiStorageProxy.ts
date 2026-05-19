import { GoogleGenAI } from "@google/genai";
import { runGeminiGenerate, type GeminiProxyResult } from "./geminiProxy.js";
import {
  buildGeminiContentsWithDocument,
  deleteGeminiFileQuietly,
} from "./geminiDocumentParts.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";
import type { HeaderMap } from "./stripeBilling.js";
import { MAX_STORAGE_FETCH_BYTES } from "../shared/geminiLimits.js";

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

function assertOwnedStoragePath(uid: string, storagePath: string): void {
  const normalized = storagePath.replace(/^\/+/, "").trim();
  const prefix = `documents/${uid}/`;
  if (!normalized.startsWith(prefix)) {
    throw Object.assign(new Error("Storage path is not allowed for this account"), { status: 403 });
  }
}

function isAllowedFirebaseStorageUrl(fileUrl: string, uid: string): boolean {
  try {
    const u = new URL(fileUrl);
    if (!/\.googleapis\.com$/i.test(u.hostname) && !u.hostname.includes("firebasestorage")) {
      return false;
    }
    const decoded = decodeURIComponent(`${u.pathname}${u.search}`);
    return decoded.includes(`/documents/${uid}/`) || decoded.includes(`documents%2F${uid}%2F`);
  } catch {
    return false;
  }
}

async function fetchStorageBytes(fileUrl: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const fetchTimeoutMs = Number(process.env.GEMINI_STORAGE_FETCH_TIMEOUT_MS || 120_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
  let res: Response;
  try {
    res = await fetch(fileUrl, { redirect: "follow", cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Could not read file from storage (HTTP ${res.status})`), { status: 502 });
  }
  const lenHeader = res.headers.get("content-length");
  if (lenHeader) {
    const len = Number(lenHeader);
    if (Number.isFinite(len) && len > MAX_STORAGE_FETCH_BYTES) {
      throw Object.assign(
        new Error(
          `File exceeds ${(MAX_STORAGE_FETCH_BYTES / (1024 * 1024)).toFixed(0)} MB limit. Split the PDF or compress it.`
        ),
        { status: 413 }
      );
    }
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_STORAGE_FETCH_BYTES) {
    throw Object.assign(
      new Error(
        `File exceeds ${(MAX_STORAGE_FETCH_BYTES / (1024 * 1024)).toFixed(0)} MB limit. Split the PDF or compress it.`
      ),
      { status: 413 }
    );
  }
  const mimeType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  return { bytes: Buffer.from(arrayBuffer), mimeType };
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

    assertOwnedStoragePath(uid, storagePath);
    if (!isAllowedFirebaseStorageUrl(fileUrl, uid)) {
      return { status: 403, json: { error: "fileUrl is not allowed for this account" } };
    }

    const { bytes, mimeType: fetchedMime } = await fetchStorageBytes(fileUrl);
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
