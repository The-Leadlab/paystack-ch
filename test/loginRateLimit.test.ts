import { describe, expect, it } from "vitest";
import { createPasswordAttemptLimiter } from "../lib/loginRateLimit.js";

describe("loginRateLimit", () => {
  it("locks after too many failures and unlocks after the lock window", () => {
    const limiter = createPasswordAttemptLimiter({
      maxFailures: 3,
      windowMs: 60_000,
      lockMs: 10_000,
    });
    const t0 = 1_000_000;
    expect(limiter.recordFailure("ip", t0).ok).toBe(true);
    expect(limiter.recordFailure("ip", t0 + 10).ok).toBe(true);
    const locked = limiter.recordFailure("ip", t0 + 20);
    expect(locked.ok).toBe(false);
    if (locked.ok) throw new Error("expected lock");
    expect(locked.retryAfterSec).toBeGreaterThan(0);
    expect(limiter.check("ip", t0 + 5000).ok).toBe(false);
    expect(limiter.check("ip", t0 + 11_000).ok).toBe(true);
  });

  it("clears failures after a successful login", () => {
    const limiter = createPasswordAttemptLimiter({ maxFailures: 2, windowMs: 60_000, lockMs: 60_000 });
    limiter.recordFailure("ip", 1);
    limiter.recordSuccess("ip");
    expect(limiter.check("ip", 2).ok).toBe(true);
    expect(limiter.recordFailure("ip", 3).ok).toBe(true);
  });
});
