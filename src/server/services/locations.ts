import { errors } from "@/lib/errors";
import type { LocationDto, LocationCreate, LocationUpdate } from "@/lib/validation";
import type { Location } from "@/generated/prisma/client";
import {
  ancestorChain,
  archiveLocation,
  countChildren,
  countReferences,
  createLocation,
  deleteLocation,
  listLocations,
  siblings,
  updateLocation,
  getLocation,
} from "@/server/repositories/locations";
import { canArchiveLocation, computeDepth, normalizeName, wouldCreateCycle } from "@/server/rules/locations";

/**
 * Location service (FR-017, BR-04/BR-05). Enforces depth, cycle guards and
 * case-insensitive sibling uniqueness; computes `path`/`depth` server-side —
 * never trusted from the client (API_SPEC §4).
 */

export type LocationTree = { path: Map<string, string>; depth: Map<string, number> };

/**
 * Build path ("Home / Bedroom / Drawer") and depth (root = 1) for every
 * location. Memoized recursion with a visited guard so a corrupted cycle can
 * never hang a request.
 */
export function buildTree(locations: Location[]): LocationTree {
  const byId = new Map<string, Location>();
  for (const loc of locations) byId.set(loc.id, loc);
  const path = new Map<string, string>();
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const resolve = (id: string): void => {
    if (path.has(id) || visiting.has(id)) return;
    const loc = byId.get(id);
    if (!loc) return;
    visiting.add(id);
    if (loc.parentId !== null) resolve(loc.parentId);
    visiting.delete(id);
    const parentPath = loc.parentId !== null ? path.get(loc.parentId) : undefined;
    const parentDepth = loc.parentId !== null ? depth.get(loc.parentId) : undefined;
    path.set(id, parentPath === undefined ? loc.name : `${parentPath} / ${loc.name}`);
    depth.set(id, parentDepth === undefined ? 1 : parentDepth + 1);
  };

  for (const loc of locations) resolve(loc.id);
  return { path, depth };
}

/** All owner locations (archived included) → path map, for DTO enrichment. */
export async function pathMapFor(ownerId: string): Promise<Map<string, string>> {
  const locations = await listLocations(ownerId, true);
  return buildTree(locations).path;
}

/** FR-003 error conditions: unknown → 404; archived → 409 with a hint. */
export async function requireUsableLocation(ownerId: string, id: string): Promise<Location> {
  const location = await getLocation(ownerId, id);
  if (!location) throw errors.notFound("Location");
  if (location.archivedAt !== null) {
    throw errors.conflict("That location is archived. Unarchive it or pick another location.");
  }
  return location;
}

export function toLocationDto(loc: Location, tree: LocationTree): LocationDto {
  return {
    id: loc.id,
    name: loc.name,
    description: loc.description,
    parentId: loc.parentId,
    depth: tree.depth.get(loc.id) ?? 1,
    path: tree.path.get(loc.id) ?? loc.name,
    archivedAt: loc.archivedAt ? loc.archivedAt.toISOString() : null,
    createdAt: loc.createdAt.toISOString(),
    updatedAt: loc.updatedAt.toISOString(),
  };
}

/** Flat list with server-computed depth + path; archived rows optional. */
export async function list(ownerId: string, includeArchived: boolean): Promise<LocationDto[]> {
  const all = await listLocations(ownerId, true); // fetch all so paths survive archived parents
  const tree = buildTree(all);
  return all
    .filter((loc) => includeArchived || loc.archivedAt === null)
    .map((loc) => toLocationDto(loc, tree));
}

export async function create(ownerId: string, input: LocationCreate): Promise<LocationDto> {
  const parentId = input.parentId ?? null;
  let parentDepth: number | null = null;
  if (parentId !== null) {
    const parent = await getLocation(ownerId, parentId);
    if (!parent) throw errors.notFound("Parent location");
    // Depth of the parent comes from the DB chain, not from the request.
    parentDepth = (await ancestorChain(ownerId, parentId)).length + 1;
  }
  const depth = computeDepth(parentDepth);
  if (!depth.ok) throw errors.validation([{ path: "parentId", issue: depth.reason }], depth.reason);

  const existing = await siblings(ownerId, parentId);
  const wanted = normalizeName(input.name);
  if (existing.some((s) => normalizeName(s.name) === wanted)) {
    throw errors.conflict(`A location named "${input.name}" already exists at this level.`);
  }

  const created = await createLocation(ownerId, {
    name: input.name,
    description: input.description,
    parentId,
  });
  const tree = buildTree(await listLocations(ownerId, true));
  return toLocationDto(created, tree);
}

