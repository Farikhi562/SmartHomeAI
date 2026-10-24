import { createHash } from "node:crypto";
import { errors } from "@/lib/errors";
import { isDevAuthAllowed } from "@/lib/config/env";
import { mintDevSession } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { upsertUser } from "@/server/repositories/users";

/**
 * Development-only login (FR-001, ADR-005). Mints a local HS256 session for an
 * email without a password; explicitly refused unless `isDevAuthAllowed()`.
 *
 * The id is deterministic so the seed's `dev_demo` user and a dev login for
 * the same email converge on one row instead of stacking duplicates.
 */

/** Stable, non-reversible local id: `dev_` + first 24 hex chars of sha256(email). */
export function devUserId(email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `dev_${digest.slice(0, 24)}`;
}

export type DevLoginResult = { token: string; user: AuthUser };

export async function devLogin(email: string): Promise<DevLoginResult> {
  if (!isDevAuthAllowed()) {
    throw errors.unauthenticated("Dev login is disabled in this environment.");
  }
  const normalized = email.trim().toLowerCase();
  const user: AuthUser = { id: devUserId(normalized), email: normalized };
  await upsertUser(user);
  const token = await mintDevSession(user);
  return { token, user };
}
