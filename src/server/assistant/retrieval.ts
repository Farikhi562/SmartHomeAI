import { searchAll } from "@/server/repositories/search";
import type { SearchRow } from "@/server/repositories/search";
import { getItemsByIds } from "@/server/repositories/items";
import { itemsLastLocatedAt, lastEventForItems } from "@/server/repositories/events";
import { listLocations } from "@/server/repositories/locations";
import { buildTree, pathMapFor } from "@/server/services/locations";
import { MAX_RETRIEVED_RECORDS } from "./types";
import type { Entities, RetrievedRecord } from "./types";

/**
 * Grounding retrieval (FR-007, ANSWER_GENERATION/MEMORY_EXTRACTION docs).
 *
 * The pipeline hands the model ONLY what this module returns, so everything
 * here stays owner-scoped and deterministic — no LLM in the loop. Items are
 * matched through the ranked search repo (pg_trgm with the documented ILIKE
 * fallback), with a token fallback for phrases like "my keys" that an ILIKE
 * contains-query cannot match. Locations additionally match on their full
 * path ("bedroom drawer" → "Home / Bedroom / Drawer"), which name-only SQL
 * search cannot express.
 *
 * Beyond the retrieved records, the result carries ambiguity signals the
 * write branch needs: `candidates`/`locationCandidates` (ranked, filtered to
 * genuine rivals) and the unique `resolvedItem`/`resolvedLocation` when the
 * query names exactly one of each.
 */

const MIN_ITEM_SCORE = 0.55;
const MIN_LOCATION_SCORE = 0.6;
/** Two matches are "rivals" only within this factor of the top score (FR-009). */
const AMBIGUITY_MARGIN = 1.3;
const MAX_TERMS_PER_KIND = 3;
const FETCH_PER_TERM = 8;
const MAX_CANDIDATES = 5;
const MAX_ITEM_RECORDS = 6;
const MAX_LOCATION_RECORDS = 4;
const MAX_LOCATION_CONTENTS = 10;

/** Words that carry no identity when a classifier keeps them inside a name. */
const STOPWORDS = new Set(["the", "my", "our", "your", "a", "an", "is", "are", "in", "of", "and", "it"]);

export type ItemCandidate = {
  id: string;
  name: string;
  score: number;
  lastLocationName: string | null;
};

export type LocationCandidate = {
  id: string;
  name: string;
  path: string;
  score: number;
};

export type RetrievalResult = {
  records: RetrievedRecord[];
  candidates: ItemCandidate[];
  locationCandidates: LocationCandidate[];
  resolvedItem: ItemCandidate | null;
  resolvedLocation: LocationCandidate | null;
  confidence: number;
};

/** Trim, drop near-empty terms, dedupe case-insensitively, cap the count. */
function dedupeTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const term = raw.trim();
    if (term.length < 2) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_TERMS_PER_KIND) break;
  }
  return out;
}

/** Multi-word terms also search their meaningful tokens ("my keys" → "keys"). */
function expandTerms(terms: string[]): string[] {
  const out = [...terms];
  for (const term of terms) {
    const tokens = term.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()));
    for (const token of tokens) {
      if (out.length >= MAX_TERMS_PER_KIND * 2) return out;
      if (!out.some((existing) => existing.toLowerCase() === token.toLowerCase())) out.push(token);
    }
  }
  return out;
}

