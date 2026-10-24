import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRate, resetRateLimits } from "@/lib/rate-limit";
import { ApiError } from "@/lib/errors";

/**
 * BR-12 / API_SPEC §1: per-user token buckets — reads 120/min, writes 60/min,
 * assistant 20/min + caller-supplied daily cap (BR-12: 100/day in production).
 *
 * QA NOTE (from reading src/lib/rate-limit.ts, not from running it): getBucket()
 * seeds new buckets with `tokens: 0` and the first call's refill window is ~0 ms,
 * so if the very first consume below fails, the fix belongs in the bucket
 * initialization (seed full at perMin), not in these tests — the tests encode the
 * specified behavior: a fresh user starts with a full per-minute bucket.
 *
 * Time-based token refill is intentionally NOT exercised: the module has no clock
 * injection and wall-clock sleeps are forbidden in this suite.
 */

beforeEach(() => {
  vi.unstubAllEnvs();
  // Pin documented defaults before the statically imported module's first getEnv()
  // call caches them, so ambient CI env vars cannot skew the static-instance tests.
  vi.stubEnv("RATE_LIMIT_ASSISTANT_PER_MIN", "20");
  vi.stubEnv("RATE_LIMIT_WRITES_PER_MIN", "60");
  vi.stubEnv("RATE_LIMIT_READS_PER_MIN", "120");
  resetRateLimits();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function caught(fn: () => void): unknown {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e;
  }
}

describe("reads class (default cap 120/min, BR-12 read limit)", () => {
  it("120 consecutive reads succeed for a fresh user", () => {
    for (let i = 0; i < 120; i++) {
      consumeRate("userA", "reads");
    }
  });

  it("the 121st read throws RATE_LIMITED with retryAfter ≥ 1", () => {
    for (let i = 0; i < 120; i++) consumeRate("userA", "reads");
    const err = caught(() => consumeRate("userA", "reads"));
    expect(err).toBeInstanceOf(ApiError);
    const api = err as ApiError;
    expect(api.code).toBe("RATE_LIMITED");
    expect(api.status).toBe(429);
    const retryAfter = (api.extra as { retryAfter?: number } | undefined)?.retryAfter;
    expect(typeof retryAfter).toBe("number");
    expect(retryAfter as number).toBeGreaterThanOrEqual(1);
  });
});

describe("assistant class (BR-12: 20/min per user)", () => {
  it("20 assistant calls within the minute succeed; the 21st is limited", () => {
    for (let i = 0; i < 20; i++) consumeRate("userB", "assistant");
    const err = caught(() => consumeRate("userB", "assistant"));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("RATE_LIMITED");
  });

  it("daily cap 3: the first 3 calls pass, the 4th throws even though minute tokens remain", () => {
    for (let i = 0; i < 3; i++) consumeRate("userC", "assistant", 3);
    const err = caught(() => consumeRate("userC", "assistant", 3));
    expect(err).toBeInstanceOf(ApiError);
    const api = err as ApiError;
    expect(api.code).toBe("RATE_LIMITED");
    // The daily branch reports a day-scale retryAfter (3600 s), which cannot come
    // from the per-minute branch (its retryAfter would be ≤ 60 s).
    const retryAfter = (api.extra as { retryAfter?: number } | undefined)?.retryAfter;
    expect(retryAfter).toBe(3600);
  });

  it("without a dailyCap the per-minute bucket alone allows the 4th call", () => {
    consumeRate("userD", "assistant");
    consumeRate("userD", "assistant");
    consumeRate("userD", "assistant");
    expect(() => consumeRate("userD", "assistant")).not.toThrow();
  });
});

describe("per-user and per-class bucket isolation", () => {
  it("exhausting userA's reads does not affect userB's reads", () => {
    const err = caught(() => {
      for (let i = 0; i < 121; i++) consumeRate("isoA", "reads");
    });
    expect(err).toBeInstanceOf(ApiError);
    // userB has its own bucket and is unaffected.
    expect(() => consumeRate("isoB", "reads")).not.toThrow();
  });

  it("exhausting one class does not affect the user's other classes", () => {
    for (let i = 0; i < 121; i++) caught(() => consumeRate("isoA", "reads"));
    // isoA's writes bucket is separate from isoA's reads bucket.
    expect(() => consumeRate("isoA", "writes")).not.toThrow();
  });
});

describe("env-driven caps (vi.stubEnv + vi.resetModules + dynamic import)", () => {
  it("RATE_LIMIT_READS_PER_MIN is honored by a freshly imported module instance", async () => {
    vi.stubEnv("RATE_LIMIT_READS_PER_MIN", "3");
    vi.resetModules();
    const rate = await import("@/lib/rate-limit");
    const errs = await import("@/lib/errors");
    rate.resetRateLimits();
    rate.consumeRate("envReader", "reads");
    rate.consumeRate("envReader", "reads");
    rate.consumeRate("envReader", "reads");
    const err = caught(() => rate.consumeRate("envReader", "reads"));
    expect(err).toBeInstanceOf(errs.ApiError);
    expect((err as InstanceType<typeof errs.ApiError>).code).toBe("RATE_LIMITED");
    vi.unstubAllEnvs();
  });

  it("RATE_LIMIT_ASSISTANT_PER_MIN is honored by a freshly imported module instance", async () => {
    vi.stubEnv("RATE_LIMIT_ASSISTANT_PER_MIN", "5");
    vi.resetModules();
    const rate = await import("@/lib/rate-limit");
    const errs = await import("@/lib/errors");
    rate.resetRateLimits();
    for (let i = 0; i < 5; i++) rate.consumeRate("envAssistant", "assistant");
    const err = caught(() => rate.consumeRate("envAssistant", "assistant"));
    expect(err).toBeInstanceOf(errs.ApiError);
    expect((err as InstanceType<typeof errs.ApiError>).code).toBe("RATE_LIMITED");
    vi.unstubAllEnvs();
  });

  it("resetRateLimits clears buckets so a user starts fresh", async () => {
    for (let i = 0; i < 121; i++) caught(() => consumeRate("resetUser", "reads"));
    resetRateLimits();
    expect(() => consumeRate("resetUser", "reads")).not.toThrow();
  });
});
