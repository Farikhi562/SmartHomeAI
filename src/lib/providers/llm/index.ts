import { getEnv } from "@/lib/config/env";
import { GroqProvider } from "./groq";
import { MockProvider } from "./mock";
import type { LlmProvider } from "./types";

let singleton: LlmProvider | null = null;

/**
 * Provider factory (D3): Groq when a key is configured, otherwise the deterministic
 * MockProvider so the app remains fully usable without AI credentials (FR-013).
 */
export function getLlmProvider(): LlmProvider {
  if (singleton) return singleton;
  singleton = getEnv().GROQ_API_KEY ? new GroqProvider() : new MockProvider();
  return singleton;
}

/** Test hook. */
export function setLlmProvider(provider: LlmProvider | null): void {
  singleton = provider;
}

export type { LlmProvider, LlmRequest, LlmResponse } from "./types";
