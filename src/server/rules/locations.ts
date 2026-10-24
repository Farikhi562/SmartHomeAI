/**
 * Location domain rules (BR-04, BR-05, FR-017). Pure functions — no I/O.
 */

export const MAX_LOCATION_DEPTH = 3; // root = depth 1 (BR-04)

/** Normalize a location/item name for uniqueness comparisons. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Compute the depth a location would have under `parentDepth` (null parent = root).
 * Returns { ok: true, depth } or { ok: false, reason }.
 */
export function computeDepth(parentDepth: number | null): { ok: true; depth: number } | { ok: false; reason: string } {
  const depth = parentDepth === null ? 1 : parentDepth + 1;
  if (depth > MAX_LOCATION_DEPTH) {
    return { ok: false, reason: `Locations can be nested at most ${MAX_LOCATION_DEPTH} levels deep.` };
  }
  return { ok: true, depth };
}

/** Guard against re-parenting a location under itself or its own subtree. */
export function wouldCreateCycle(
  newParentId: string | null,
  movingId: string,
  pathOf: (id: string) => string[],
): boolean {
  if (newParentId === null) return false;
  if (newParentId === movingId) return true;
  return pathOf(newParentId).includes(movingId);
}

/** BR-05: a referenced location cannot be archived. */
export function canArchiveLocation(refs: { items: number; events: number }): { ok: boolean; reason?: string } {
  if (refs.items > 0 || refs.events > 0) {
    return {
      ok: false,
      reason: `This location is still referenced by ${refs.items} item(s) and ${refs.events} recorded event(s). Update those records first, or archive the items.`,
    };
  }
  return { ok: true };
}
