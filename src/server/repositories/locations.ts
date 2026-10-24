import { prisma } from "@/lib/db";
import type { Location, Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Location hierarchy data access (FR-017). All reads/writes are owner-scoped;
 * depth and sibling-uniqueness rules live in the service layer (BR-04).
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Flat list, non-archived by default; ordered root/parent groups then by name. */
export async function listLocations(ownerId: string, includeArchived: boolean): Promise<Location[]> {
  return prisma.location.findMany({
    where: { ownerId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function getLocation(ownerId: string, id: string, db: Db = prisma): Promise<Location | null> {
  return db.location.findFirst({ where: { id, ownerId } });
}

export async function getLocationsByIds(ownerId: string, ids: string[], db: Db = prisma): Promise<Location[]> {
  if (ids.length === 0) return [];
  return db.location.findMany({ where: { ownerId, id: { in: ids } } });
}

/**
 * Ancestor ids of `id` ordered root → parent (self excluded).
 * Walks parentId links with a visited-set guard; depth is bounded (BR-04) so
 * this is at most a handful of queries.
 */
export async function ancestorChain(ownerId: string, id: string): Promise<string[]> {
  const chain: string[] = [];
  const seen = new Set<string>();
  const self = await getLocation(ownerId, id);
  let current = self?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    const parent: Location | null = await getLocation(ownerId, current);
    if (!parent) break; // parent missing/not owned: treat as chain root
    current = parent.parentId;
  }
  return chain.reverse();
}

export async function createLocation(
  ownerId: string,
  input: { name: string; description?: string; parentId?: string | null },
  db: Db = prisma,
): Promise<Location> {
  return db.location.create({ data: { ownerId, ...input } });
}

export async function updateLocation(
  ownerId: string,
  id: string,
  // `description` accepts `null` to clear the column (PATCH semantics).
  data: { name?: string; description?: string | null; parentId?: string | null },
  db: Db = prisma,
): Promise<Location | null> {
  const updated = await db.location.updateMany({ where: { id, ownerId }, data });
  if (updated.count === 0) return null;
  return db.location.findFirst({ where: { id, ownerId } });
}

export async function archiveLocation(ownerId: string, id: string, db: Db = prisma): Promise<Location | null> {
  await db.location.updateMany({ where: { id, ownerId, archivedAt: null }, data: { archivedAt: new Date() } });
  return db.location.findFirst({ where: { id, ownerId } });
}

/**
 * Hard delete — only legal when childless and unreferenced (FR-017); the
 * service verifies both conditions first (the parent FK is RESTRICT anyway).
 */
export async function deleteLocation(ownerId: string, id: string, db: Db = prisma): Promise<boolean> {
  const deleted = await db.location.deleteMany({ where: { id, ownerId } });
  return deleted.count > 0;
}

export async function countChildren(ownerId: string, id: string, db: Db = prisma): Promise<number> {
  return db.location.count({ where: { ownerId, parentId: id } });
}

/**
 * Reference counts for the BR-05 archive guard.
 * Items reference a location only through events (the Item row has no
 * location FK): `events` counts every event at the location, `items` counts
 * distinct non-deleted items that have at least one such event.
 */
export async function countReferences(id: string): Promise<{ items: number; events: number }> {
  const rows = await prisma.$queryRaw<{ items: number; events: number }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM item_location_events ev WHERE ev.location_id = ${id}) AS events,
      (
        SELECT COUNT(DISTINCT ev.item_id)::int
        FROM item_location_events ev
        JOIN items it ON it.id = ev.item_id
        WHERE ev.location_id = ${id} AND it.deleted_at IS NULL
      ) AS items
  `;
  const row = rows[0];
  return { items: row?.items ?? 0, events: row?.events ?? 0 };
}

/**
 * Siblings used for BR-04 uniqueness: same owner + same parent (null = root),
 * normally only non-archived rows. `includeArchivedId` additionally pulls in
 * one specific (possibly archived) row — used when validating a rename or
 * re-parent of that location itself.
 */
export async function siblings(
  ownerId: string,
  parentId: string | null,
  includeArchivedId?: string,
): Promise<Location[]> {
  const archivedFilter: Prisma.LocationWhereInput = includeArchivedId
    ? { OR: [{ archivedAt: null }, { id: includeArchivedId }] }
    : { archivedAt: null };
  return prisma.location.findMany({ where: { ownerId, parentId, ...archivedFilter } });
}
