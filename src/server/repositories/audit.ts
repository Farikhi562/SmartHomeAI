import { prisma } from "@/lib/db";
import { Prisma, type AuditActorType, type PrismaClient } from "@/generated/prisma/client";

/**
 * Audit trail (BR-08). Metadata must stay operational — never content,
 * never raw IPs (hashed only, BR-09/NFR-007).
 */

/** Domain actor vocabulary; the DB enum only stores USER | SYSTEM. */
export type AuditActor = "user" | "assistant" | "system";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The `AuditActorType` enum has no ASSISTANT value (schema constraint), so
 * assistant-originated writes are recorded as SYSTEM with an explicit
 * `actor: "assistant"` marker in metadata.
 */
function toActorType(actor: AuditActor): AuditActorType {
  return actor === "user" ? "USER" : "SYSTEM";
}

export async function recordAudit(
  ownerId: string | null,
  actorType: AuditActor,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
  ipHash?: string,
  db: Db = prisma,
): Promise<void> {
  const marker = actorType === "assistant" ? { actor: "assistant" } : actorType === "system" ? { actor: "system" } : {};
  const data: Prisma.AuditEventCreateInput = {
    user: ownerId === null ? undefined : { connect: { id: ownerId } },
    actorType: toActorType(actorType),
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    metadata: metadata === undefined && Object.keys(marker).length === 0
      ? Prisma.DbNull
      : ({ ...(metadata ?? {}), ...marker } as Prisma.InputJsonValue),
    ipHash: ipHash ?? null,
  };
  await db.auditEvent.create({ data });
}