/** Ranked SQL matches per entity, best score wins on overlaps. Archived excluded. */
async function bestMatches(
  ownerId: string,
  terms: string[],
  type: "items" | "locations",
): Promise<SearchRow[]> {
  if (terms.length === 0) return [];
  const batches = await Promise.all(
    terms.map((term) => searchAll(ownerId, term, type, { limit: FETCH_PER_TERM, offset: 0 })),
  );
  const best = new Map<string, SearchRow>();
  for (const { rows } of batches) {
    for (const row of rows) {
      if (row.archivedAt !== null) continue;
      const prev = best.get(row.id);
      if (!prev || row.score > prev.score) best.set(row.id, row);
    }
  }
  return [...best.values()].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/**
 * Location phrase matches against the full path — the SQL search only covers
 * names, but users say "bedroom drawer", not "Drawer". Deterministic tiers:
 * exact path 0.95, path contains phrase 0.7, all phrase tokens in path 0.65.
 */
async function pathMatches(ownerId: string, terms: string[]): Promise<LocationCandidate[]> {
  if (terms.length === 0) return [];
  const all = await listLocations(ownerId, false);
  const tree = buildTree(all);
  const out: LocationCandidate[] = [];
  for (const loc of all) {
    const path = tree.path.get(loc.id) ?? loc.name;
    const flat = path.toLowerCase();
    let bestScore = 0;
    for (const term of terms) {
      const phrase = term.toLowerCase();
      let score = 0;
      if (flat === phrase) score = 0.95;
      else if (flat.includes(phrase)) score = 0.7;
      else {
        const tokens = phrase.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()));
        if (tokens.length > 1 && tokens.every((token) => flat.includes(token))) score = 0.65;
      }
      if (score > bestScore) bestScore = score;
    }
    if (bestScore > 0) {
      out.push({ id: loc.id, name: loc.name, path, score: bestScore });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
}

/** Merge SQL name matches with path matches, keeping the higher score per id. */
function mergeLocations(sqlRows: SearchRow[], pathRows: LocationCandidate[], paths: Map<string, string>): LocationCandidate[] {
  const best = new Map<string, LocationCandidate>();
  for (const row of sqlRows) {
    best.set(row.id, {
      id: row.id,
      name: row.name,
      path: paths.get(row.id) ?? row.name,
      score: row.score,
    });
  }
  for (const row of pathRows) {
    const prev = best.get(row.id);
    if (!prev || row.score > prev.score) best.set(row.id, row);
  }
  return [...best.values()].sort(
    (a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.id.localeCompare(b.id),
  );
}

/**
 * Keep only genuine rivals: everything at/above the minimum score AND within
 * AMBIGUITY_MARGIN of the top. A single strong match is never diluted by a
 * distant runner-up, and two near-equal matches always surface as ambiguity.
 */
function pickRivals<T extends { score: number }>(rows: T[], minScore: number): T[] {
  const top = rows[0];
  if (top === undefined || top.score < minScore) return [];
  const threshold = Math.max(minScore, top.score / AMBIGUITY_MARGIN);
  return rows.filter((row) => row.score >= threshold).slice(0, MAX_CANDIDATES);
}

function uniqueOrNull<T>(list: T[]): T | null {
  if (list.length !== 1) return null;
  return list[0] ?? null;
}

function computeConfidence(candidates: ItemCandidate[], locationCandidates: LocationCandidate[]): number {
  const best = Math.max(candidates[0]?.score ?? 0, locationCandidates[0]?.score ?? 0);
  if (best >= 0.9) return 0.95;
  if (best >= 0.6) return 0.8;
  if (best >= 0.35) return 0.55;
  if (best > 0) return 0.3;
  return 0.05;
}

/**
 * Retrieve everything the generation step may cite for one classified
 * message. Returns `records.length === 0` when nothing matched — the
 * pipeline short-circuits to the zero-record reply and skips the LLM call.
 */
export async function retrieveRecords(ownerId: string, entities: Entities): Promise<RetrievalResult> {
  const itemTerms = expandTerms(dedupeTerms([...entities.itemNames, ...entities.itemAliases]));
  const locationTerms = dedupeTerms(entities.locationPhrases);

  const [itemRows, sqlLocations, pathLocations, paths] = await Promise.all([
    bestMatches(ownerId, itemTerms, "items"),
    bestMatches(ownerId, locationTerms, "locations"),
    pathMatches(ownerId, locationTerms),
    pathMapFor(ownerId),
  ]);

  const allLocations = mergeLocations(sqlLocations, pathLocations, paths);
  const locationCandidates = pickRivals(allLocations, MIN_LOCATION_SCORE);
  const resolvedLocation = uniqueOrNull(locationCandidates);

  // list_contents: pull what is currently recorded at the resolved location.
  const contents = resolvedLocation
    ? await itemsLastLocatedAt(ownerId, resolvedLocation.id, MAX_LOCATION_CONTENTS)
    : [];

  const itemIds: string[] = [];
  const addItemId = (id: string): void => {
    if (!itemIds.includes(id)) itemIds.push(id);
  };
  for (const row of itemRows.slice(0, MAX_ITEM_RECORDS)) addItemId(row.id);
  for (const row of contents) addItemId(row.itemId);

  const [itemRecords, lastEvents] = await Promise.all([
    getItemsByIds(ownerId, itemIds),
    lastEventForItems(ownerId, itemIds),
  ]);
  const itemsById = new Map(itemRecords.map((row) => [row.id, row]));

  const candidates = pickRivals(
    itemRows.map((row) => ({
      id: row.id,
      name: row.name,
      score: row.score,
      lastLocationName: lastEvents.get(row.id)?.locationName ?? null,
    })),
    MIN_ITEM_SCORE,
  );
  const resolvedItem = uniqueOrNull(candidates);

  const records: RetrievedRecord[] = [];
  const seen = new Set<string>();
  const push = (kind: string, id: string, record: RetrievedRecord): void => {
    const key = `${kind}:${id}`;
    if (seen.has(key) || records.length >= MAX_RETRIEVED_RECORDS) return;
    seen.add(key);
    records.push(record);
  };

  for (const id of itemIds) {
    const item = itemsById.get(id);
    if (item === undefined) continue;
    const last = lastEvents.get(id);
    push("item", id, {
      kind: "item",
      id,
      name: item.name,
      description: item.description,
      category: item.category,
      lastLocationName: last?.locationName ?? null,
      lastOccurredAt: last ? last.occurredAt.toISOString() : null,
    });
  }
  for (const loc of allLocations.slice(0, MAX_LOCATION_RECORDS)) {
    push("location", loc.id, { kind: "location", id: loc.id, name: loc.name, path: loc.path });
  }
  for (const id of itemIds) {
    const last = lastEvents.get(id);
    if (last === undefined) continue;
    push("event", last.id, {
      kind: "event",
      id: last.id,
      itemName: last.itemName,
      locationName: last.locationName,
      path: paths.get(last.locationId) ?? last.locationName,
      occurredAt: last.occurredAt.toISOString(),
      recordedAt: last.recordedAt.toISOString(),
    });
  }

  return {
    records,
    candidates,
    locationCandidates,
    resolvedItem,
    resolvedLocation,
    confidence: computeConfidence(candidates, locationCandidates),
  };
}
