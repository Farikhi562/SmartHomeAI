import { describe, expect, it } from "vitest";
import {
  actionDecisionSchema,
  assistantMessageSchema,
  eventCreateSchema,
  itemListQuery,
  itemCreateSchema,
  locationCreateSchema,
  paginationQuery,
  searchQuery,
} from "@/lib/validation/index";
import type { z } from "zod";

/**
 * Shared request-validation schemas (API_SPEC §5 / SYSTEM_ARCHITECTURE §5):
 * field bounds, coercion, and documented defaults. safeParse-only — no I/O.
 */

function firstIssuePath(result: { success: false; error: z.ZodError }): (string | number)[] {
  return result.error.issues[0]?.path ?? [];
}

const UUID = "2b6e0f1a-1111-4222-8333-444455556666";

describe("itemCreateSchema", () => {
  it("rejects an empty name", () => {
    const result = itemCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["name"]);
  });

  it("rejects a whitespace-only name", () => {
    const result = itemCreateSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["name"]);
  });

  it("rejects a 121-character name (max 120)", () => {
    const result = itemCreateSchema.safeParse({ name: "x".repeat(121) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["name"]);
  });

  it("accepts a 120-character name", () => {
    const result = itemCreateSchema.safeParse({ name: "x".repeat(120) });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed locationId", () => {
    const result = itemCreateSchema.safeParse({ name: "Wallet", locationId: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["locationId"]);
  });

  it("accepts a valid create payload", () => {
    const result = itemCreateSchema.safeParse({ name: "Wallet", category: "everyday", locationId: UUID });
    expect(result.success).toBe(true);
  });
});

describe("locationCreateSchema", () => {
  it("rejects an empty name", () => {
    const result = locationCreateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["name"]);
  });

  it("rejects an 81-character name (max 80)", () => {
    const result = locationCreateSchema.safeParse({ name: "x".repeat(81) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["name"]);
  });

  it("accepts a valid create payload", () => {
    const result = locationCreateSchema.safeParse({ name: "Bedroom", parentId: UUID });
    expect(result.success).toBe(true);
  });
});

describe("eventCreateSchema (occurred-at)", () => {
  it("accepts a valid ISO datetime with a Z offset", () => {
    const result = eventCreateSchema.safeParse({ locationId: UUID, occurredAt: "2026-10-15T09:00:00.000Z" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid ISO datetime with an explicit UTC offset", () => {
    const result = eventCreateSchema.safeParse({ locationId: UUID, occurredAt: "2026-10-15T09:00:00+02:00" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-datetime occurredAt", () => {
    const result = eventCreateSchema.safeParse({ locationId: UUID, occurredAt: "yesterday evening" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["occurredAt"]);
  });

  it("rejects a naive datetime without any offset (must state UTC or an offset)", () => {
    const result = eventCreateSchema.safeParse({ locationId: UUID, occurredAt: "2026-10-15T09:00:00" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["occurredAt"]);
  });

  it("locationId is required", () => {
    const result = eventCreateSchema.safeParse({ occurredAt: "2026-10-15T09:00:00.000Z" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["locationId"]);
  });
});

describe("searchQuery", () => {
  it("rejects a 1-character q (min 2)", () => {
    const result = searchQuery.safeParse({ q: "a" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["q"]);
  });

  it("rejects a 201-character q (max 200)", () => {
    const result = searchQuery.safeParse({ q: "a".repeat(201) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["q"]);
  });

  it("applies documented defaults: type 'all', limit 20, offset 0", () => {
    const result = searchQuery.safeParse({ q: "keys" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ q: "keys", type: "all", limit: 20, offset: 0 });
    }
  });
});

describe("itemListQuery", () => {
  it("rejects limit 101 (max 100)", () => {
    const result = itemListQuery.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["limit"]);
  });

  it("coerces string query params ('10' → 10)", () => {
    const result = itemListQuery.safeParse({ limit: "10", offset: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  it("applies defaults: status 'active', sort 'updatedAt', order 'desc', limit 20, offset 0", () => {
    const result = itemListQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.sort).toBe("updatedAt");
      expect(result.data.order).toBe("desc");
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it("rejects an unknown status value", () => {
    const result = itemListQuery.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["status"]);
  });
});

describe("assistantMessageSchema", () => {
  it("rejects a 2001-character message (max 2000)", () => {
    const result = assistantMessageSchema.safeParse({ message: "a".repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["message"]);
  });

  it("rejects an empty message", () => {
    const result = assistantMessageSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["message"]);
  });

  it("rejects a whitespace-only message (trimmed min 1)", () => {
    const result = assistantMessageSchema.safeParse({ message: "  \t " });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["message"]);
  });

  it("accepts a valid message", () => {
    const result = assistantMessageSchema.safeParse({ message: "Where's my wallet?" });
    expect(result.success).toBe(true);
  });
});

describe("actionDecisionSchema", () => {
  it("rejects 'maybe' — only confirm/cancel are decisions", () => {
    const result = actionDecisionSchema.safeParse({ decision: "maybe" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssuePath(result)).toEqual(["decision"]);
  });

  it("accepts confirm with optional overrides", () => {
    const result = actionDecisionSchema.safeParse({
      decision: "confirm",
      overrides: { locationId: UUID, occurredAt: "2026-10-15T09:00:00+02:00" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts cancel alone", () => {
    expect(actionDecisionSchema.safeParse({ decision: "cancel" }).success).toBe(true);
  });
});

describe("paginationQuery defaults", () => {
  it("defaults to limit 20, offset 0", () => {
    const result = paginationQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ limit: 20, offset: 0 });
  });

  it("coerces strings and enforces bounds", () => {
    const coerced = paginationQuery.safeParse({ limit: "30", offset: "10" });
    expect(coerced.success).toBe(true);
    if (coerced.success) expect(coerced.data).toEqual({ limit: 30, offset: 10 });

    const zero = paginationQuery.safeParse({ limit: 0 });
    expect(zero.success).toBe(false);
  });
});
