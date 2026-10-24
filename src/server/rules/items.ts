/**
 * Item domain rules (FR-002, FR-016, BR-03, BR-07). Pure functions — no I/O.
 */

/** Soft-delete retention window: restorable for 30 days (BR-07). */
export const RESTORE_WINDOW_DAYS = 30;

/** BR-03: duplicate names are allowed but warned (never blocked). */
export function duplicateNameWarning(newName: string, existingNames: string[]): { warn: boolean; matches: string[] } {
  const target = newName.trim().toLowerCase();
  const matches = existingNames.filter((n) => n.trim().toLowerCase() === target);
  return { warn: matches.length > 0, matches };
}

/** Whether a soft-deleted item can still be restored (BR-07). */
export function isRestorable(deletedAt: Date | null, now: Date = new Date()): boolean {
  if (!deletedAt) return false;
  const cutoff = now.getTime() - RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return deletedAt.getTime() >= cutoff;
}

/** Effective status derivation — single source of truth for API projections. */
export function deriveStatus(row: { archivedAt: Date | null; deletedAt: Date | null }): "ACTIVE" | "ARCHIVED" | "DELETED" {
  if (row.deletedAt) return "DELETED";
  if (row.archivedAt) return "ARCHIVED";
  return "ACTIVE";
}
