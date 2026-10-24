/**
 * Retention & expiry rules (BR-02, BR-07, BR-08). Pure functions — no I/O.
 */

export const PENDING_ACTION_TTL_MS = 24 * 60 * 60 * 1000; // BR-02
export const ACCOUNT_GRACE_DAYS = 7; // BR-08
export const ITEM_RETENTION_DAYS = 30; // BR-07
export const AUDIT_RETENTION_DAYS = 365; // BR-08

export function isPendingActionExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > PENDING_ACTION_TTL_MS;
}

export function accountPurgeDue(softDeletedAt: Date, now: Date = new Date()): boolean {
  const due = softDeletedAt.getTime() + ACCOUNT_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= due;
}

export function itemPurgeDue(deletedAt: Date, now: Date = new Date()): boolean {
  const due = deletedAt.getTime() + ITEM_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= due;
}
