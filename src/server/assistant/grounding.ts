import { generationSchema, MAX_TEXT_CHARS, type Generation, type RetrievedRecord } from "./types";
import { LAST_RECORDED_CAVEAT } from "@/server/rules/events";

/**
 * Grounding validator (FR-010, safety S-1): the model's answer may only reference
 * records that were actually retrieved and handed to it. Unknown citations are
 * stripped and flagged; empty-text output is rejected.
 */

export type GroundingResult =
  | { ok: true; value: Generation; strippedCitations: number }
  | { ok: false; reason: "invalid_shape" | "ungrounded" | "empty_text" };

export function validateGeneration(rawJson: unknown, retrieved: RetrievedRecord[]): GroundingResult {
  const parsed = generationSchema.safeParse(rawJson);
  if (!parsed.success) return { ok: false, reason: "invalid_shape" };

  const value = parsed.data;
  if (value.text.trim().length === 0) return { ok: false, reason: "empty_text" };

  const allowedIds = new Set(retrieved.map((r) => r.id));
  const before = value.citations.length + value.facts.length;
  const citations = value.citations.filter((c) => allowedIds.has(c.id));
  const facts = value.facts.filter((f) => allowedIds.has(f.id));
  const stripped = before - citations.length - facts.length;

  // A claim of a fact whose id is not in the retrieved set is fabrication: if the
  // model asserted any such fact (not just a citation), the answer is rejected.
  const fabricatedFacts = value.facts.length - facts.length;
  if (fabricatedFacts > 0) return { ok: false, reason: "ungrounded" };

  return {
    ok: true,
    value: {
      ...value,
      text: value.text.slice(0, MAX_TEXT_CHARS),
      citations,
      facts,
    },
    strippedCitations: stripped,
  };
}

/** Required honesty caveat must accompany location-bearing answers (FR-008). */
export function hasRequiredCaveat(text: string): boolean {
  return text.includes("This is the last recorded location");
}

export const CAVEAT_SENTENCE = LAST_RECORDED_CAVEAT;
