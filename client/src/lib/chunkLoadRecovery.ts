/**
 * Recover from stale Vite lazy chunks after a deploy.
 *
 * Open tabs keep an old index.html that references hashed assets
 * (e.g. PlatformPage-DSzaXsWA.js). After a new build those files 404 →
 * "Failed to fetch dynamically imported module". Reload once to pick up
 * the fresh shell; guard so a broken deploy cannot reload-loop.
 */

const RELOAD_AT_KEY = "paystack:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 15_000;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String((error as { message?: string }).message || error);
  return CHUNK_ERROR_RE.test(message);
}

function readLastReloadAt(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_AT_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

function markReloadAttempt(): void {
  try {
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  } catch {
    /* private mode / blocked storage */
  }
}

/** Returns true if a reload was scheduled. */
export function tryRecoverFromChunkError(error?: unknown): boolean {
  if (error != null && !isChunkLoadError(error)) return false;
  const last = readLastReloadAt();
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
  markReloadAttempt();
  window.location.reload();
  return true;
}

/**
 * Vite fires `vite:preloadError` when a dynamic import / preload fails.
 * Call before React mounts so route lazy() failures recover immediately.
 */
export function installViteChunkLoadRecovery(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", ((event: Event) => {
    const preloadEvent = event as Event & {
      payload?: unknown;
      preventDefault: () => void;
    };
    const payload = preloadEvent.payload;
    if (payload != null && !isChunkLoadError(payload)) return;
    if (tryRecoverFromChunkError(payload ?? new Error("vite:preloadError"))) {
      preloadEvent.preventDefault();
    }
  }) as EventListener);
}

/**
 * React.lazy factory wrapper: one in-memory retry, then hard reload once.
 */
export function retryingImport<T>(factory: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await factory();
    } catch (first) {
      if (!isChunkLoadError(first)) throw first;
      // Brief pause — CDN / edge may still be propagating the new build.
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await factory();
      } catch (second) {
        if (tryRecoverFromChunkError(second)) {
          // Hang until the page unloads so React.lazy does not surface the error UI.
          return new Promise<T>(() => undefined);
        }
        throw second;
      }
    }
  };
}
