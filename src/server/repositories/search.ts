import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { log } from "@/lib/observability/logger";
import type { PaginationQuery } from "@/lib/validation";

/**
 * Deterministic search over the owner's items and locations (FR-005).
 *
 * Ranking: exact normalized name (1.0) > prefix (`q%`, 0.9) > trigram
 * similarity on name (0.5–0.89) > ILIKE contains (0.4); archived rows are
 * demoted by −0.3. Items match on name/description/category, locations on
 * name — queried separately so `type` filtering stays a single query per
 * entity. All user input is bound as SQL parameters, never interpolated (S-7).
 *
 * pg_trgm comes from the search migration (V2__search.sql) and may be absent
 * on a bare local database; the trigram SELECT is therefore attempted first
 * and any failure falls back to pure ILIKE ranking (documented fallback).
 */

export type SearchMatchType = "exact" | "prefix" | "trigram" | "contains";

export type SearchRow = {
  id: string;
  name: string;
  category: string | null;
  path: string | null;
  score: number;
  matchType: SearchMatchType;
  archivedAt: Date | null;
  kind: "item" | "location";
};

type SearchScope = "items" | "locations" | "all";

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Score expression: trigram-capable variant (requires pg_trgm `similarity`). */
function trigramScore(alias: "i" | "l", q: string): Prisma.Sql {
  const normalized = q.toLowerCase();
  const prefix = `${escapeLike(normalized)}%`;
  const contains = `%${escapeLike(q)}%`;
  return Prisma.sql`(CASE
    WHEN lower(${Prisma.raw(alias)}.name) = ${normalized} THEN 1.0
    WHEN lower(${Prisma.raw(alias)}.name) LIKE ${prefix} THEN 0.9
    WHEN ${Prisma.raw(alias)}.name ILIKE ${contains}
      THEN LEAST(0.89, 0.5 + 0.39 * similarity(lower(${Prisma.raw(alias)}.name), ${normalized}))
    ELSE 0.4
  END)`;
}

/** Fallback score when pg_trgm is unavailable: same tiers, flat contains. */
function ilikeScore(alias: "i" | "l", q: string): Prisma.Sql {
  const normalized = q.toLowerCase();
  const prefix = `${escapeLike(normalized)}%`;
  return Prisma.sql`(CASE
    WHEN lower(${Prisma.raw(alias)}.name) = ${normalized} THEN 1.0
    WHEN lower(${Prisma.raw(alias)}.name) LIKE ${prefix} THEN 0.9
    ELSE 0.4
  END)`;
}

function matchTypeExpr(alias: "i" | "l", q: string): Prisma.Sql {
  const normalized = q.toLowerCase();
  const prefix = `${escapeLike(normalized)}%`;
  const contains = `%${escapeLike(q)}%`;
  return Prisma.sql`(CASE
    WHEN lower(${Prisma.raw(alias)}.name) = ${normalized} THEN 'exact'
    WHEN lower(${Prisma.raw(alias)}.name) LIKE ${prefix} THEN 'prefix'
    WHEN ${Prisma.raw(alias)}.name ILIKE ${contains} THEN 'trigram'
    ELSE 'contains'
  END)`;
}

function fallbackMatchTypeExpr(alias: "i" | "l", q: string): Prisma.Sql {
  const normalized = q.toLowerCase();
  const prefix = `${escapeLike(normalized)}%`;
  return Prisma.sql`(CASE
    WHEN lower(${Prisma.raw(alias)}.name) = ${normalized} THEN 'exact'
    WHEN lower(${Prisma.raw(alias)}.name) LIKE ${prefix} THEN 'prefix'
    ELSE 'contains'
  END)`;
}

/** WHERE fragment per entity (no scoring functions → safe for COUNT too). */
function filterSql(table: "items" | "locations", ownerId: string, q: string): Prisma.Sql {
  const contains = `%${escapeLike(q)}%`;
  if (table === "items") {
    return Prisma.sql`
      i.owner_id = ${ownerId}
      AND i.deleted_at IS NULL
      AND (
        i.name ILIKE ${contains}
        OR lower(coalesce(i.description, '')) ILIKE ${contains}
        OR i.category ILIKE ${contains}
      )`;
  }
  return Prisma.sql`l.owner_id = ${ownerId} AND l.name ILIKE ${contains}`;
}

