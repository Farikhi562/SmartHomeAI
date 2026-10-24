import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/llm/mock";
import { CLASSIFICATION_SYSTEM_PROMPT, GENERATION_SYSTEM_PROMPT, wrapUserMessage } from "@/server/assistant/prompts";
import { classificationSchema, generationSchema } from "@/server/assistant/types";
import type { LlmRequest } from "@/lib/providers/llm/types";

/**
 * MockProvider default handler (AI_ARCHITECTURE §9): keyword-heuristic classification
 * and a canned generation answer — deterministic, offline, schema-safe every time.
 */

function classificationRequest(message: string): LlmRequest {
  return {
    system: CLASSIFICATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: wrapUserMessage(message) }],
    jsonMode: true,
    timeoutMs: 1000,
    maxRetries: 0,
    maxOutputTokens: 512,
  };
}

function generationRequest(message: string): LlmRequest {
  return {
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: wrapUserMessage(message) }],
    jsonMode: true,
    timeoutMs: 1000,
    maxRetries: 0,
    maxOutputTokens: 512,
  };
}

describe("MockProvider default handler — classification by keyword heuristics", () => {
  it("routes on the INTENT_CLASSIFICATION marker in the system prompt", () => {
    // The handler keys off this exact marker — a real classifier request contains it.
    expect(CLASSIFICATION_SYSTEM_PROMPT).toContain("INTENT_CLASSIFICATION");
    expect(GENERATION_SYSTEM_PROMPT).not.toContain("INTENT_CLASSIFICATION");
  });

  it("'Where did I put my wallet?' → lookup_location", async () => {
    const provider = new MockProvider();
    const res = await provider.complete(classificationRequest("Where did I put my wallet?"));
    const parsed = classificationSchema.safeParse(JSON.parse(res.content));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.intent).toBe("lookup_location");
  });

  it("'I put my wallet in the backpack' → record_memory with a write proposal", async () => {
    const provider = new MockProvider();
    const res = await provider.complete(classificationRequest("I put my wallet in the backpack"));
    const parsed = classificationSchema.safeParse(JSON.parse(res.content));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.intent).toBe("record_memory");
      expect(parsed.data.proposedAction).toBe("record_location");
    }
  });

  it("'What's in the drawer?' → list_contents", async () => {
    const provider = new MockProvider();
    const res = await provider.complete(classificationRequest("What's in the drawer?"));
    const parsed = classificationSchema.safeParse(JSON.parse(res.content));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.intent).toBe("list_contents");
  });

  it("a non-matching message still yields schema-safe classification JSON", async () => {
    const provider = new MockProvider();
    const res = await provider.complete(classificationRequest("Please compute the square root of 144."));
    const json: unknown = JSON.parse(res.content);
    const parsed = classificationSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.intent).toBe("unknown");
      expect(parsed.data.confidence).toBeGreaterThanOrEqual(0);
      expect(parsed.data.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(parsed.data.entities.itemNames)).toBe(true);
      expect(Array.isArray(parsed.data.entities.itemAliases)).toBe(true);
      expect(Array.isArray(parsed.data.entities.locationPhrases)).toBe(true);
      expect(Array.isArray(parsed.data.entities.timeExpressions)).toBe(true);
    }
  });
});

describe("MockProvider default handler — generation prompts", () => {
  it("a non-classification prompt answers with schema-valid generation JSON", async () => {
    const provider = new MockProvider();
    const res = await provider.complete(generationRequest("Where are my keys?"));
    const parsed = generationSchema.safeParse(JSON.parse(res.content));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(typeof parsed.data.text).toBe("string");
      expect(parsed.data.text.length).toBeGreaterThan(0);
      expect(Array.isArray(parsed.data.citations)).toBe(true);
      expect(parsed.data.citations).toEqual([]);
      expect(parsed.data.facts).toEqual([]);
      expect(parsed.data.inferred).toBe(false);
    }
  });
});

describe("MockProvider call recording", () => {
  it("records every request in provider.calls", async () => {
    const provider = new MockProvider();
    await provider.complete(classificationRequest("Where did I put my wallet?"));
    expect(provider.calls).toHaveLength(1);
    await provider.complete(generationRequest("Where are my keys?"));
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.system).toBe(GENERATION_SYSTEM_PROMPT);
  });

  it("exposes its name and a bounded response envelope", async () => {
    const provider = new MockProvider();
    expect(provider.name).toBe("mock");
    const res = await provider.complete(classificationRequest("hello"));
    expect(res.model).toBe("mock");
    expect(typeof res.latencyMs).toBe("number");
  });
});
