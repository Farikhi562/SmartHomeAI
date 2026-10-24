import { describe, expect, it } from "vitest";
import { classificationSchema, pendingActionSchema } from "@/server/assistant/types";

/**
 * FR-024 / BR-02 structured-output contracts: the pending-action proposal persisted
 * on an assistant message, and the classification envelope from the LLM.
 */

const ITEM_UUID = "2b6e0f1a-1111-4222-8333-444455556666";
const LOC_UUID = "3c7f1222-5333-4444-9555-666677778888";

const validPendingAction = {
  id: "pa_01",
  type: "record_location",
  payload: {
    item: { existingId: ITEM_UUID, name: "Wallet" },
    location: { existingId: LOC_UUID, name: "Drawer", path: "Home / Bedroom / Drawer" },
    occurredAt: "2026-10-15T09:00:00.000Z",
    note: "Time assumed UTC",
  },
  expiresAt: "2026-10-16T09:00:00.000Z",
  consumedAt: null,
};

function firstPath(result: { success: false; error: { issues: { path: (string | number)[] }[] } }): (
  string | number
)[] {
  return result.error.issues[0]?.path ?? [];
}

describe("pendingActionSchema — valid proposals", () => {
  it("accepts a full record_location payload", () => {
    const result = pendingActionSchema.safeParse(validPendingAction);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("record_location");
  });

  it("accepts a create_item payload with only a new name (no existing ids)", () => {
    const result = pendingActionSchema.safeParse({
      id: "pa_02",
      type: "create_item",
      payload: {
        item: { name: "Emergency kit" },
        location: { name: "Under the sink", path: "Home / Kitchen / Under the sink" },
        occurredAt: "2026-10-15T09:00:00.000Z",
      },
      expiresAt: "2026-10-16T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("item/location objects are all-optional: an empty item object parses", () => {
    // Actual schema: payload.item's fields are each optional, but the item key itself
    // is required (see the missing-key test below).
    const result = pendingActionSchema.safeParse({
      ...validPendingAction,
      payload: { ...validPendingAction.payload, item: {} },
    });
    expect(result.success).toBe(true);
  });

  it("an item referenced only by existingId parses", () => {
    const result = pendingActionSchema.safeParse({
      ...validPendingAction,
      payload: { ...validPendingAction.payload, item: { existingId: ITEM_UUID } },
    });
    expect(result.success).toBe(true);
  });
});

describe("pendingActionSchema — invalid proposals", () => {
  it("the payload.item key is required even though its fields are all optional", () => {
    // Neither item.name nor item.existingId is required — but omitting the item
    // object entirely fails validation.
    const { item: _item, ...payloadWithoutItem } = validPendingAction.payload;
    const result = pendingActionSchema.safeParse({ ...validPendingAction, payload: payloadWithoutItem });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["payload", "item"]);
  });

  it("a payload with neither location.name nor location.existingId follows the same rule", () => {
    const { location: _location, ...payloadWithoutLocation } = validPendingAction.payload;
    const result = pendingActionSchema.safeParse({ ...validPendingAction, payload: payloadWithoutLocation });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["payload", "location"]);
  });

  it("expiresAt must be a string", () => {
    const result = pendingActionSchema.safeParse({ ...validPendingAction, expiresAt: 123 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["expiresAt"]);
  });

  it("a missing expiresAt fails", () => {
    const { expiresAt: _expiresAt, ...withoutExpiry } = validPendingAction;
    const result = pendingActionSchema.safeParse(withoutExpiry);
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["expiresAt"]);
  });

  it("a missing payload.occurredAt fails", () => {
    const { occurredAt: _occurredAt, ...payloadWithoutTime } = validPendingAction.payload;
    const result = pendingActionSchema.safeParse({
      ...validPendingAction,
      payload: payloadWithoutTime,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["payload", "occurredAt"]);
  });

  it("an unknown type (outside WRITE_ACTIONS) fails", () => {
    const result = pendingActionSchema.safeParse({ ...validPendingAction, type: "delete_everything" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["type"]);
  });

  it("a non-string consumedAt fails (null is allowed)", () => {
    const bad = pendingActionSchema.safeParse({ ...validPendingAction, consumedAt: 42 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(firstPath(bad)).toEqual(["consumedAt"]);

    expect(pendingActionSchema.safeParse({ ...validPendingAction, consumedAt: null }).success).toBe(true);
  });
});

describe("pendingActionSchema — unknown keys are stripped, not rejected", () => {
  it("extra top-level keys are dropped by default (no passthrough required)", () => {
    const result = pendingActionSchema.safeParse({ ...validPendingAction, unexpected: "surprise" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("unexpected");
  });

  it("extra payload keys are dropped too", () => {
    const result = pendingActionSchema.safeParse({
      ...validPendingAction,
      payload: { ...validPendingAction.payload, hack: "x" },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payload).not.toHaveProperty("hack");
  });
});

describe("classificationSchema (LLM classification envelope)", () => {
  const base = { confidence: 0.9, entities: {} };

  it("rejects an intent outside the INTENTS enum", () => {
    const result = classificationSchema.safeParse({ ...base, intent: "wipe_everything" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["intent"]);
  });

  it("accepts every documented intent", () => {
    for (const intent of [
      "lookup_location",
      "list_contents",
      "search_fuzzy",
      "record_memory",
      "correct_record",
      "chit_chat",
      "help",
      "unknown",
    ]) {
      expect(classificationSchema.safeParse({ ...base, intent }).success).toBe(true);
    }
  });

  it("rejects confidence > 1", () => {
    const result = classificationSchema.safeParse({ ...base, intent: "help", confidence: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["confidence"]);
  });

  it("rejects confidence < 0", () => {
    const result = classificationSchema.safeParse({ ...base, intent: "help", confidence: -0.1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["confidence"]);
  });

  it("caps entity arrays at 10 entries: 11 itemNames fail", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `name-${i}`);
    const result = classificationSchema.safeParse({
      intent: "search_fuzzy",
      confidence: 0.7,
      entities: { itemNames: eleven },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["entities", "itemNames"]);
  });

  it("10 entries in an entity array is accepted", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `loc-${i}`);
    const result = classificationSchema.safeParse({
      intent: "search_fuzzy",
      confidence: 0.7,
      entities: { locationPhrases: ten },
    });
    expect(result.success).toBe(true);
  });

  it("caps locationPhrases at 10 too", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `place-${i}`);
    const result = classificationSchema.safeParse({
      intent: "list_contents",
      confidence: 0.7,
      entities: { locationPhrases: eleven },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["entities", "locationPhrases"]);
  });

  it("rejects a proposedAction outside none + WRITE_ACTIONS", () => {
    const result = classificationSchema.safeParse({ ...base, intent: "record_memory", proposedAction: "purge_all" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["proposedAction"]);
  });

  it("applies defaults: entity arrays → [], proposedAction → 'none'", () => {
    const result = classificationSchema.safeParse({ intent: "help", confidence: 0.95, entities: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entities.itemNames).toEqual([]);
      expect(result.data.entities.itemAliases).toEqual([]);
      expect(result.data.entities.locationPhrases).toEqual([]);
      expect(result.data.entities.timeExpressions).toEqual([]);
      expect(result.data.proposedAction).toBe("none");
    }
  });

  it("the entities key itself is required (empty object is fine, missing key is not)", () => {
    const result = classificationSchema.safeParse({ intent: "help", confidence: 0.9 });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["entities"]);
  });

  it("rejects notes longer than 300 characters", () => {
    const result = classificationSchema.safeParse({ ...base, intent: "help", notes: "n".repeat(301) });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstPath(result)).toEqual(["notes"]);
  });
});
