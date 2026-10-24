import { describe, expect, it } from "vitest";
import { ApiError, errors, toErrorPayload } from "@/lib/errors";
import type { ErrorPayload } from "@/lib/errors";

/**
 * API_SPEC §2 error envelope: every failure maps to { error: { code, message, requestId, ... } }.
 * No stack traces or internal messages ever reach the wire (FR-013, SECURITY).
 */

const REQUEST_ID = "req-test-42";

function payloadOf(err: unknown): { status: number; body: ErrorPayload } {
  return toErrorPayload(err, REQUEST_ID);
}

describe("toErrorPayload — ApiError mapping", () => {
  it("validation error → 400 VALIDATION_ERROR with details and requestId", () => {
    const err = errors.validation([{ path: "name", issue: "Required." }], "Invalid item.");
    const { status, body } = payloadOf(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid item.");
    expect(body.error.details).toEqual([{ path: "name", issue: "Required." }]);
    expect(body.error.requestId).toBe(REQUEST_ID);
  });

  it("unauthenticated → 401 UNAUTHENTICATED", () => {
    const { status, body } = payloadOf(errors.unauthenticated());
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.requestId).toBe(REQUEST_ID);
  });

  it("rate limited → 429 RATE_LIMITED including retryAfter", () => {
    const { status, body } = payloadOf(errors.rateLimited(30));
    expect(status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect((body.error as Record<string, unknown>).retryAfter).toBe(30);
    expect(body.error.requestId).toBe(REQUEST_ID);
  });

  it("AI unavailable with a fallback → 503 with the fallback key present", () => {
    const fallback = { results: [{ id: "a91d", name: "Motorcycle keys" }] };
    const { status, body } = payloadOf(errors.aiUnavailable(fallback));
    expect(status).toBe(503);
    expect(body.error.code).toBe("AI_UNAVAILABLE");
    expect(body.error).toHaveProperty("fallback");
    expect((body.error as Record<string, unknown>).fallback).toEqual(fallback);
    expect(body.error.requestId).toBe(REQUEST_ID);
  });

  it("AI unavailable without a fallback omits the fallback key", () => {
    const { status, body } = payloadOf(errors.aiUnavailable());
    expect(status).toBe(503);
    expect(body.error).not.toHaveProperty("fallback");
  });

  it("not found → 404 with a message naming the resource", () => {
    const { status, body } = payloadOf(errors.notFound("Item"));
    expect(status).toBe(404);
    expect(body.error.message).toBe("Item tidak ditemukan.");
  });

  it("conflict → 409 with extra payload fields spread onto the envelope", () => {
    const { status, body } = payloadOf(errors.conflict("Duplicate sibling.", { referencedByItems: 2 }));
    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect((body.error as Record<string, unknown>).referencedByItems).toBe(2);
  });
});

describe("toErrorPayload — unknown errors never leak internals", () => {
  it("an arbitrary Error → 500 INTERNAL with a generic message", () => {
    const { status, body } = payloadOf(new Error("boom: connection to postgres failed"));
    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBe("Terjadi kesalahan di sisi kami.");
  });

  it("the original message does not appear anywhere in the envelope", () => {
    const { body } = payloadOf(new Error("boom"));
    expect(body.error.message).not.toContain("boom");
    expect(JSON.stringify(body)).not.toContain("boom");
  });

  it("no stack trace fields reach the wire", () => {
    const { body } = payloadOf(new Error("boom"));
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(body.error).not.toHaveProperty("stack");
  });

  it("non-Error thrown values are handled too", () => {
    const { status, body } = payloadOf("just a string");
    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
  });
});

describe("toErrorPayload — requestId is always echoed", () => {
  it("every payload (ApiError-derived and unknown) carries the same requestId", () => {
    const errs: unknown[] = [
      errors.validation([{ path: "q", issue: "Too short." }]),
      errors.unauthenticated(),
      errors.notFound("Location"),
      errors.conflict("Duplicate sibling."),
      errors.rateLimited(60),
      errors.aiUnavailable({ results: [] }),
      errors.internal(),
      new Error("boom"),
      "string throw",
    ];
    const payloads = errs.map((e) => payloadOf(e));
    expect(payloads).toHaveLength(errs.length);
    for (const { body } of payloads) {
      expect(body.error.requestId).toBe(REQUEST_ID);
      expect(typeof body.error.code).toBe("string");
      expect(typeof body.error.message).toBe("string");
    }
  });

  it("different requestIds are echoed verbatim per call", () => {
    expect(payloadOf(errors.internal()).body.error.requestId).toBe(REQUEST_ID);
    expect(toErrorPayload(errors.internal(), "req-other").body.error.requestId).toBe("req-other");
  });
});

describe("ApiError class invariants", () => {
  it("maps every code to its documented status", () => {
    expect(new ApiError("VALIDATION_ERROR", "m").status).toBe(400);
    expect(new ApiError("UNAUTHENTICATED", "m").status).toBe(401);
    expect(new ApiError("NOT_FOUND", "m").status).toBe(404);
    expect(new ApiError("CONFLICT", "m").status).toBe(409);
    expect(new ApiError("PAYLOAD_TOO_LARGE", "m").status).toBe(413);
    expect(new ApiError("RATE_LIMITED", "m").status).toBe(429);
    expect(new ApiError("AI_UNAVAILABLE", "m").status).toBe(503);
    expect(new ApiError("INTERNAL", "m").status).toBe(500);
  });

  it("ApiError instances stay identifiable as errors", () => {
    const err = new ApiError("INTERNAL", "m");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(toErrorPayload(err, REQUEST_ID).status).toBe(500);
  });
});
