import { backoffMs, LlmHttpError, shouldRetry, type LlmProvider, type LlmRequest, type LlmResponse } from "./types";
import { getEnv } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";

/**
 * Groq chat-completions adapter (OpenAI-compatible API, server-side key only).
 * Bounds: hard timeout per attempt, bounded retries on 429/5xx/network (FR-013).
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GroqProvider implements LlmProvider {
  readonly name = "groq";

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const env = getEnv();
    if (!env.GROQ_API_KEY) throw new LlmHttpError(401, "GROQ_API_KEY is not configured");
    const started = Date.now();

    let lastError: unknown;
    for (let attempt = 0; attempt <= req.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), req.timeoutMs);
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.GROQ_MODEL,
            messages: [{ role: "system", content: req.system }, ...req.messages],
            temperature: 0.1,
            max_tokens: req.maxOutputTokens,
            ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = new LlmHttpError(res.status, `Groq responded ${res.status}`);
          if (!shouldRetry(err, attempt, req.maxRetries)) throw err;
          lastError = err;
        } else {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
            model?: string;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const content = data.choices?.[0]?.message?.content;
          if (typeof content !== "string" || content.length === 0) {
            const err = new LlmHttpError(502, "Groq returned an empty response");
            if (!shouldRetry(err, attempt, req.maxRetries)) throw err;
            lastError = err;
          } else {
            return {
              content,
              model: data.model ?? env.GROQ_MODEL,
              latencyMs: Date.now() - started,
              promptTokens: data.usage?.prompt_tokens,
              completionTokens: data.usage?.completion_tokens,
            };
          }
        }
      } catch (e) {
        if (e instanceof LlmHttpError && !shouldRetry(e, attempt, req.maxRetries)) throw e;
        if ((e as Error)?.name === "AbortError") {
          lastError = new LlmHttpError(504, "Groq request timed out");
        } else if (shouldRetry(e, attempt, req.maxRetries)) {
          lastError = e;
        } else {
          throw e;
        }
      } finally {
        clearTimeout(timer);
      }
      if (attempt < req.maxRetries) {
        await sleep(backoffMs(attempt));
      }
    }
    log.warn({ event: "ai.groq.exhausted", latencyMs: Date.now() - started });
    throw lastError instanceof Error ? lastError : new LlmHttpError(503, "Groq unavailable");
  }
}
