import { getEnv } from "@/lib/config/env";
import { ApiError, errors } from "@/lib/errors";
import { getLlmProvider } from "@/lib/providers/llm";
import { hashOwner, log } from "@/lib/observability/logger";
import { appendMessage, createConversation, getConversation } from "@/server/repositories/conversations";
import { searchHits } from "@/server/services/search";
import { LAST_RECORDED_CAVEAT, isValidOccurredAt } from "@/server/rules/events";
import { PENDING_ACTION_TTL_MS } from "@/server/rules/retention";
import { hasRequiredCaveat, validateGeneration } from "./grounding";
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  REPAIR_PROMPT,
  serializeRecords,
  wrapUserMessage,
} from "./prompts";
import { retrieveRecords } from "./retrieval";
import type { ItemCandidate, LocationCandidate, RetrievalResult } from "./retrieval";
import {
  MAX_TEXT_CHARS,
  classificationSchema,
  type Classification,
  type Entities,
  type Intent,
  type PendingAction,
  type RetrievedRecord,
} from "./types";

/**
 * Assistant pipeline (AI_ARCHITECTURE §3): classify → (retrieve → generate |
 * canned | pendingAction) → persist → reply. Grounding is enforced server-side
 * (FR-010); writes are never executed here — only proposed (FR-024, S-5/S-6).
 * Any provider failure degrades to the FR-013 fallback envelope (503) with
 * deterministic search results. Logs carry metadata only (BR-09).
 */

export type CitationDto = { type: "item" | "location" | "event"; id: string; label?: string; occurredAt?: string };
export type ReplyStatus = "COMPLETE" | "PENDING_ACTION" | "FALLBACK" | "ERROR";

export type AssistantReply = {
  id: string;
  role: "ASSISTANT";
  text: string;
  intent: Intent;
  status: ReplyStatus;
  citations: CitationDto[];
  candidates: ItemCandidate[];
  pendingAction: PendingAction | null;
};

export type AssistantResult = {
  conversationId: string;
  message: { id: string; role: "USER"; content: string };
  reply: AssistantReply;
  meta: { fallbackUsed: boolean; latencyMs: number; model: string };
};

const HELP_REPLY =
  "I can help you:\n" +
  "- Find the last recorded location of an item (\"Where are my keys?\")\n" +
  "- List what you recorded in a place (\"What's in the bedroom drawer?\")\n" +
  "- Search your records by any word (\"charger\", \"blue bag\")\n" +
  "- Record where you put something — I'll show you a confirmation card first; nothing is saved until you confirm.";
const CHIT_CHAT_REPLY =
  "Thanks! Ask me where something is, what's in a place, or tell me where you put something and I'll remember it.";
const UNKNOWN_REPLY =
  "I didn't quite understand. You can ask where something is, list what's in a place, or record where you put something.";
const GENERATION_FALLBACK_TEXT = "I found records but couldn't summarize them reliably. Try rephrasing.";
const PROVIDER_DOWN_TEXT =
  "The assistant is temporarily unavailable right now. Your records are safe — please retry in a moment, or use search.";

/** Strip optional markdown fences before JSON.parse (provider quirk tolerance). */
function parseJson(content: string): unknown {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function zeroRecordSubject(message: string, entities: Entities): string {
  return (entities.itemNames[0] ?? entities.locationPhrases[0] ?? message.slice(0, 60)).trim();
}

function zeroRecordText(subject: string): string {
  return `I don't have any record of ${subject}. You can record where you last put it, or try another name or spelling.`;
}

/** FR-009 clarification with numbered candidates (G7), capped at 3 + 1200 chars. */
function itemClarificationText(candidates: ItemCandidate[]): string {
  const lines = candidates
    .slice(0, 3)
    .map((candidate, index) => {
      const where = candidate.lastLocationName ? ` — last recorded in ${candidate.lastLocationName}` : "";
      return `${index + 1}. ${candidate.name}${where}`;
    });
  return `I found a few similar records — which one do you mean?\n${lines.join("\n")}`.slice(0, MAX_TEXT_CHARS);
}

function locationClarificationText(candidates: LocationCandidate[]): string {
  const lines = candidates
    .slice(0, 3)
    .map((candidate, index) => `${index + 1}. ${candidate.name} (${candidate.path})`);
  return `I found a few similar locations — which one do you mean?\n${lines.join("\n")}`.slice(0, MAX_TEXT_CHARS);
}

/**
 * Best-effort occurredAt resolution from extracted entities (FR-004 allows
 * backdating). Relative words resolve against the server clock in UTC; only
 * values within the 5-minute future skew are accepted, else "now".
 */
function resolveOccurredAt(entities: Entities, now: Date): Date {
  const expressions = entities.relativeDate
    ? [entities.relativeDate, ...entities.timeExpressions]
    : [...entities.timeExpressions];
  for (const expression of expressions) {
    const lower = expression.toLowerCase();
    if (lower.includes("yesterday")) return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (lower.includes("today")) return now;
    const parsed = Date.parse(expression);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      if (isValidOccurredAt(date, now)) return date;
    }
  }
  return now;
}