export async function update(ownerId: string, id: string, input: LocationUpdate): Promise<LocationDto> {
  const current = await getLocation(ownerId, id);
  if (!current) throw errors.notFound("Location");

  const parentProvided = input.parentId !== undefined;
  // Coerce to `string | null` here so every downstream use (chain, cycle
  // check, sibling uniqueness) is narrowable — `?? undefined` is impossible
  // after `parentProvided` (= parentId !== undefined).
  const nextParentId: string | null = parentProvided ? (input.parentId ?? null) : current.parentId;

  if (parentProvided) {
    if (nextParentId === id) {
      throw errors.validation([{ path: "parentId", issue: "A location cannot be its own parent." }]);
    }
    if (nextParentId !== null) {
      const parent = await getLocation(ownerId, nextParentId);
      if (!parent) throw errors.notFound("Parent location");
      const parentPath = [...(await ancestorChain(ownerId, nextParentId)), nextParentId];
      if (wouldCreateCycle(nextParentId, id, () => parentPath)) {
        throw errors.validation([
          { path: "parentId", issue: "A location cannot be moved under itself or one of its own children." },
        ]);
      }
      const depth = computeDepth(parentPath.length);
      if (!depth.ok) throw errors.validation([{ path: "parentId", issue: depth.reason }], depth.reason);
    }
  }

  const parentChanged = parentProvided && nextParentId !== current.parentId;
  const nameChanged = input.name !== undefined;
  if (nameChanged || parentChanged) {
    const nextName: string = nameChanged && input.name !== undefined ? input.name : current.name;
    const wanted = normalizeName(nextName);
    // `id` stays visible to the check even when archived (rename of self is legal).
    const near = await siblings(ownerId, nextParentId, id);
    if (near.some((s) => s.id !== id && normalizeName(s.name) === wanted)) {
      throw errors.conflict(`A location named "${nextName}" already exists at this level.`);
    }
  }

  // `description` may be `null` (clear) — PATCH semantics, see locationUpdateSchema.
  const data: { name?: string; description?: string | null; parentId?: string | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (parentProvided) data.parentId = nextParentId;

  const updated = await updateLocation(ownerId, id, data);
  if (!updated) throw errors.notFound("Location");
  const tree = buildTree(await listLocations(ownerId, true));
  return toLocationDto(updated, tree);
}

/** BR-05: referenced locations cannot be archived — 409 carries the counts. */
export async function archive(ownerId: string, id: string): Promise<LocationDto> {
  const current = await getLocation(ownerId, id);
  if (!current) throw errors.notFound("Location");
  if (current.archivedAt === null) {
    const counts = await countReferences(id);
    const check = canArchiveLocation(counts);
    if (!check.ok) {
      throw errors.conflict(check.reason ?? "This location is still referenced.", {
        referencedByItems: counts.items,
        referencedByEvents: counts.events,
      });
    }
    await archiveLocation(ownerId, id);
  }
  const fresh = await getLocation(ownerId, id);
  if (!fresh) throw errors.notFound("Location");
  return toLocationDto(fresh, buildTree(await listLocations(ownerId, true)));
}

/** Only childless + unreferenced locations may be hard-deleted (FR-017). */
export async function remove(ownerId: string, id: string): Promise<{ id: string; deleted: true }> {
  const current = await getLocation(ownerId, id);
  if (!current) throw errors.notFound("Location");

  const children = await countChildren(ownerId, id);
  if (children > 0) {
    throw errors.conflict("This location still has child locations. Move or delete them first.", {
      referencedByChildren: children,
    });
  }
  const counts = await countReferences(id);
  if (counts.items > 0 || counts.events > 0) {
    throw errors.conflict(
      `This location is still referenced by ${counts.items} item(s) and ${counts.events} recorded event(s). Update those records first.`,
      { referencedByItems: counts.items, referencedByEvents: counts.events },
    );
  }
  const ok = await deleteLocation(ownerId, id);
  if (!ok) throw errors.notFound("Location");
  return { id, deleted: true };
}
