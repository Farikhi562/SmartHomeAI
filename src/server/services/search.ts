import type { LastLocationDto, SearchQuery } from "@/lib/validation";
import { searchAll } from "@/server/repositories/search";
import type { SearchMatchType } from "@/server/repositories/search";
import { lastLocationsFor } from "@/server/services/items";
import { pathMapFor } from "@/server/services/locations";

/**
 * Search service (FR-005): wraps the ranked search repo and maps rows to the
 * API DTOs — items expose `lastLocation`, locations expose `path`.
 */

export type SearchItemHit = {
  id: string;
  name: string;
  category: string | null;
  score: number;
  matchType: SearchMatchType;
  lastLocation: LastLocationDto;
};

export type SearchLocationHit = {
  id: string;
  name: string;
  path: string;
  score: number;
  matchType: SearchMatchType;
};

export type SearchResult = {
  items: SearchItemHit[];
  locations: SearchLocationHit[];
  pagination: { limit: number; offset: number; total: number };
};

export async function search(ownerId: string, query: SearchQuery): Promise<SearchResult> {
  const { rows, total } = await searchAll(ownerId, query.q, query.type, {
    limit: query.limit,
    offset: query.offset,
  });
  const itemIds = rows.filter((row) => row.kind === "item").map((row) => row.id);
  const [lastLocations, paths] = await Promise.all([lastLocationsFor(ownerId, itemIds), pathMapFor(ownerId)]);

  const items: SearchItemHit[] = [];
  const locations: SearchLocationHit[] = [];
  for (const row of rows) {
    if (row.kind === "item") {
      items.push({
        id: row.id,
        name: row.name,
        category: row.category,
        score: row.score,
        matchType: row.matchType,
        lastLocation: lastLocations.get(row.id) ?? null,
      });
    } else {
      locations.push({
        id: row.id,
        name: row.name,
        path: paths.get(row.id) ?? row.name,
        score: row.score,
        matchType: row.matchType,
      });
    }
  }
  return { items, locations, pagination: { limit: query.limit, offset: query.offset, total } };
}

export type MinimalHit = { id: string; name: string; type: "item" | "location"; score: number };

/**
 * Deterministic best-effort hits for the FR-013 assistant fallback envelope.
 * Resilient by design: any failure yields an empty list, never an exception.
 */
export async function searchHits(ownerId: string, q: string, limit = 5): Promise<MinimalHit[]> {
  try {
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];
    const { rows } = await searchAll(ownerId, trimmed, "all", { limit, offset: 0 });
    return rows.slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.kind,
      score: row.score,
    }));
  } catch {
    return [];
  }
}
