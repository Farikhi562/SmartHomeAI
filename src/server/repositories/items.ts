import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { Item, ItemSource, PrismaClient } from "@/generated/prisma/client";
import type { ItemListQuery } from "@/lib/validation";

/**
 * Item data access. Every query is owner-scoped (FR-012): "not mine" reads as
 * "not found". Soft-deleted items (BR-07) are excluded from all normal reads.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const ITEM_COLUMNS = Prisma.sql`
  i.id,
  i.owner_id AS "ownerId",
  i.name,
  i.description,
  i.category,
  i.created_via AS "createdVia",
  i."createdAt",
  i."updatedAt",
  i.archived_at AS "archivedAt",
  i.deleted_at AS "deletedAt"
`;

/** Escape LIKE/ILIKE wildcards so user input never becomes a pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function itemFilterWhere(ownerId: string, query: ItemListQuery): Prisma.ItemWhereInput {
  const where: Prisma.ItemWhereInput = { ownerId, deletedAt: null };
  if (query.status === "active") where.archivedAt = null;
  else if (query.status === "archived") where.archivedAt = { not: null };
  if (query.q) where.name = { contains: query.q, mode: "insensitive" };
  if (query.category) where.category = query.category;
  // Semantics: items with at least one recorded location event at that location.
  if (query.locationId) where.events = { some: { locationId: query.locationId } };
  return where;
}

/** Same filters as SQL for the raw `lastRecordedAt` sort path (parameterized only). */
function itemFilterSql(ownerId: string, query: ItemListQuery): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`i.owner_id = ${ownerId}`, Prisma.sql`i.deleted_at IS NULL`];
  if (query.status === "active") conds.push(Prisma.sql`i.archived_at IS NULL`);
  else if (query.status === "archived") conds.push(Prisma.sql`i.archived_at IS NOT NULL`);
  if (query.q) conds.push(Prisma.sql`i.name ILIKE ${`%${escapeLike(query.q)}%`}`);
  if (query.category) conds.push(Prisma.sql`i.category = ${query.category}`);
  if (query.locationId) {
    conds.push(
      Prisma.sql`EXISTS (SELECT 1 FROM item_location_events ev WHERE ev.item_id = i.id AND ev.location_id = ${query.locationId})`,
    );
  }
  return Prisma.join(conds, " AND ");
}

/**
 * List items for an owner. `sort=lastRecordedAt` needs a lateral aggregate over
 * the append-only event log, so that path runs as a parameterized $queryRaw;
 * name/updatedAt stay in the Prisma query.
 */
export async function listItems(
  ownerId: string,
  query: ItemListQuery,
): Promise<{ rows: Item[]; total: number }> {
  const where = itemFilterWhere(ownerId, query);
  const order: Prisma.SortOrder = query.order === "asc" ? "asc" : "desc";

  if (query.sort === "lastRecordedAt") {
    const filter = itemFilterSql(ownerId, query);
    const dir = order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<Item[]>`
        SELECT ${ITEM_COLUMNS}
        FROM items i
        WHERE ${filter}
        ORDER BY (
          SELECT MAX(e.occurred_at) FROM item_location_events e WHERE e.item_id = i.id
        ) ${dir} NULLS LAST, i.id ${dir}
        LIMIT ${query.limit} OFFSET ${query.offset}
      `,
      prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM items i WHERE ${filter}`,
    ]);
    return { rows, total: countRows[0]?.count ?? 0 };
  }

  const orderBy: Prisma.ItemOrderByWithRelationInput =
    query.sort === "name" ? { name: order, id: order } : { updatedAt: order, id: order };
  const [rows, total] = await Promise.all([
    prisma.item.findMany({ where, orderBy, skip: query.offset, take: query.limit }),
    prisma.item.count({ where }),
  ]);
  return { rows, total };
}

/** Active (non-deleted) item — normal read path. */
export async function getItem(ownerId: string, id: string, db: Db = prisma): Promise<Item | null> {
  return db.item.findFirst({ where: { id, ownerId, deletedAt: null } });
}

/** Owner-scoped read that includes soft-deleted rows (restore flow, BR-07). */
export async function findIncludeDeleted(ownerId: string, id: string, db: Db = prisma): Promise<Item | null> {
  return db.item.findFirst({ where: { id, ownerId } });
}

export async function getItemsByIds(ownerId: string, ids: string[], db: Db = prisma): Promise<Item[]> {
  if (ids.length === 0) return [];
  return db.item.findMany({ where: { ownerId, id: { in: ids } } });
}

export type CreateItemInput = {
  name: string;
  description?: string;
  category?: string;
  createdVia?: ItemSource;
};

export async function createItem(ownerId: string, input: CreateItemInput, db: Db = prisma): Promise<Item> {
  return db.item.create({ data: { ownerId, ...input } });
}

/** Owner-scoped partial update; returns null when missing/not owned/deleted. */
export async function updateItem(
  ownerId: string,
  id: string,
  // `null` clears the column; `undefined` leaves it untouched (PATCH semantics).
  data: { name?: string; description?: string | null; category?: string | null },
  db: Db = prisma,
): Promise<Item | null> {
  const updated = await db.item.updateMany({ where: { id, ownerId, deletedAt: null }, data });
  if (updated.count === 0) return null;
  return db.item.findFirst({ where: { id, ownerId, deletedAt: null } });
}

/** FR-016 soft delete — events are untouched (append-only, FR-004). */
export async function softDeleteItem(ownerId: string, id: string, db: Db = prisma): Promise<Item | null> {
  const updated = await db.item.updateMany({
    where: { id, ownerId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (updated.count === 0) return null;
  return db.item.findFirst({ where: { id, ownerId } });
}

export async function restoreItem(ownerId: string, id: string, db: Db = prisma): Promise<Item | null> {
  const updated = await db.item.updateMany({
    where: { id, ownerId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (updated.count === 0) return null;
  return db.item.findFirst({ where: { id, ownerId, deletedAt: null } });
}

/** Idempotent archive: returns the item when it ends up archived, else null. */
export async function archiveItem(ownerId: string, id: string, db: Db = prisma): Promise<Item | null> {
  await db.item.updateMany({
    where: { id, ownerId, deletedAt: null, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return db.item.findFirst({ where: { id, ownerId, deletedAt: null } });
}

/** Idempotent unarchive: returns the item when it ends up active, else null. */
export async function unarchiveItem(ownerId: string, id: string, db: Db = prisma): Promise<Item | null> {
  await db.item.updateMany({
    where: { id, ownerId, deletedAt: null, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  return db.item.findFirst({ where: { id, ownerId, deletedAt: null } });
}

/** All non-deleted item names for the owner — input to the BR-03 duplicate warning. */
export async function activeItemNames(ownerId: string, db: Db = prisma): Promise<string[]> {
  const rows = await db.item.findMany({ where: { ownerId, deletedAt: null }, select: { name: true } });
  return rows.map((row) => row.name);
}
