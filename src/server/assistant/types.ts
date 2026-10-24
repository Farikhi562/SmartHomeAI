import { z } from "zod";

/**
 * Assistant structured-output schemas (AI_ARCHITECTURE §4). The LLM's JSON is
 * validated against these on arrival; anything else is a provider failure (FR-013).
 */

export const INTENTS = [
  "lookup_location",
  "list_contents",
  "search_fuzzy",
  "record_memory",
  "correct_record",
  "chit_chat",
  "help",
  "unknown",
] as const;
export type Intent = (typeof INTENTS)[number];

export const WRITE_ACTIONS = ["record_location", "create_item", "correct_location"] as const;
export type WriteAction = (typeof WRITE_ACTIONS)[number];

export const entitiesSchema = z.object({
  itemNames: z.array(z.string().max(120)).max(10).default([]),
  itemAliases: z.array(z.string().max(120)).max(10).default([]),
  locationPhrases: z.array(z.string().max(200)).max(10).default([]),
  timeExpressions: z.array(z.string().max(120)).max(10).default([]),
  relativeDate: z.string().max(120).nullish(),
});
export type Entities = z.infer<typeof entitiesSchema>;

export const classificationSchema = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(1),
  entities: entitiesSchema,
  proposedAction: z.enum(["none", ...WRITE_ACTIONS]).default("none"),
  notes: z.string().max(300).optional(),
});
export type Classification = z.infer<typeof classificationSchema>;

export const generationSchema = z.object({
  text: z.string().max(2000),
  citations: z.array(z.object({ type: z.enum(["item", "location", "event"]), id: z.string().max(64) })).max(20).default([]),
  facts: z
    .array(z.object({ kind: z.enum(["item", "location", "event"]), id: z.string().max(64), occurredAt: z.string().optional() }))
    .max(20)
    .default([]),
  inferred: z.boolean().default(false),
});
export type Generation = z.infer<typeof generationSchema>;

/** Structured write proposal persisted on the assistant message (FR-024). */
export const pendingActionSchema = z.object({
  id: z.string(),
  type: z.enum(WRITE_ACTIONS),
  payload: z.object({
    item: z.object({ existingId: z.string().uuid().optional(), name: z.string().max(120).optional() }),
    location: z.object({ existingId: z.string().uuid().optional(), name: z.string().max(200).optional(), path: z.string().max(400).optional() }),
    occurredAt: z.string(),
    note: z.string().max(300).nullish(),
  }),
  expiresAt: z.string(),
  consumedAt: z.string().nullish(),
});
export type PendingAction = z.infer<typeof pendingActionSchema>;

/** A record handed to the LLM as context — ids are stable, content is untrusted. */
export type RetrievedRecord =
  | { kind: "item"; id: string; name: string; description: string | null; category: string | null; lastLocationName: string | null; lastOccurredAt: string | null }
  | { kind: "location"; id: string; name: string; path: string }
  | { kind: "event"; id: string; itemName: string; locationName: string; path: string; occurredAt: string; recordedAt: string };

export const MAX_RETRIEVED_RECORDS = 20; // FR-007 bound
export const MAX_TEXT_CHARS = 1200; // ANSWER_GENERATION bound
