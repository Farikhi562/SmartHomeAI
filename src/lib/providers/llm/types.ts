/**
 * Provider-agnostic LLM interface (AI_ARCHITECTURE §2, ADR-003, D3).
 * Swapping providers means implementing this interface — no call sites change.
 */

export type LlmMessage = { role: "user" | "assistant"; content: string };

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  /** Ask for a JSON object response (provider-specific mechanism). */
  jsonMode?: boolean;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/** Retry policy: retry only on 429/5xx/network; exponential backoff with jitter (FR-013). */
export function shouldRetry(error: unknown, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  const status = (error as { status?: number } | null)?.status;
  if (status === undefined) return true; // network / unknown transport error
  return status === 429 || status >= 500;
}

export function backoffMs(attempt: number): number {
  const base = 250 * 2 ** attempt; // 250ms, 500ms, 1s …
  return base + Math.floor(Math.random() * 100); // jitter
}

export class LlmHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "LlmHttpError";
  }
}