/** Server-side citation enrichment (API_SPEC §4): labels/occurredAt never come from the model. */
function enrichCitations(
  rawCitations: { type: "item" | "location" | "event"; id: string }[],
  rawFacts: { kind: "item" | "location" | "event"; id: string }[],
  records: RetrievedRecord[],
): CitationDto[] {
  const itemNames = new Map<string, string>();
  const locationPaths = new Map<string, string>();
  const events = new Map<string, { itemName: string; occurredAt: string }>();
  for (const record of records) {
    if (record.kind === "item") itemNames.set(record.id, record.name);
    else if (record.kind === "location") locationPaths.set(record.id, record.path);
    else events.set(record.id, { itemName: record.itemName, occurredAt: record.occurredAt });
  }

  const out: CitationDto[] = [];
  const seen = new Set<string>();
  const add = (type: "item" | "location" | "event", id: string): void => {
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (type === "item") {
      const name = itemNames.get(id);
      if (name !== undefined) out.push({ type, id, label: name });
    } else if (type === "location") {
      const path = locationPaths.get(id);
      if (path !== undefined) out.push({ type, id, label: path });
    } else {
      const event = events.get(id);
      if (event !== undefined) out.push({ type, id, label: event.itemName, occurredAt: event.occurredAt });
    }
  };
  for (const citation of rawCitations) add(citation.type, citation.id);
  for (const fact of rawFacts) add(fact.kind, fact.id);
  return out;
}

/** FR-013 fallback payload: deterministic search hits, never an exception. */
async function buildFallback(
  ownerId: string,
  message: string,
): Promise<{ searchQuery: string; results: { id: string; name: string; type: string; score: number }[] }> {
  const searchQuery = message.slice(0, 80);
  const results = await searchHits(ownerId, searchQuery, 5);
  return { searchQuery, results };
}

/**
 * FR-024.4 / FR-009: a write proposal needs ONE unique, confident item and
 * location. Anything less → a targeted question, never a guessed write.
 */
function writeClarification(retrieval: RetrievalResult, confidence: number): string | null {
  if (confidence < 0.6) {
    return "Just to confirm before I save anything — could you say that again with the item and the place? I'd rather ask than record the wrong thing.";
  }
  if (retrieval.candidates.length >= 2) return itemClarificationText(retrieval.candidates);
  if (retrieval.locationCandidates.length >= 2) return locationClarificationText(retrieval.locationCandidates);
  if (!retrieval.resolvedItem) {
    return "I couldn't find an item with that name in your inventory. Which item did you record, or what is its exact name?";
  }
  return "I couldn't tell which location you mean. Tell me the full place, for example \"Home / Bedroom / Drawer\".";
}

/**
 * Run the full pipeline for one user message. Creates or reuses an
 * owner-scoped conversation, persists both messages, and returns the reply
 * DTO per API_SPEC §3.6. Throws only AI_UNAVAILABLE (with fallback) or
 * NOT_FOUND for a foreign conversation.
 */
