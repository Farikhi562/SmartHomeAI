import { describe, expect, it } from "vitest";
import { LlmHttpError, backoffMs, shouldRetry } from "@/lib/providers/llm/types";

/**
 * FR-013 retry policy: retry only on 429 / 5xx / network errors, bounded attempts,
 * exponential backoff with jitter. Pure functions — no timers, no network.
 */

const NETWORK_ERROR = new Error("connect ECONNRESET"); // no .status → transport failure

describe("shouldRetry (bounded, status-aware retry)", () => {
  it("429 (rate limited) is retried", () => {
    expect(shouldRetry(new LlmHttpError(429, "rate limited"), 0, 2)).toBe(true);
  });

  it("500 (server error) is retried", () => {
    expect(shouldRetry(new LlmHttpError(500, "internal"), 0, 2)).toBe(true);
  });

  it("503 (provider unavailable) is retried", () => {
    expect(shouldRetry(new LlmHttpError(503, "unavailable"), 1, 3)).toBe(true);
  });

  it("400 (bad request) is NOT retried", () => {
    expect(shouldRetry(new LlmHttpError(400, "bad request"), 0, 2)).toBe(false);
  });

  it("401 (auth failure) is NOT retried", () => {
    expect(shouldRetry(new LlmHttpError(401, "unauthorized"), 0, 2)).toBe(false);
  });

  it("network errors (no status) are retried", () => {
    expect(shouldRetry(NETWORK_ERROR, 0, 2)).toBe(true);
    expect(shouldRetry(null, 0, 2)).toBe(true);
  });

  it("attempt count at or above maxRetries stops retries regardless of error", () => {
    expect(shouldRetry(new LlmHttpError(429, "rate limited"), 2, 2)).toBe(false);
    expect(shouldRetry(new LlmHttpError(500, "internal"), 3, 3)).toBe(false);
    expect(shouldRetry(NETWORK_ERROR, 5, 5)).toBe(false);
  });

  it("attempts below maxRetries still retry 429/5xx", () => {
    expect(shouldRetry(new LlmHttpError(429, "rate limited"), 1, 2)).toBe(true);
  });
});

describe("backoffMs (exponential base with bounded jitter)", () => {
  it("attempt 0 lands in [250, 350)", () => {
    for (let i = 0; i < 25; i++) {
      const delay = backoffMs(0);
      expect(delay).toBeGreaterThanOrEqual(250);
      expect(delay).toBeLessThan(350);
    }
  });

  it("attempt 1 lands in [500, 600)", () => {
    for (let i = 0; i < 25; i++) {
      const delay = backoffMs(1);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThan(600);
    }
  });

  it("attempt 2 lands in [1000, 1100)", () => {
    for (let i = 0; i < 25; i++) {
      const delay = backoffMs(2);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1100);
    }
  });

  it("increases monotonically across attempts (jitter cannot invert the order)", () => {
    for (let i = 0; i < 10; i++) {
      expect(backoffMs(0)).toBeLessThan(backoffMs(1));
      expect(backoffMs(1)).toBeLessThan(backoffMs(2));
    }
  });
});

describe("LlmHttpError", () => {
  it("carries the HTTP status and an Error identity", () => {
    const err = new LlmHttpError(503, "Groq unavailable");
    expect(err.status).toBe(503);
    expect(err.name).toBe("LlmHttpError");
    expect(err.message).toBe("Groq unavailable");
    expect(err).toBeInstanceOf(Error);
  });

  it("a 429 LlmHttpError is classified as retry-worthy by shouldRetry", () => {
    expect(shouldRetry(new LlmHttpError(429, "slow down"), 0, 2)).toBe(true);
  });
});
