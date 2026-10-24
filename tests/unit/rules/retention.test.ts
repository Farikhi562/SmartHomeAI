import { describe, expect, it } from "vitest";
import {
  ACCOUNT_GRACE_DAYS,
  AUDIT_RETENTION_DAYS,
  ITEM_RETENTION_DAYS,
  PENDING_ACTION_TTL_MS,
  accountPurgeDue,
  isPendingActionExpired,
  itemPurgeDue,
} from "@/server/rules/retention";

/**
 * BR-02 (pending actions expire after 24 h), BR-07 (30-day item retention),
 * BR-08 (7-day account grace, 12-month audit retention) — pure rules, no I/O.
 */

const NOW = new Date("2026-10-15T09:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("isPendingActionExpired (BR-02, 24 h TTL)", () => {
  it("the TTL constant is exactly 24 hours", () => {
    expect(PENDING_ACTION_TTL_MS).toBe(24 * HOUR_MS);
  });

  it("created 1 hour ago → not expired", () => {
    expect(isPendingActionExpired(new Date(NOW.getTime() - HOUR_MS), NOW)).toBe(false);
  });

  it("boundary: created exactly 24 h ago → not expired (expiry is strictly past the TTL)", () => {
    expect(isPendingActionExpired(new Date(NOW.getTime() - 24 * HOUR_MS), NOW)).toBe(false);
  });

  it("boundary: created 24 h + 1 ms ago → expired", () => {
    expect(isPendingActionExpired(new Date(NOW.getTime() - 24 * HOUR_MS - 1), NOW)).toBe(true);
  });
});

describe("accountPurgeDue (BR-08, 7-day grace after account soft-delete)", () => {
  it("the grace period is 7 days", () => {
    expect(ACCOUNT_GRACE_DAYS).toBe(7);
  });

  it("soft-deleted 6 days ago → purge not due", () => {
    expect(accountPurgeDue(new Date(NOW.getTime() - 6 * DAY_MS), NOW)).toBe(false);
  });

  it("boundary: soft-deleted exactly 7 days ago → purge due", () => {
    expect(accountPurgeDue(new Date(NOW.getTime() - 7 * DAY_MS), NOW)).toBe(true);
  });

  it("boundary: 1 ms before the 7-day mark → not due", () => {
    expect(accountPurgeDue(new Date(NOW.getTime() - 7 * DAY_MS + 1), NOW)).toBe(false);
  });
});

describe("itemPurgeDue (BR-07, 30-day soft-delete retention)", () => {
  it("the item retention window is 30 days", () => {
    expect(ITEM_RETENTION_DAYS).toBe(30);
  });

  it("deleted 10 days ago → purge not due", () => {
    expect(itemPurgeDue(new Date(NOW.getTime() - 10 * DAY_MS), NOW)).toBe(false);
  });

  it("boundary: deleted exactly 30 days ago → purge due", () => {
    expect(itemPurgeDue(new Date(NOW.getTime() - 30 * DAY_MS), NOW)).toBe(true);
  });

  it("boundary: 1 ms before the 30-day mark → not due", () => {
    expect(itemPurgeDue(new Date(NOW.getTime() - 30 * DAY_MS + 1), NOW)).toBe(false);
  });
});

describe("audit retention constant (BR-08)", () => {
  it("audit events are retained for 12 months = 365 days", () => {
    expect(AUDIT_RETENTION_DAYS).toBe(365);
  });
});
