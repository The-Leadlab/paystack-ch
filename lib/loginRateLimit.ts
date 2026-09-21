/**
 * In-memory password-attempt limiter for operator / lab gates.
 * Serverless instances do not share this map; it still stops local and
 * single-instance brute force (the 9-minute admin-page crack).
 */

export type PasswordAttemptLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; error: string };

type Bucket = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
};

export type PasswordAttemptLimiter = {
  check: (key: string, now?: number) => PasswordAttemptLimitResult;
  recordFailure: (key: string, now?: number) => PasswordAttemptLimitResult;
  recordSuccess: (key: string) => void;
};

export function createPasswordAttemptLimiter(opts?: {
  maxFailures?: number;
  windowMs?: number;
  lockMs?: number;
}): PasswordAttemptLimiter {
  const maxFailures = opts?.maxFailures ?? 5;
  const windowMs = opts?.windowMs ?? 15 * 60 * 1000;
  const lockMs = opts?.lockMs ?? 15 * 60 * 1000;
  const buckets = new Map<string, Bucket>();

  const prune = (key: string, now: number) => {
    const bucket = buckets.get(key);
    if (!bucket) return;
    if (bucket.lockedUntil && bucket.lockedUntil <= now && now - bucket.windowStartedAt > windowMs) {
      buckets.delete(key);
    }
  };

  const locked = (bucket: Bucket, now: number): PasswordAttemptLimitResult | null => {
    if (bucket.lockedUntil > now) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000));
      return {
        ok: false,
        retryAfterSec,
        error: `Too many attempts. Try again in ${retryAfterSec}s.`,
      };
    }
    return null;
  };

  return {
    check(key: string, now = Date.now()): PasswordAttemptLimitResult {
      prune(key, now);
      const bucket = buckets.get(key);
      if (!bucket) return { ok: true };
      return locked(bucket, now) ?? { ok: true };
    },

    recordFailure(key: string, now = Date.now()): PasswordAttemptLimitResult {
      prune(key, now);
      let bucket = buckets.get(key);
      if (!bucket || now - bucket.windowStartedAt > windowMs) {
        bucket = { failures: 0, windowStartedAt: now, lockedUntil: 0 };
      }
      const alreadyLocked = locked(bucket, now);
      if (alreadyLocked) {
        buckets.set(key, bucket);
        return alreadyLocked;
      }
      bucket.failures += 1;
      if (bucket.failures >= maxFailures) {
        bucket.lockedUntil = now + lockMs;
      }
      buckets.set(key, bucket);
      return locked(bucket, now) ?? { ok: true };
    },

    recordSuccess(key: string): void {
      buckets.delete(key);
    },
  };
}

export const passwordGateLimiter = createPasswordAttemptLimiter();

export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): string {
  const raw = headers?.["x-forwarded-for"] ?? headers?.["x-real-ip"] ?? headers?.["cf-connecting-ip"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}
