import { prisma } from "@/lib/db";
import { Prisma, type Conversation, type Message, type MessageRole, type MessageStatus, type PrismaClient } from "@/generated/prisma/client";
import type { PaginationQuery } from "@/lib/validation";
import type { PendingAction } from "@/server/assistant/types";

/**
 * Conversation/message persistence (FR-006, FR-023). Every read is double
 * scoped: message/conversation row + conversation.ownerId (BR-01/FR-012).
 * Deleting a conversation hard-deletes its messages via FK cascade (BR-09).
 */

type Db = PrismaClient | Prisma.TransactionClient;

export async function listConversations(
  ownerId: string,
  page: PaginationQuery,
): Promise<{ rows: Conversation[]; total: number }> {
  const where: Prisma.ConversationWhereInput = { ownerId };
  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: page.offset,
      take: page.limit,
    }),
    prisma.conversation.count({ where }),
  ]);
  return { rows, total };
}

export async function getConversation(ownerId: string, id: string): Promise<Conversation | null> {
  return prisma.conversation.findFirst({ where: { id, ownerId } });
}

export async function createConversation(
  ownerId: string,
  title?: string,
  db: Db = prisma,
): Promise<Conversation> {
  return db.conversation.create({ data: { ownerId, title: title ?? null } });
}

export type AppendMessageInput = {
  conversationId: string;
  role: MessageRole;
  content: string;
  intent?: string;
  status?: MessageStatus;
  pendingAction?: PendingAction;
  model?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
};

async function appendWith(db: Db, ownerId: string, input: AppendMessageInput): Promise<Message> {
  const message = await db.message.create({
    data: {
      ownerId,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
      status: input.status ?? "COMPLETE",
      pendingAction: input.pendingAction === undefined ? Prisma.DbNull : input.pendingAction,
      model: input.model ?? null,
      latencyMs: input.latencyMs ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
    },
  });
  await db.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: message.createdAt, updatedAt: message.createdAt },
  });
  return message;
}

/**
 * Persist a message and bump the conversation's lastMessageAt atomically
 * (a transaction when no transaction client is supplied).
 */
export async function appendMessage(
  ownerId: string,
  input: AppendMessageInput,
  db?: Prisma.TransactionClient,
): Promise<Message> {
  if (db) return appendWith(db, ownerId, input);
  return prisma.$transaction((tx) => appendWith(tx, ownerId, input));
}

/** Messages of an owner-scoped conversation, oldest first (chat order). */
export async function listMessages(
  ownerId: string,
  conversationId: string,
  page: PaginationQuery,
): Promise<{ rows: Message[]; total: number }> {
  const where: Prisma.MessageWhereInput = { ownerId, conversationId };
  const [rows, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    prisma.message.count({ where }),
  ]);
  return { rows, total };
}

/** Hard delete (privacy, BR-09): messages cascade from the conversation. */
export async function deleteConversation(ownerId: string, id: string): Promise<boolean> {
  const deleted = await prisma.conversation.deleteMany({ where: { id, ownerId } });
  return deleted.count > 0;
}

/** Load a message (with its pendingAction JSON) only if the owner owns its conversation. */
export async function getMessageWithPendingAction(ownerId: string, messageId: string): Promise<Message | null> {
  return prisma.message.findFirst({
    where: { id: messageId, ownerId, conversation: { ownerId } },
  });
}