function selectSql(
  table: "items" | "locations",
  ownerId: string,
  q: string,
  useTrigram: boolean,
): Prisma.Sql {
  const alias = table === "items" ? "i" : "l";
  const score = useTrigram ? trigramScore(alias, q) : ilikeScore(alias, q);
  const matchType = useTrigram ? matchTypeExpr(alias, q) : fallbackMatchTypeExpr(alias, q);
  const archivedDemote = Prisma.sql`(CASE WHEN ${Prisma.raw(alias)}.archived_at IS NOT NULL THEN 0.3 ELSE 0.0 END)`;
  const kind = table === "items" ? Prisma.sql`'item'::text` : Prisma.sql`'location'::text`;

  if (table === "items") {
    return Prisma.sql`
      SELECT
        i.id, i.name, i.category,
        NULL::text AS path,
        i.archived_at AS "archivedAt",
        (${score} - ${archivedDemote})::float8 AS score,
        ${matchType}::text AS "matchType",
        ${kind} AS kind
      FROM items i
      WHERE ${filterSql("items", ownerId, q)}`;
  }
  return Prisma.sql`
    SELECT
      l.id, l.name,
      NULL::text AS category,
      NULL::text AS path,
      l.archived_at AS "archivedAt",
      (${score} - ${archivedDemote})::float8 AS score,
      ${matchType}::text AS "matchType",
      ${kind} AS kind
    FROM locations l
    WHERE ${filterSql("locations", ownerId, q)}`;
}

function countSql(table: "items" | "locations", ownerId: string, q: string): Prisma.Sql {
  if (table === "items") {
    return Prisma.sql`SELECT COUNT(*)::int AS count FROM items i WHERE ${filterSql("items", ownerId, q)}`;
  }
  return Prisma.sql`SELECT COUNT(*)::int AS count FROM locations l WHERE ${filterSql("locations", ownerId, q)}`;
}

async function runEntity(
  table: "items" | "locations",
  ownerId: string,
  q: string,
  fetchLimit: number,
): Promise<{ rows: SearchRow[]; total: number }> {
  // Probe the trigram path first; fall back to ILIKE ranking when pg_trgm
  // (or similarity()) is missing from the database.
  let rows: SearchRow[];
  try {
    rows = await prisma.$queryRaw<SearchRow[]>`
      SELECT * FROM (${selectSql(table, ownerId, q, true)}) ranked
      ORDER BY score DESC, name ASC, id ASC
      LIMIT ${fetchLimit}
    `;
  } catch (err) {
    log.warn({
      event: "search.pg_trgm_unavailable",
      fallback: "ilike",
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    rows = await prisma.$queryRaw<SearchRow[]>`
      SELECT * FROM (${selectSql(table, ownerId, q, false)}) ranked
      ORDER BY score DESC, name ASC, id ASC
      LIMIT ${fetchLimit}
    `;
  }
  const counts = await prisma.$queryRaw<{ count: number }[]>(countSql(table, ownerId, q));
  return { rows, total: counts[0]?.count ?? 0 };
}

/**
 * Owner-scoped ranked search across items and locations. Both sources fetch
 * their own top `offset + limit` rows; merging those windows and slicing
 * yields the correct global window because a row outside its own top-k can
 * never be in the merged top-k.
 */
export async function searchAll(
  ownerId: string,
  q: string,
  type: SearchScope,
  page: PaginationQuery,
): Promise<{ rows: SearchRow[]; total: number }> {
  const fetchLimit = page.offset + page.limit;
  const wantItems = type !== "locations";
  const wantLocations = type !== "items";

  const [items, locations] = await Promise.all([
    wantItems ? runEntity("items", ownerId, q, fetchLimit) : Promise.resolve({ rows: [] as SearchRow[], total: 0 }),
    wantLocations
      ? runEntity("locations", ownerId, q, fetchLimit)
      : Promise.resolve({ rows: [] as SearchRow[], total: 0 }),
  ]);

  const merged = [...items.rows, ...locations.rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  return { rows: merged.slice(0, fetchLimit), total: items.total + locations.total };
}
