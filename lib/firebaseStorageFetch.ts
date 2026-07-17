/** Shared helpers for server-side code that fetches a user's own Firebase Storage file
 * (Gemini analysis, Drive sync) — path/URL ownership checks plus a size-capped fetch. */

export function assertOwnedStoragePath(uid: string, storagePath: string): void {
  const normalized = storagePath.replace(/^\/+/, "").trim();
  const prefix = `documents/${uid}/`;
  if (!normalized.startsWith(prefix)) {
    throw Object.assign(new Error("Storage path is not allowed for this account"), { status: 403 });
  }
}

export function isAllowedFirebaseStorageUrl(fileUrl: string, uid: string): boolean {
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

export async function fetchStorageBytes(
  fileUrl: string,
  maxBytes: number
): Promise<{ bytes: Buffer; mimeType: string }> {
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
    if (Number.isFinite(len) && len > maxBytes) {
      throw Object.assign(new Error(`File exceeds the ${maxBytes} byte limit for this operation`), {
        status: 413,
      });
    }
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw Object.assign(new Error(`File exceeds the ${maxBytes} byte limit for this operation`), {
      status: 413,
    });
  }
  const mimeType = (res.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
  return { bytes: Buffer.from(arrayBuffer), mimeType };
}
