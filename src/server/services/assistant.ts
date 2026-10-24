import { prisma } from "@/lib/db";
import { errors } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import type { ActionDecision, AssistantMessageInput, EventDto, PaginationQuery } from "@/lib/validation";
import type { Conversation, Message } from "@/generated/prisma/client";
import { runAssistant } from "@/server/assistant/pipeline";
import type { AssistantResult, CitationDto } from "@/server/assistant/pipeline";
import { pendingActionSchema } from "@/server/assistant/types";
import type { PendingAction } from "@/server/assistant/types";
import {
  deleteConversation,
  getConversation,
  getMessageWithPendingAction,
  listConversations as listConversationsRepo,
  listMessages,
} from "@/server/repositories/conversations";
import { createEvent } from "@/server/repositories/events";
import { getItem } from "@/server/repositories/items";
import { isPendingActionExpired } from "@/server/rules/retention";
import { isValidOccurredAt } from "@/server/rules/events";
import { AuditService } from "@/server/services/audit";
import { toEventDto } from "@/server/services/events";
import { pathMapFor, requireUsableLocation } from "@/server/services/locations";

/**
 * Assistant service (FR-006, FR-023, FR-024): thin orchestration over the
 * pipeline plus conversation management and the confirmation-decision flow.
 * The write executes ONLY here, after explicit confirmation with a fresh
 * ownership check (BR-02) — through the same event path as UI writes.
 */

export type ConversationDto = {
  id: string;
  title: string | null;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageDto = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  intent: string | null;
  status: string;
  pendingAction: PendingAction | null;
  createdAt: string;
  model: string | null;
  latencyMs: number | null;
};

function toConversationDto(row: Conversation): ConversationDto {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageDto(row: Message): MessageDto {
  const parsed = pendingActionSchema.safeParse(row.pendingAction);
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    intent: row.intent,
    status: row.status,
    pendingAction: parsed.success ? parsed.data : null,
    createdAt: row.createdAt.toISOString(),
    model: row.model,
    latencyMs: row.latencyMs,
  };
}

/** POST /api/assistant/messages — rate limiting happens in the route (BR-12). */
export async function createMessage(ownerId: string, input: AssistantMessageInput): Promise<AssistantResult> {
  return runAssistant(ownerId, input.conversationId, input.message);
}

export async function listConversations(
  ownerId: string,
  page: PaginationQuery,
): Promise<{ conversations: ConversationDto[]; total: number }> {
  const { rows, total } = await listConversationsRepo(ownerId, page);
  return { conversations: rows.map(toConversationDto), total };
}

export async function getConversationMessages(
  ownerId: string,
  conversationId: string,
  page: PaginationQuery,
): Promise<{ messages: MessageDto[]; total: number }> {
  const conversation = await getConversation(ownerId, conversationId);
  if (!conversation) throw errors.notFound("Conversation");
  const { rows, total } = await listMessages(ownerId, conversationId, page);
  return { messages: rows.map(toMessageDto), total };
}

/** FR-023.2 / BR-09: hard delete of the conversation and its messages. */
export async function removeConversation(ownerId: string, id: string): Promise<{ id: string; deleted: true }> {
  const conversation = await getConversation(ownerId, id);
  if (!conversation) throw errors.notFound("Conversation");
  await deleteConversation(ownerId, id);
  await AuditService.record({
    ownerId,
    actorType: "user",
    action: "CONVERSATION_DELETED",
    targetType: "conversation",
    targetId: id,
  });
  return { id, deleted: true };
}

export type DecisionResult =
  | { status: "cancelled" }
  | { status: "confirmed"; event: EventDto; citations: CitationDto[] };

/**
 * POST /api/assistant/actions/:messageId/decision — the :id route param is the
 * MESSAGE id that carries the `pendingAction` (API_SPEC §3.6).
 *
 * confirm: overrides applied first, then re-validated; the write runs in one
 * $transaction with the consumedAt mark (idempotency guard → second confirm
 * is 409). cancel: mark consumed, no writes.
 */
export async function decideAction(
  ownerId: string,
  messageId: string,
  decision: ActionDecision,
): Promise<DecisionResult> {
  const message = await getMessageWithPendingAction(ownerId, messageId);
  if (!message) throw errors.notFound("Action");

  const parsed = pendingActionSchema.safeParse(message.pendingAction);
  if (!parsed.success) throw errors.conflict("This message has no pending action.");
  const pending: PendingAction = parsed.data;

  if (pending.consumedAt !== null && pending.consumedAt !== undefined) {
    throw errors.conflict("This confirmation card was already processed.");
  }
  if (isPendingActionExpired(message.createdAt)) {
    throw errors.conflict("This confirmation card has expired (24 hours). Ask me again and I'll prepare it again.");
  }

  if (decision.decision === "cancel") {
    const cancelled: PendingAction = { ...pending, consumedAt: new Date().toISOString() };
    await prisma.message.update({ where: { id: message.id }, data: { pendingAction: cancelled } });
    log.info({ event: "assistant_write_cancelled", actionType: pending.type }); // BR-09: type only, no content
    return { status: "cancelled" };
  }

  // ── confirm ──────────────────────────────────────────────────────────────
  const itemId = pending.payload.item.existingId;
  if (!itemId) {
    throw errors.conflict("This pending action does not reference an existing item.");
  }
  const locationId = decision.overrides?.locationId ?? pending.payload.location.existingId;
  if (!locationId) {
    throw errors.validation([
      { path: "overrides.locationId", issue: "A location is required to record this memory." },
    ]);
  }
  const occurredAt = decision.overrides?.occurredAt
    ? new Date(decision.overrides.occurredAt)
    : new Date(pending.payload.occurredAt);
  if (!isValidOccurredAt(occurredAt)) {
    throw errors.validation(
      [{ path: "overrides.occurredAt", issue: "occurredAt cannot be more than 5 minutes in the future." }],
      "Invalid occurredAt.",
    );
  }

  const written = await prisma.$transaction(async (tx) => {
    // Fresh ownership + rule checks at confirmation time (BR-02, FR-024.2).
    const item = await getItem(ownerId, itemId, tx);
    if (!item) throw errors.notFound("Item");
    const location = await requireUsableLocation(ownerId, locationId);
    const event = await createEvent(
      ownerId,
      {
        itemId,
        locationId,
        occurredAt,
        source: "ASSISTANT",
        confidence: "CONFIRMED",
        messageId: message.id,
      },
      tx,
    );
    const consumed: PendingAction = { ...pending, consumedAt: new Date().toISOString() };
    await tx.message.update({ where: { id: message.id }, data: { pendingAction: consumed } });
    return { event, itemName: item.name, locationName: location.name };
  });

  await AuditService.record({
    ownerId,
    actorType: "assistant",
    action: "ASSISTANT_WRITE_CONFIRMED",
    targetType: "event",
    targetId: written.event.id,
    metadata: { actionType: pending.type },
  });

  const paths = await pathMapFor(ownerId);
  const eventDto = toEventDto(written.event, written.itemName, {
    name: written.locationName,
    path: paths.get(written.event.locationId) ?? written.locationName,
  });
  const citations: CitationDto[] = [
    { type: "item", id: itemId, label: written.itemName },
    {
      type: "event",
      id: written.event.id,
      label: written.itemName,
      occurredAt: written.event.occurredAt.toISOString(),
    },
  ];
  return { status: "confirmed", event: eventDto, citations };
}
