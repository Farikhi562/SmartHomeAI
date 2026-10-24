import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  EventConfidence,
  EventSource,
  ItemLocationEvent,
  PrismaClient,
} from "@/generated/prisma/client";
import type { PaginationQuery } from "@/lib/validation";

/**
 * Location-event data access (FR-003/FR-004). This table is APPEND-ONLY:
 * the module exposes create/read only — no update or delete exists here (BR-06).
 */

type Db = PrismaClient | Prisma.TransactionClient;

export type EventRow = ItemLocationEvent & { locationName: string; itemName: string };

const EVENT_WITH_NAMES = Prisma.sql`
  e.id,
  e.owner_id AS "ownerId",
  e.item_id AS "itemId",
  e.location_id AS "locationId",
  e.occurred_at AS "occurredAt",
  e.recorded_at AS "recordedAt",
  e.source,
  e.confidence,
  e.note,
  e.message_id AS "messageId",
  it.name AS "itemName",
  lo.name AS "locationName"
`;

const EVENT_ROW_MAPPER = (row: {
  id: string;
  ownerId: string;
  itemId: string;
  locationId: string;
  occurredAt: Date;
  recordedAt: Date;
  source: EventSource;
  confidence: EventConfidence;
  note: string | null;
  messageId: string | null;
  itemName: string;
  locationName: string;
}): EventRow => ({ ...row });

/** Newest-first timeline for one item, paginated. */
export async function listEventsByItem(
  ownerId: string,
  itemId: string,
  page: PaginationQuery,
): Promise<{ rows: (ItemLocationEvent & { itemName: string; locationName: string })[]; total: number }> {
  const where: Prisma.ItemLocationEventWhereInput = { ownerId, itemId };
  const [rows, total] = await Promise.all([
    prisma.itemLocationEvent.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }, { id: "desc" }],
      skip: page.offset,
      take: page.limit,
      include: { item: { select: { name: true } }, location: { select: { name: true } } },
    }),
    prisma.itemLocationEvent.count({ where }),
  ]);
  return {
    rows: rows.map(({ item, location, ...rest }) => ({
      ...rest,
      itemName: item.name,
      locationName: location.name,
    })),
    total,
  };
}

export type CreateEventInput = {
  itemId: string;
  locationId: string;
  occurredAt: Date;
  source: EventSource;
  confidence: EventConfidence;
  note?: string;
  messageId?: string;
};

/** Append a single event. Never call an update/delete on this table (FR-004). */
export async function createEvent(
  ownerId: string,
  input: CreateEventInput,
  db: Db = prisma,
): Promise<ItemLocationEvent> {
  return db.itemLocationEvent.create({ data: { ownerId, ...input } });
}

/** Activity feed / dashboard: recent events by recordedAt, newest first. */
export async function recentEvents(
  ownerId: string,
  sinceDate: Date,
  page: PaginationQuery,
): Promise<{ rows: (ItemLocationEvent & { itemName: string; locationName: string })[]; total: number }> {
  const where: Prisma.ItemLocationEventWhereInput = { ownerId, recordedAt: { gte: sinceDate } };
  const [rows, total] = await Promise.all([
    prisma.itemLocationEvent.findMany({
      where,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      skip: page.offset,
      take: page.limit,
      include: { item: { select: { name: true } }, location: { select: { name: true } } },
    }),
    prisma.itemLocationEvent.count({ where }),
  ]);
  return {
    rows: rows.map(({ item, location, ...rest }) => ({
      ...rest,
      itemName: item.name,
      locationName: location.name,
    })),
    total,
  };
}

/**
 * Latest event per item (ties broken by recordedAt then id — same ordering as
 * deriveLastLocation) as a Map. Parameterized only: ids are bound, never
 * interpolated. Returns rows joined with item/location names for DTO mapping.
 */
export async function lastEventForItems(ownerId: string, itemIds: string[]): Promise<Map<string, EventRow>> {
  const map = new Map<string, EventRow>();
  if (itemIds.length === 0) return map;
  const rows = await prisma.$queryRaw<
    {
      id: string;
      ownerId: string;
      itemId: string;
      locationId: string;
      occurredAt: Date;
      recordedAt: Date;
      source: EventSource;
      confidence: EventConfidence;
      note: string | null;
      messageId: string | null;
      itemName: string;
      locationName: string;
    }[]
  >`
    SELECT DISTINCT ON (e.item_id) ${EVENT_WITH_NAMES}
    FROM item_location_events e
    JOIN items it ON it.id = e.item_id
    JOIN locations lo ON lo.id = e.location_id
    WHERE e.owner_id = ${ownerId}
      AND e.item_id IN (${Prisma.join(itemIds)})
    ORDER BY e.item_id ASC, e.occurred_at DESC, e.recorded_at DESC, e.id DESC
  `;
  for (const row of rows) map.set(row.itemId, EVENT_ROW_MAPPER(row));
  return map;
}

/**
 * Items whose LAST recorded location is the given location (list_contents):
 * same DISTINCT ON ordering as lastEventForItems, filtered to one location.
 */
export async function itemsLastLocatedAt(
  ownerId: string,
  locationId: string,
  limit: number,
): Promise<EventRow[]> {
  return prisma.$queryRaw<
    {
      id: string;
      ownerId: string;
      itemId: string;
      locationId: string;
      occurredAt: Date;
      recordedAt: Date;
      source: EventSource;
      confidence: EventConfidence;
      note: string | null;
      messageId: string | null;
      itemName: string;
      locationName: string;
    }[]
  >`
    SELECT DISTINCT ON (e.item_id) ${EVENT_WITH_NAMES}
    FROM item_location_events e
    JOIN items it ON it.id = e.item_id
    JOIN locations lo ON lo.id = e.location_id
    WHERE e.owner_id = ${ownerId}
      AND e.location_id = ${locationId}
      AND it.deleted_at IS NULL
      AND it.archived_at IS NULL
    ORDER BY e.item_id ASC, e.occurred_at DESC, e.recorded_at DESC, e.id DESC
    LIMIT ${limit}
  `.then((rows) => rows.map(EVENT_ROW_MAPPER));
}
