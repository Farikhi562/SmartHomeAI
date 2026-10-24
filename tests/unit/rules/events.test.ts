import { describe, expect, it } from "vitest";
import { FUTURE_SKEW_MS, LAST_RECORDED_CAVEAT, deriveLastLocation, isValidOccurredAt } from "@/server/rules/events";
import type { EventRow } from "@/server/rules/events";

/**
 * FR-003/FR-004 (occurred-at validation, last-recorded-location derivation) and
 * FR-008 (honesty caveat) — pure rule functions, no I/O.
 */

const NOW = new Date("2026-10-15T09:00:00.000Z");
const MIN_MS = 60 * 1000;

describe("isValidOccurredAt (backdating allowed, future rejected beyond skew)", () => {
  it("the future-skew tolerance is 5 minutes", () => {
    expect(FUTURE_SKEW_MS).toBe(5 * MIN_MS);
  });

  it("a past timestamp is valid", () => {
    expect(isValidOccurredAt(new Date(NOW.getTime() - 60 * MIN_MS), NOW)).toBe(true);
  });

  it("now is valid", () => {
    expect(isValidOccurredAt(NOW, NOW)).toBe(true);
  });

  it("now + 4 minutes (inside the 5-minute skew) is valid", () => {
    expect(isValidOccurredAt(new Date(NOW.getTime() + 4 * MIN_MS), NOW)).toBe(true);
  });

  it("now + 6 minutes (beyond the skew) is rejected", () => {
    expect(isValidOccurredAt(new Date(NOW.getTime() + 6 * MIN_MS), NOW)).toBe(false);
  });
});

describe("deriveLastLocation (greatest occurredAt wins; deterministic tie-breaks)", () => {
  const at = (iso: string): Date => new Date(iso);
  const row = (id: string, occurredAt: string, recordedAt: string): EventRow => ({
    id,
    occurredAt: at(occurredAt),
    recordedAt: at(recordedAt),
  });

  it("an empty event list yields null", () => {
    expect(deriveLastLocation([])).toBeNull();
  });

  it("the greatest occurredAt wins regardless of input order", () => {
    const older = row("e-old", "2026-10-13T18:00:00Z", "2026-10-13T18:01:00Z");
    const newer = row("e-new", "2026-10-14T20:30:00Z", "2026-10-14T20:35:00Z");
    expect(deriveLastLocation([older, newer])?.id).toBe("e-new");
    expect(deriveLastLocation([newer, older])?.id).toBe("e-new");
  });

  it("a backdated record does not displace the later occurredAt", () => {
    // e7a3: occurredAt 2026-10-13, but recordedAt 2026-10-14 (backdated record, F1 wallet case)
    const backdated = row("e7a3", "2026-10-13T18:00:00Z", "2026-10-14T09:12:00Z");
    const later = row("e5b1", "2026-10-14T20:30:00Z", "2026-10-14T20:35:00Z");
    expect(deriveLastLocation([later, backdated])?.id).toBe("e5b1");
  });

  it("occurredAt tie → the greater recordedAt wins, in either order", () => {
    const first = row("e1", "2026-10-10T12:00:00Z", "2026-10-10T12:00:30Z");
    const second = row("e2", "2026-10-10T12:00:00Z", "2026-10-10T12:05:00Z");
    expect(deriveLastLocation([first, second])?.id).toBe("e2");
    expect(deriveLastLocation([second, first])?.id).toBe("e2");
  });

  it("double tie (same occurredAt and recordedAt) → the higher id wins", () => {
    const a = row("e1", "2026-10-10T12:00:00Z", "2026-10-10T12:00:00Z");
    const b = row("e2", "2026-10-10T12:00:00Z", "2026-10-10T12:00:00Z");
    expect(deriveLastLocation([a, b])?.id).toBe("e2");
    expect(deriveLastLocation([b, a])?.id).toBe("e2");
  });

  it("is deterministic across shuffled input permutations", () => {
    const rows: EventRow[] = [
      row("e1", "2026-10-10T12:00:00Z", "2026-10-10T12:00:00Z"),
      row("e2", "2026-10-10T12:00:00Z", "2026-10-10T12:00:00Z"),
      row("e3", "2026-10-10T12:00:00Z", "2026-10-10T12:00:00Z"),
      row("e4", "2026-10-10T12:00:00Z", "2026-10-10T12:00:00Z"),
    ];
    const permutations: EventRow[][] = [
      rows,
      [...rows].reverse(),
      [rows[1]!, rows[3]!, rows[0]!, rows[2]!],
      [rows[2]!, rows[0]!, rows[3]!, rows[1]!],
    ];
    for (const perm of permutations) {
      expect(deriveLastLocation(perm)?.id).toBe("e4");
    }
  });
});

describe("LAST_RECORDED_CAVEAT (FR-008 honesty wording)", () => {
  it("contains the exact caveat clause about possible moves", () => {
    expect(LAST_RECORDED_CAVEAT).toContain("may have been moved since then");
  });

  it("is a complete sentence opening with the canonical phrase", () => {
    expect(LAST_RECORDED_CAVEAT.startsWith("This is the last recorded location, so")).toBe(true);
  });
});
