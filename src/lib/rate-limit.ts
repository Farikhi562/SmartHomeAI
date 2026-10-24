import { errors } from "@/lib/errors";
import { getEnv } from "@/lib/config/env";

/**
 * In-memory per-user token-bucket rate limiter (API_SPEC §1).
 * Best-effort on multi-instance hosting (documented limitation, SYSTEM_ARCHITECTURE §5).
 */

type Bucket = { tokens: number; lastRefill: number; dayCount: number; dayStart: number };

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

export type RateClass = "assistant" | "writes" | "reads";

function configFor(rateClass: RateClass): { perMin: number } {
  const env = getEnv();
  switch (rateClass) {
    case "assistant":
      return { perMin: env.RATE_LIMIT_ASSISTANT_PER_MIN };
    case "writes":
      return { perMin: env.RATE_LIMIT_WRITES_PER_MIN };
    case "reads":
      return { perMin: env.RATE_LIMIT_READS_PER_MIN };
  }
}

function getBucket(key: string, perMin: number, now: number): Bucket {
  let b = buckets.get(key);
  if (!b) {
    // New bucket starts FULL so the first N requests of each window pass.
    // `now` is the caller's already-captured timestamp: stamping with a fresh
    // Date.now() here would make the first refill window negative (env parsing
    // between the two calls can take >1 ms), leaving a fractional deficit that
    // trips `tokens < 1` one request early.
    b = { tokens: perMin, lastRefill: now, dayCount: 0, dayStart: now };
    buckets.set(key, b);
  }
  return b;
}

/**
 * Consume one token. Throws ApiError(429) when limited.
 * `dailyCap` additionally enforces BR-12 for the assistant class.
 */
export function consumeRate(userId: string, rateClass: RateClass, dailyCap?: number): void {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    for (const [k, b] of buckets) if (now - b.lastRefill > 60 * 60_000) buckets.delete(k);
    lastCleanup = now;
  }
  const { perMin } = configFor(rateClass);
  const b = getBucket(`${rateClass}:${userId}`, perMin, now);
  // Refill: 1 token per (60_000 / perMin) ms, capped at perMin.
  const elapsed = now - b.lastRefill;
  b.tokens = Math.min(perMin, b.tokens + (elapsed * perMin) / 60_000);
  b.lastRefill = now;
  if (now - b.dayStart > 24 * 60 * 60_000) {
    b.dayStart = now;
    b.dayCount = 0;
  }
  if (dailyCap !== undefined && rateClass === "assistant" && b.dayCount >= dailyCap) {
    throw errors.rateLimited(3600);
  }
  if (b.tokens < 1) {
    const retryAfter = Math.ceil((1 - b.tokens) * (60_000 / perMin) / 1000);
    throw errors.rateLimited(Math.max(1, retryAfter));
  }
  b.tokens -= 1;
  if (rateClass === "assistant") b.dayCount += 1;
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
