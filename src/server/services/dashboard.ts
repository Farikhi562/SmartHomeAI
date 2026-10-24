import type { EventDto, ItemDto } from "@/lib/validation";
import { listItems } from "@/server/repositories/items";
import { recentEvents } from "@/server/repositories/events";
import { listLocations } from "@/server/repositories/locations";
import { toItemDto, lastLocationsFor } from "@/server/services/items";
import { toEventDto } from "@/server/services/events";
import { buildTree } from "@/server/services/locations";

/**
 * Dashboard aggregation (FR-015): only counts derivable from stored data —
 * never invented metrics (FR-015.3). Works fully without the LLM (FR-013.1).
 */

export type DashboardSummary = {
  totalActiveItems: number;
  recentlyUpdatedItems: ItemDto[];
  recentEvents: EventDto[];
  locationCount: number;
};

const RECENT_WINDOW_DAYS = 7;
const FEED_WINDOW_DAYS = 30;
const MAX_ROWS = 5;

export async function summary(ownerId: string): Promise<DashboardSummary> {
  const weekAgo = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const feedSince = new Date(Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [active, updated, feed, locations] = await Promise.all([
    listItems(ownerId, { limit: 1, offset: 0, status: "active", sort: "updatedAt", order: "desc" }),
    listItems(ownerId, {
      limit: 100,
      offset: 0,
      status: "active",
      sort: "updatedAt",
      order: "desc",
    }),
    recentEvents(ownerId, feedSince, { limit: MAX_ROWS, offset: 0 }),
    listLocations(ownerId, false),
  ]);

  const recentRows = updated.rows.filter((row) => row.updatedAt >= weekAgo).slice(0, MAX_ROWS);
  const lastLocations = await lastLocationsFor(
    ownerId,
    recentRows.map((row) => row.id),
  );
  const paths = buildTree(locations).path;

  return {
    totalActiveItems: active.total,
    recentlyUpdatedItems: recentRows.map((row) => toItemDto(row, lastLocations.get(row.id) ?? null)),
    recentEvents: feed.rows.map((row) =>
      toEventDto(row, row.itemName, {
        name: row.locationName,
        path: paths.get(row.locationId) ?? row.locationName,
      }),
    ),
    locationCount: locations.length,
  };
}
