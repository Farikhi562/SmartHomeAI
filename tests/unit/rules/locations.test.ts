import { describe, expect, it } from "vitest";
import {
  MAX_LOCATION_DEPTH,
  canArchiveLocation,
  computeDepth,
  normalizeName,
  wouldCreateCycle,
} from "@/server/rules/locations";

/**
 * BR-04 (depth ≤ 3), BR-05 (referenced locations cannot be archived),
 * FR-017 — pure rule functions, no I/O.
 */

describe("computeDepth (BR-04, hierarchy depth ≤ 3)", () => {
  it("caps the hierarchy at exactly 3 levels", () => {
    expect(MAX_LOCATION_DEPTH).toBe(3);
  });

  it("a null parent makes the location a root at depth 1", () => {
    expect(computeDepth(null)).toEqual({ ok: true, depth: 1 });
  });

  it("a child of a depth-2 location lands at depth 3 and is accepted", () => {
    expect(computeDepth(2)).toEqual({ ok: true, depth: 3 });
  });

  it("a child of a depth-3 location would be depth 4 and is rejected with a reason", () => {
    const result = computeDepth(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result.reason).toContain(String(MAX_LOCATION_DEPTH));
    }
  });

  it("a child of a depth-4 location is rejected too (re-parent guard)", () => {
    expect(computeDepth(4).ok).toBe(false);
  });
});

describe("normalizeName (sibling-uniqueness key)", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeName("  Drawer  ")).toBe("drawer");
  });

  it("lower-cases", () => {
    expect(normalizeName("LIVING ROOM")).toBe("living room");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizeName("Home \t  / \n Bedroom")).toBe("home / bedroom");
  });

  it("makes names that differ only by case/whitespace compare equal", () => {
    expect(normalizeName("  Nightstand")).toBe(normalizeName("NIGHTSTAND "));
  });
});

describe("wouldCreateCycle (re-parent guard)", () => {
  // Ancestor-path stub: pathOf(id) returns [id, ...ancestors].
  const paths: Record<string, string[]> = {
    "loc-child": ["loc-child", "loc-a", "home"],
    "loc-a": ["loc-a", "home"],
    "loc-other": ["loc-other", "home"],
  };
  const pathOf = (id: string): string[] => paths[id] ?? [id];

  it("a location cannot be its own parent", () => {
    expect(wouldCreateCycle("loc-a", "loc-a", pathOf)).toBe(true);
  });

  it("a location cannot be re-parented under its own descendant", () => {
    // moving loc-a below loc-child, which lives inside loc-a's subtree
    expect(wouldCreateCycle("loc-child", "loc-a", pathOf)).toBe(true);
  });

  it("a null parent (move to root) never creates a cycle", () => {
    expect(wouldCreateCycle(null, "loc-a", pathOf)).toBe(false);
  });

  it("an unrelated parent does not create a cycle", () => {
    expect(wouldCreateCycle("loc-other", "loc-a", pathOf)).toBe(false);
  });
});

describe("canArchiveLocation (BR-05, referenced locations cannot be archived)", () => {
  it("an unreferenced location can be archived with no reason needed", () => {
    expect(canArchiveLocation({ items: 0, events: 0 })).toEqual({ ok: true });
  });

  it("items referencing the location block archiving with a reason string", () => {
    const result = canArchiveLocation({ items: 2, events: 0 });
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe("string");
    expect(result.reason).toContain("2");
  });

  it("events referencing the location block archiving with a reason string", () => {
    const result = canArchiveLocation({ items: 0, events: 3 });
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe("string");
    expect(result.reason).toContain("3");
  });

  it("both reference kinds block archiving", () => {
    expect(canArchiveLocation({ items: 1, events: 1 }).ok).toBe(false);
  });
});
