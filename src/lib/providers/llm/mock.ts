import type { LlmProvider, LlmRequest, LlmResponse } from "./types";

/**
 * Deterministic mock provider for tests and keyless local development (AI_ARCHITECTURE §9).
 * Behavior is driven by a programmable handler; the default handler answers with a
 * minimal valid JSON object so the pipeline degrades gracefully without a key.
 */

export type MockHandler = (req: LlmRequest) => string | Promise<string>;

export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly calls: LlmRequest[] = [];

  constructor(private handler: MockHandler = defaultHandler) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    const content = await this.handler(req);
    return { content, model: "mock", latencyMs: 1 };
  }
}

/**
 * The default handler classifies by simple keyword heuristics so the whole
 * request flow can be exercised without a Groq key (dev/test only).
 */
function defaultHandler(req: LlmRequest): string {
  const last = req.messages[req.messages.length - 1]?.content ?? "";
  const isClassification = req.system.includes("INTENT_CLASSIFICATION");
  if (isClassification) {
    const lc = last.toLowerCase();
    let intent = "unknown";
    if (/\b(where|which place|did i (put|place|keep))\b/.test(lc)) intent = "lookup_location";
    else if (/\b(put|placed|stored|kept it|moving it to)\b/.test(lc)) intent = "record_memory";
    else if (/\b(what('s| is) in|inside|contents)\b/.test(lc)) intent = "list_contents";
    else if (/\b(help|how do)\b/.test(lc)) intent = "help";
    return JSON.stringify({
      intent,
      confidence: 0.8,
      entities: { itemNames: [], itemAliases: [], locationPhrases: [], timeExpressions: [] },
      proposedAction: intent === "record_memory" ? "record_location" : "none",
    });
  }
  // Generation-style prompts: claim nothing beyond an explicit empty-record answer.
  return JSON.stringify({
    text: "I could not find a recorded answer for that. (Mock provider — set GROQ_API_KEY for real answers.)",
    citations: [],
    facts: [],
    inferred: false,
  });
}
