/**
 * Data export (FR-022, API_SPEC §3.7): one owner-scoped snapshot of every row
 * the user has recorded — items, locations, location events, preferences —
 * with `exportedAt`. Conversations are DELIBERATELY excluded (content
 * minimization, FR-022): chat content is not part of the default export.
 *
 * Layering: routes call this service, this service calls repositories — no
 * Prisma import here or in the route. Rows are read uncapped (the paginated
 * list helpers are for views); personal-scale data keeps the payload small.
 */

import type { EventDto, ItemDto, LocationDto } from "@/lib/validation";
import { allEvents } from "@/server/repositories/events";
import { allItems } from "@/server/repositories/items";
import { listLocations } from "@/server/repositories/locations";
import { getPreferences } from "@/server/repositories/users";
import { AuditService } from "@/server/services/audit";
import { toEventDto } from "@/server/services/events";
import { lastLocationsFor, toItemDto } from "@/server/services/items";
import { buildTree, toLocationDto } from "@/server/services/locations";

export type PreferencesSnapshot = {
  theme: string;
  locale: string | null;
  showSuggestedQuestions: boolean;
};

export type ExportPayload = {
  items: ItemDto[];
  locations: LocationDto[];
  events: EventDto[];
  preferences: PreferencesSnapshot;
  exportedAt: string;
};

/**
 * Build the whole export for one owner (uncapped). Items = every non-deleted
 * row (archived included — they still belong to the owner, matching the
 * "Semua" filter); events are limited to those of the exported items so the
 * file has no dangling references.
 */
export async function collect(ownerId: string): Promise<ExportPayload> {
  const [rows, locationRows, eventRows, preferences] = await Promise.all([
    allItems(ownerId),
    listLocations(ownerId, true),
    allEvents(ownerId),
    getPreferences(ownerId),
  ]);

  const lastLocations = await lastLocationsFor(
    ownerId,
    rows.map((row) => row.id),
  );
  const items = rows.map((row) => toItemDto(row, lastLocations.get(row.id) ?? null));

  const tree = buildTree(locationRows);
  const exportedItemIds = new Set(items.map((item) => item.id));
  // Events of soft-deleted items are dropped so the file stays self-consistent
  // (no dangling item references) and matches the exported item list.
  const events = eventRows
    .filter((row) => exportedItemIds.has(row.itemId))
    .map((row) =>
      toEventDto(row, row.itemName, {
        name: row.locationName,
        path: tree.path.get(row.locationId) ?? row.locationName,
      }),
    );

  const payload: ExportPayload = {
    items,
    locations: locationRows.map((loc) => toLocationDto(loc, tree)),
    events,
    preferences: {
      theme: preferences.theme,
      locale: preferences.locale,
      showSuggestedQuestions: preferences.showSuggestedQuestions,
    },
    exportedAt: new Date().toISOString(),
  };

  // AC-022-1: every export is audited. Operational counts only — never content (BR-09).
  await AuditService.record({
    ownerId,
    actorType: "user",
    action: "DATA_EXPORTED",
    metadata: {
      itemCount: payload.items.length,
      locationCount: payload.locations.length,
      eventCount: payload.events.length,
    },
  });

  return payload;
}
