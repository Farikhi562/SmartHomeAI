/**
 * Location-event domain rules (FR-003, FR-004). Pure functions — no I/O.
 */

/** Allowed future skew for occurredAt (clock drift tolerance). */
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function isValidOccurredAt(occurredAt: Date, now: Date = new Date()): boolean {
  return occurredAt.getTime() <= now.getTime() + FUTURE_SKEW_MS;
}

export type EventRow = { id: string; occurredAt: Date; recordedAt: Date };

/**
 * The "last recorded location" of an item = the event with the greatest occurredAt
 * (ties broken by recordedAt, then id for determinism). Never stored redundantly.
 */
export function deriveLastLocation<T extends EventRow>(events: T[]): T | null {
  if (events.length === 0) return null;
  let best = events[0]!;
  for (const e of events.slice(1)) {
    if (e.occurredAt > best.occurredAt) best = e;
    else if (e.occurredAt.getTime() === best.occurredAt.getTime()) {
      if (e.recordedAt > best.recordedAt || (e.recordedAt.getTime() === best.recordedAt.getTime() && e.id > best.id)) {
        best = e;
      }
    }
  }
  return best;
}

/** Canonical honesty caveat required with location answers (FR-008, ANSWER_GENERATION G4). */
export const LAST_RECORDED_CAVEAT = "This is the last recorded location, so it may have been moved since then.";
