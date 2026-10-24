import { prisma } from "@/lib/db";
import { errors } from "@/lib/errors";
import type { EventCreate, EventDto, PaginationQuery } from "@/lib/validation";
import type { EventConfidence, EventSource } from "@/generated/prisma/client";
import { createEvent, listEventsByItem, recentEvents } from "@/server/repositories/events";
import { getItem } from "@/server/repositories/items";
import { isValidOccurredAt } from "@/server/rules/events";
import { requireUsableLocation, pathMapFor } from "@/server/services/locations";

/**
 * Location-event service (FR-003, FR-004): append-only writes, read-only
 * timeline. Corrections append a new event — there is no update path (BR-06).
 */

export type EventCore = {
  id: string;
  itemId: string;
  locationId: string;
  occurredAt: Date;
  recordedAt: Date;
  source: EventSource;
  confidence: EventConfidence;
  note: string | null;
};

/** Read-only projection; `item` is included when the caller knows the name. */
export function toEventDto(
  ev: EventCore,
  itemName: string | undefined,
  location: { name: string; path: string },
): EventDto {
  return {
    id: ev.id,
    ...(itemName !== undefined ? { item: { id: ev.itemId, name: itemName } } : {}),
    location: { id: ev.locationId, name: location.name, path: location.path },
    occurredAt: ev.occurredAt.toISOString(),
    recordedAt: ev.recordedAt.toISOString(),
    source: ev.source,
    confidence: ev.confidence,
    note: ev.note,
  };
}

/**
 * FR-003/FR-004: record where an item was placed. `occurredAt` may be
 * backdated; more than 5 minutes into the future is a VALIDATION_ERROR.
 * The row is inserted (never updated) inside a transaction.
 */
export async function recordLocation(
  ownerId: string,
  itemId: string,
  input: EventCreate,
): Promise<EventDto> {
  const item = await getItem(ownerId, itemId);
  if (!item) throw errors.notFound("Item");
  const location = await requireUsableLocation(ownerId, input.locationId);

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (!isValidOccurredAt(occurredAt)) {
    throw errors.validation(
      [{ path: "occurredAt", issue: "occurredAt cannot be more than 5 minutes in the future." }],
      "Invalid occurredAt.",
    );
  }

  const paths = await pathMapFor(ownerId);
  const event = await prisma.$transaction((tx) =>
    createEvent(
      ownerId,
      {
        itemId,
        locationId: input.locationId,
        occurredAt,
        source: "MANUAL",
        confidence: "CONFIRMED",
        note: input.note,
      },
      tx,
    ),
  );
  return toEventDto(event, item.name, {
    name: location.name,
    path: paths.get(location.id) ?? location.name,
  });
}

/** Item timeline, newest first (FR-004.3); 404 when the item is not owned. */
export async function timeline(
  ownerId: string,
  itemId: string,
  page: PaginationQuery,
): Promise<{ events: EventDto[]; total: number }> {
  const item = await getItem(ownerId, itemId);
  if (!item) throw errors.notFound("Item");
  const [feed, paths] = await Promise.all([listEventsByItem(ownerId, itemId, page), pathMapFor(ownerId)]);
  const events = feed.rows.map((row) =>
    toEventDto(row, row.itemName, {
      name: row.locationName,
      path: paths.get(row.locationId) ?? row.locationName,
    }),
  );
  return { events, total: feed.total };
}

/** FR-018 activity feed: recent events across items, newest first. */
export async function activity(
  ownerId: string,
  sinceDays: number,
  page: PaginationQuery,
): Promise<{ entries: EventDto[]; total: number }> {
  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const [feed, paths] = await Promise.all([recentEvents(ownerId, sinceDate, page), pathMapFor(ownerId)]);
  const entries = feed.rows.map((row) =>
    toEventDto(row, row.itemName, {
      name: row.locationName,
      path: paths.get(row.locationId) ?? row.locationName,
    }),
  );
  return { entries, total: feed.total };
}
