import { recordAudit } from "@/server/repositories/audit";
import type { AuditActor } from "@/server/repositories/audit";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * AuditService — single entry point for sensitive-operation auditing:
 * item delete/restore, assistant write confirm, conversation delete,
 * account changes (BR-08). Metadata carries operational fields only (BR-09).
 */

export type AuditEntry = {
  ownerId: string | null;
  actorType: AuditActor;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  db?: PrismaClient | Prisma.TransactionClient;
};

export const AuditService = {
  record(entry: AuditEntry): Promise<void> {
    return recordAudit(
      entry.ownerId,
      entry.actorType,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.metadata,
      entry.ipHash,
      entry.db,
    );
  },
};

/** Salted, truncated owner hash for audit/log correlation (never raw ids+IPs). */
export { hashOwner } from "@/lib/observability/logger";