export async function runAssistant(
  ownerId: string,
  conversationId: string | undefined,
  message: string,
): Promise<AssistantResult> {
  const env = getEnv();
  const startedAt = Date.now();

  let conversation = conversationId ? await getConversation(ownerId, conversationId) : null;
  if (conversationId && !conversation) throw errors.notFound("Conversation");
  if (!conversation) conversation = await createConversation(ownerId, message.slice(0, 80));
  const convId = conversation.id;

  const userMessage = await appendMessage(ownerId, {
    conversationId: convId,
    role: "USER",
    content: message,
  });

  let intent: Intent = "unknown";
  let status: ReplyStatus = "COMPLETE";
  let text = "";
  let citations: CitationDto[] = [];
  let candidates: ItemCandidate[] = [];
  let pendingAction: PendingAction | null = null;
  let model = env.GROQ_MODEL;
  let confidence = 0;

  try {
    const provider = getLlmProvider();
    const classificationResponse = await provider.complete({
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: wrapUserMessage(message) }],
      jsonMode: true,
      timeoutMs: env.GROQ_TIMEOUT_MS,
      maxRetries: env.GROQ_MAX_RETRIES,
      maxOutputTokens: 300,
    });
    model = classificationResponse.model;

    let classification: Classification | null = null;
    const firstTry = classificationSchema.safeParse(parseJson(classificationResponse.content));
    if (firstTry.success) {
      classification = firstTry.data;
    } else {
      // Exactly one repair attempt (INTENT_CLASSIFICATION §7); a second
      // failure is a provider failure → 503 fallback via the outer catch.
      const repairResponse = await provider.complete({
        system: CLASSIFICATION_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: wrapUserMessage(message) },
          { role: "assistant", content: classificationResponse.content },
          { role: "user", content: REPAIR_PROMPT },
        ],
        jsonMode: true,
        timeoutMs: env.GROQ_TIMEOUT_MS,
        maxRetries: env.GROQ_MAX_RETRIES,
        maxOutputTokens: 300,
      });
      model = repairResponse.model;
      const repaired = classificationSchema.safeParse(parseJson(repairResponse.content));
      if (!repaired.success) throw errors.aiUnavailable();
      classification = repaired.data;
    }

    // Post-validation invariant (INTENT_CLASSIFICATION §3.4): proposedAction
    // only ever accompanies a write intent.
    if (
      classification.proposedAction !== "none" &&
      classification.intent !== "record_memory" &&
      classification.intent !== "correct_record"
    ) {
      classification = { ...classification, proposedAction: "none" };
    }

    // Confidence thresholds (INTENT_CLASSIFICATION §6) — server-side, never model-adjusted.
    confidence = classification.confidence;
    if (confidence < 0.4) {
      intent = "unknown";
    } else if (confidence < 0.6) {
      const writeIntent = classification.intent === "record_memory" || classification.intent === "correct_record";
      intent = writeIntent ? classification.intent : "unknown";
    } else {
      intent = classification.intent;
    }
    log.info({ event: "assistant.classified", intent, ownerIdHash: hashOwner(ownerId) });

    if (intent === "chit_chat" || intent === "help" || intent === "unknown") {
      text = intent === "chit_chat" ? CHIT_CHAT_REPLY : intent === "help" ? HELP_REPLY : UNKNOWN_REPLY;
    } else if (intent === "lookup_location" || intent === "list_contents" || intent === "search_fuzzy") {
      const retrieval = await retrieveRecords(ownerId, classification.entities);
      if (retrieval.records.length === 0) {
        // Zero-record behavior (G5 / FR-010.1): no generation call at all.
        text = zeroRecordText(zeroRecordSubject(message, classification.entities));
      } else if (retrieval.candidates.length >= 2) {
        // Ambiguity branch (FR-009): clarify with candidates, no generation.
        candidates = retrieval.candidates;
        text = itemClarificationText(retrieval.candidates);
      } else {
        const generationResponse = await provider.complete({
          system: GENERATION_SYSTEM_PROMPT,
          messages: [
            { role: "user", content: `${serializeRecords(retrieval.records)}\n\n${wrapUserMessage(message)}` },
          ],
          jsonMode: true,
          timeoutMs: env.GROQ_TIMEOUT_MS,
          maxRetries: env.GROQ_MAX_RETRIES,
          maxOutputTokens: 600,
        });
        model = generationResponse.model;
        const grounding = validateGeneration(parseJson(generationResponse.content), retrieval.records);
        if (!grounding.ok) {
          // FR-010: never show an ungrounded answer; safe text + metric.
          log.warn({ event: "ai.ungrounded_detected", reason: grounding.reason, intent });
          status = "FALLBACK";
          text = GENERATION_FALLBACK_TEXT;
        } else {
          citations = enrichCitations(grounding.value.citations, grounding.value.facts, retrieval.records);
          let answer = grounding.value.text;
          const statesLastLocation = retrieval.records.some(
            (record) => record.kind === "event" || (record.kind === "item" && record.lastLocationName !== null),
          );
          if (statesLastLocation && !hasRequiredCaveat(answer)) {
            // FR-008 honesty caveat, clamped to the length budget (keep the caveat).
            const room = Math.max(0, MAX_TEXT_CHARS - LAST_RECORDED_CAVEAT.length - 1);
            answer = `${answer.slice(0, room)} ${LAST_RECORDED_CAVEAT}`;
          }
          text = answer;
        }
      }
    } else {
      // record_memory / correct_record → structured proposal only (FR-024).
      const retrieval = await retrieveRecords(ownerId, classification.entities);
      const clarification = writeClarification(retrieval, confidence);
      if (clarification !== null) {
        candidates = retrieval.candidates;
        text = clarification;
      } else if (retrieval.resolvedItem && retrieval.resolvedLocation) {
        const occurredAt = resolveOccurredAt(classification.entities, new Date());
        pendingAction = {
          id: crypto.randomUUID(),
          type: intent === "correct_record" ? "correct_location" : "record_location",
          payload: {
            item: { existingId: retrieval.resolvedItem.id },
            location: {
              existingId: retrieval.resolvedLocation.id,
              name: retrieval.resolvedLocation.name,
              path: retrieval.resolvedLocation.path,
            },
            occurredAt: occurredAt.toISOString(),
          },
          // BR-02: server clock + 24h; never model-supplied, never auto-executed.
          expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString(),
        };
        status = "PENDING_ACTION";
        text = `Here's what I can save for you: ${retrieval.resolvedItem.name} → ${retrieval.resolvedLocation.path} (at ${occurredAt.toISOString()}). Confirm on the card and I'll record it — nothing is saved yet.`;
      } else {
        // Defensive: writeClarification covers both; keep a safe question.
        text = "I couldn't resolve the item and location for that. Could you rephrase with both, for example \"I put my wallet in the bedroom drawer\"?";
      }
    }
  } catch (err) {
    const aiFailure = err instanceof ApiError ? err.code === "AI_UNAVAILABLE" : true;
    if (!aiFailure) throw err;
    log.error({
      event: "assistant.pipeline_failed",
      intent,
      errorCode: err instanceof ApiError ? err.code : "PROVIDER_ERROR",
      ownerIdHash: hashOwner(ownerId),
    });
    const fallback = await buildFallback(ownerId, message);
    await appendMessage(ownerId, {
      conversationId: convId,
      role: "ASSISTANT",
      content: PROVIDER_DOWN_TEXT,
      status: "ERROR",
      model,
      latencyMs: Date.now() - startedAt,
    });
    throw errors.aiUnavailable(fallback);
  }

  const latencyMs = Date.now() - startedAt;
  const replyMessage = await appendMessage(ownerId, {
    conversationId: convId,
    role: "ASSISTANT",
    content: text,
    intent,
    status,
    pendingAction: pendingAction ?? undefined,
    model,
    latencyMs,
  });
  log.info({
    event: "assistant.reply",
    intent,
    status,
    latencyMs,
    model,
    ownerIdHash: hashOwner(ownerId),
  });

  return {
    conversationId: convId,
    message: { id: userMessage.id, role: "USER", content: message },
    reply: {
      id: replyMessage.id,
      role: "ASSISTANT",
      text,
      intent,
      status,
      citations,
      candidates,
      pendingAction,
    },
    meta: { fallbackUsed: status === "FALLBACK", latencyMs, model },
  };
}
