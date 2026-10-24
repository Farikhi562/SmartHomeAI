import { prisma } from "@/lib/db";
import { errors } from "@/lib/errors";
import type { ItemCreate, ItemDto, ItemListQuery, ItemUpdate, LastLocationDto } from "@/lib/validation";
import type { Item } from "@/generated/prisma/client";
import {
  activeItemNames,
  archiveItem,
  createItem,
  findIncludeDeleted,
  getItem,
  listItems,
  restoreItem,
  softDeleteItem,
  unarchiveItem,
  updateItem,
} from "@/server/repositories/items";
import { createEvent, lastEventForItems } from "@/server/repositories/events";
import { duplicateNameWarning, isRestorable } from "@/server/rules/items";
import { AuditService } from "@/server/services/audit";
import { pathMapFor, requireUsableLocation } from "@/server/services/locations";

/**
 * Item service (FR-002, FR-003, FR-016). ownerId always comes from the
 * verified session; every repository call stays owner-scoped underneath.
 */

export type ItemWarning = { code: "DUPLICATE_NAME"; matches: string[] };
export type ItemCreateResult = ItemDto & { warnings: ItemWarning[] };

export function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function toItemDto(item: Item, lastLocation: LastLocationDto): ItemDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    createdVia: item.createdVia,
    archivedAt: iso(item.archivedAt),
    deletedAt: iso(item.deletedAt),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    lastLocation,
  };
}

/**
 * Last recorded location per item (FR-003.3): derived from the newest event,
 * never stored on the item row. A missing path means the location row is gone.
 */
export async function lastLocationsFor(ownerId: string, itemIds: string[]): Promise<Map<string, LastLocationDto>> {
  const result = new Map<string, LastLocationDto>();
  if (itemIds.length === 0) return result;
  const [events, paths] = await Promise.all([lastEventForItems(ownerId, itemIds), pathMapFor(ownerId)]);
  for (const [itemId, event] of events) {
    const path = paths.get(event.locationId);
    if (path === undefined) continue;
    result.set(itemId, {
      locationId: event.locationId,
      name: event.locationName,
      path,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
  return result;
}

/** Fetch `lastLocation` for a single item (null when it has no events). */
async function lastLocationFor(ownerId: string, itemId: string): Promise<LastLocationDto> {
  const map = await lastLocationsFor(ownerId, [itemId]);
  return map.get(itemId) ?? null;
}

/**
 * Create an item (BR-03: duplicates warn, never block). When `locationId` is
 * given, an initial MANUAL/CONFIRMED event is appended in the SAME transaction
 * (FR-003.1) so the first memory and the item land atomically.
 */
export async function create(ownerId: string, input: ItemCreate): Promise<ItemCreateResult> {
  const [existingNames, location] = await Promise.all([
    activeItemNames(ownerId),
    input.locationId ? requireUsableLocation(ownerId, input.locationId) : Promise.resolve(null),
  ]);

  const now = new Date();
  const item = await prisma.$transaction(async (tx) => {
    const created = await createItem(
      ownerId,
      { name: input.name, description: input.description, category: input.category },
      tx,
    );
    if (input.locationId) {
      await createEvent(
        ownerId,
        {
          itemId: created.id,
          locationId: input.locationId,
          occurredAt: now,
          source: "MANUAL",
          confidence: "CONFIRMED",
        },
        tx,
      );
    }
    return created;
  });

  const lastLocation: LastLocationDto =
    location && input.locationId
      ? {
          locationId: input.locationId,
          name: location.name,
          path: (await pathMapFor(ownerId)).get(location.id) ?? location.name,
          occurredAt: now.toISOString(),
        }
      : null;

  const warning = duplicateNameWarning(input.name, existingNames);
  const warnings: ItemWarning[] = warning.warn ? [{ code: "DUPLICATE_NAME", matches: warning.matches }] : [];
  return { ...toItemDto(item, lastLocation), warnings };
}

export async function get(ownerId: string, id: string): Promise<ItemDto> {
  const item = await getItem(ownerId, id);
  if (!item) throw errors.notFound("Item");
  return toItemDto(item, await lastLocationFor(ownerId, id));
}

export async function list(ownerId: string, query: ItemListQuery): Promise<{ items: ItemDto[]; total: number }> {
  const { rows, total } = await listItems(ownerId, query);
  const lastLocations = await lastLocationsFor(
    ownerId,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => toItemDto(row, lastLocations.get(row.id) ?? null)),
    total,
  };
}

/** FR-002.3: field edits only — historical events are never touched (FR-004). */
export async function update(ownerId: string, id: string, input: ItemUpdate): Promise<ItemDto> {
  const item = await updateItem(ownerId, id, input);
  if (!item) throw errors.notFound("Item");
  return toItemDto(item, await lastLocationFor(ownerId, id));
}

/** FR-016 soft delete + audit; a repeated delete reads as 404. */
export async function remove(ownerId: string, id: string): Promise<ItemDto> {
  const item = await softDeleteItem(ownerId, id);
  if (!item) throw errors.notFound("Item");
  await AuditService.record({
    ownerId,
    actorType: "user",
    action: "ITEM_DELETED",
    targetType: "item",
    targetId: item.id,
    metadata: { nameLength: item.name.length },
  });
  return toItemDto(item, await lastLocationFor(ownerId, id));
}

/** BR-07: restorable for 30 days, otherwise 409 (the row lives until purge). */
export async function restore(ownerId: string, id: string): Promise<ItemDto> {
  const existing = await findIncludeDeleted(ownerId, id);
  if (!existing) throw errors.notFound("Item");
  if (existing.deletedAt === null) throw errors.conflict("This item is not deleted.");
  if (!isRestorable(existing.deletedAt)) {
    throw errors.conflict("The 30-day restore window has passed. This item will be purged by the retention job.");
  }
  const item = (await restoreItem(ownerId, id)) ?? (await findIncludeDeleted(ownerId, id));
  if (!item || item.deletedAt !== null) throw errors.notFound("Item");
  await AuditService.record({
    ownerId,
    actorType: "user",
    action: "ITEM_RESTORED",
    targetType: "item",
    targetId: item.id,
  });
  return toItemDto(item, await lastLocationFor(ownerId, id));
}

export async function archive(ownerId: string, id: string): Promise<ItemDto> {
  const item = await archiveItem(ownerId, id);
  if (!item) throw errors.notFound("Item");
  return toItemDto(item, await lastLocationFor(ownerId, id));
}

export async function unarchive(ownerId: string, id: string): Promise<ItemDto> {
  const item = await unarchiveItem(ownerId, id);
  if (!item) throw errors.notFound("Item");
  return toItemDto(item, await lastLocationFor(ownerId, id));
}
