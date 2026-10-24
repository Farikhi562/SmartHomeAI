import { describe, expect, it } from "vitest";
import { CAVEAT_SENTENCE, hasRequiredCaveat, validateGeneration } from "@/server/assistant/grounding";
import { LAST_RECORDED_CAVEAT } from "@/server/rules/events";
import { MAX_TEXT_CHARS } from "@/server/assistant/types";
import type { RetrievedRecord } from "@/server/assistant/types";

/**
 * FR-010 / safety S-1: the model may only reference retrieved records.
 * Unknown citations are stripped; facts on unknown ids are fabrication and
 * reject the answer; empty text is rejected; text is bounded to MAX_TEXT_CHARS.
 */

const retrieved: RetrievedRecord[] = [
  {
    kind: "item",
    id: "a91d",
    name: "Motorcycle keys",
    description: null,
    category: null,
    lastLocationName: "Shelf",
    lastOccurredAt: "2026-10-14T20:30:00.000Z",
  },
  { kind: "location", id: "5c7d", name: "Shelf", path: "Home / Living room / Shelf" },
];

describe("validateGeneration — grounded output accepted", () => {
  it("citations and facts limited to retrieved ids pass with zero stripped citations", () => {
    const raw = {
      text: "Your motorcycle keys were last recorded on the Shelf.",
      citations: [
        { type: "item", id: "a91d" },
        { type: "location", id: "5c7d" },
      ],
      facts: [{ kind: "item", id: "a91d", occurredAt: "2026-10-14T20:30:00.000Z" }],
      inferred: false,
    };
    const result = validateGeneration(raw, retrieved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.strippedCitations).toBe(0);
      expect(result.value.citations).toHaveLength(2);
      expect(result.value.facts).toHaveLength(1);
      expect(result.value.inferred).toBe(false);
    }
  });

  it("omitted citations/facts/inferred default safely (schema defaults)", () => {
    const result = validateGeneration({ text: "Recorded on the Shelf." }, retrieved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.strippedCitations).toBe(0);
      expect(result.value.citations).toEqual([]);
      expect(result.value.facts).toEqual([]);
      expect(result.value.inferred).toBe(false);
    }
  });
});

describe("validateGeneration — ungrounded citations stripped", () => {
  it("a citation to an id outside the retrieved set is stripped, but the answer stays ok", () => {
    const raw = {
      text: "Your motorcycle keys are on the Shelf.",
      citations: [
        { type: "item", id: "a91d" },
        { type: "item", id: "zz99" },
      ],
      facts: [],
      inferred: false,
    };
    const result = validateGeneration(raw, retrieved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.strippedCitations).toBe(1);
      const keptIds = result.value.citations.map((c) => c.id);
      expect(keptIds).toEqual(["a91d"]);
      expect(keptIds).not.toContain("zz99");
    }
  });
});

describe("validateGeneration — fabricated facts reject the answer", () => {
  it("a fact referencing an unknown id → ok:false reason 'ungrounded'", () => {
    const raw = {
      text: "The passport is in the drawer.",
      citations: [],
      facts: [{ kind: "item", id: "ghost-item", occurredAt: "2026-10-14T20:30:00.000Z" }],
      inferred: false,
    };
    const result = validateGeneration(raw, retrieved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ungrounded");
    }
  });
});

describe("validateGeneration — empty and malformed output", () => {
  it("whitespace-only text → ok:false reason 'empty_text'", () => {
    const result = validateGeneration({ text: "   ", citations: [], facts: [], inferred: false }, retrieved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("empty_text");
    }
  });

  it("empty text → ok:false reason 'empty_text'", () => {
    const result = validateGeneration({ text: "", citations: [], facts: [], inferred: false }, retrieved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("empty_text");
    }
  });

  it("missing text → ok:false reason 'invalid_shape'", () => {
    const result = validateGeneration({ citations: [], facts: [], inferred: false }, retrieved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_shape");
    }
  });

  it("non-object output → ok:false reason 'invalid_shape'", () => {
    const result = validateGeneration(null, retrieved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_shape");
    }
  });

  it("text longer than MAX_TEXT_CHARS is truncated to 1200 characters", () => {
    expect(MAX_TEXT_CHARS).toBe(1200);
    const longText = "x".repeat(MAX_TEXT_CHARS + 1);
    const result = validateGeneration({ text: longText, citations: [], facts: [], inferred: false }, retrieved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toHaveLength(MAX_TEXT_CHARS);
      expect(result.value.text).toBe("x".repeat(1200));
    }
  });
});

describe("hasRequiredCaveat (FR-008 honesty caveat)", () => {
  it("accepts text containing the canonical caveat sentence", () => {
    expect(hasRequiredCaveat(LAST_RECORDED_CAVEAT)).toBe(true);
    expect(hasRequiredCaveat("Keys are on the Shelf. This is the last recorded location, so it may have moved.")).toBe(
      true,
    );
  });

  it("rejects text without the caveat phrase", () => {
    expect(hasRequiredCaveat("Your keys are on the Shelf.")).toBe(false);
    expect(hasRequiredCaveat("")).toBe(false);
  });

  it("CAVEAT_SENTENCE is the canonical LAST_RECORDED_CAVEAT wording", () => {
    expect(CAVEAT_SENTENCE).toBe(LAST_RECORDED_CAVEAT);
  });
});
