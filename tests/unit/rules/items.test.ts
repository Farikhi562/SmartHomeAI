import { describe, expect, it } from "vitest";
import { RESTORE_WINDOW_DAYS, deriveStatus, duplicateNameWarning, isRestorable } from "@/server/rules/items";

/**
 * BR-03 (duplicate names warn, never block), BR-07 (30-day restore window),
 * status projection — pure rule functions, no I/O.
 */

describe("duplicateNameWarning (BR-03)", () => {
  it("warns on an exact case-insensitive match and reports it", () => {
    const result = duplicateNameWarning("Charger", ["charger", "Wallet", "Notebook"]);
    expect(result.warn).toBe(true);
    expect(result.matches).toEqual(["charger"]);
  });

  it("matches despite leading/trailing whitespace on either side", () => {
    const result = duplicateNameWarning("  CHARGER ", [" charger  "]);
    expect(result.warn).toBe(true);
    expect(result.matches).toEqual([" charger  "]);
  });

  it("does not warn when no existing name matches", () => {
    const result = duplicateNameWarning("Wallet", ["charger", "notebook", "charger cable"]);
    expect(result.warn).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("does not treat prefix-different names as duplicates", () => {
    const result = duplicateNameWarning("Charger", ["Charger 2", "Charging cable"]);
    expect(result.warn).toBe(false);
    expect(result.matches).toEqual([]);
  });
});

describe("isRestorable (BR-07, 30-day restore window)", () => {
  const now = new Date("2026-10-15T09:00:00.000Z");
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("the restore window is 30 days", () => {
    expect(RESTORE_WINDOW_DAYS).toBe(30);
  });

  it("an item that was never deleted is not restorable", () => {
    expect(isRestorable(null, now)).toBe(false);
  });

  it("deleted 10 days ago → still restorable", () => {
    expect(isRestorable(new Date(now.getTime() - 10 * DAY_MS), now)).toBe(true);
  });

  it("deleted 31 days ago → no longer restorable", () => {
    expect(isRestorable(new Date(now.getTime() - 31 * DAY_MS), now)).toBe(false);
  });

  it("boundary: exactly 30 days ago → still restorable", () => {
    expect(isRestorable(new Date(now.getTime() - 30 * DAY_MS), now)).toBe(true);
  });

  it("boundary: 30 days + 1 second ago → no longer restorable", () => {
    expect(isRestorable(new Date(now.getTime() - 30 * DAY_MS - 1000), now)).toBe(false);
  });
});

describe("deriveStatus (effective status projection)", () => {
  it("neither timestamp → ACTIVE", () => {
    expect(deriveStatus({ archivedAt: null, deletedAt: null })).toBe("ACTIVE");
  });

  it("archivedAt set → ARCHIVED", () => {
    expect(deriveStatus({ archivedAt: new Date("2026-10-01T00:00:00Z"), deletedAt: null })).toBe("ARCHIVED");
  });

  it("deletedAt set → DELETED", () => {
    expect(deriveStatus({ archivedAt: null, deletedAt: new Date("2026-10-01T00:00:00Z") })).toBe("DELETED");
  });

  it("deletedAt takes precedence when both timestamps are set", () => {
    expect(
      deriveStatus({ archivedAt: new Date("2026-09-01T00:00:00Z"), deletedAt: new Date("2026-10-01T00:00:00Z") }),
    ).toBe("DELETED");
  });
});
