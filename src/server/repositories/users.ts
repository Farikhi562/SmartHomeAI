import { prisma } from "@/lib/db";
import type { User, UserPreference } from "@/generated/prisma/client";
import type { PreferencesUpdate, ProfileUpdate } from "@/lib/validation";

/**
 * User + preference data access (FR-001, FR-021). The `id` is the verified
 * token `sub` (or the deterministic dev-login id) — never client-supplied
 * beyond authentication (BR-01).
 */

/** Idempotent user-row upsert used on first authenticated request (FR-001.4). */
export async function upsertUser({ id, email }: { id: string; email: string }): Promise<User> {
  return prisma.user.upsert({
    where: { id },
    create: { id, email },
    update: { email },
  });
}

export async function updateUserProfile(ownerId: string, data: ProfileUpdate): Promise<User | null> {
  const updated = await prisma.user.updateMany({ where: { id: ownerId }, data });
  if (updated.count === 0) return null;
  return prisma.user.findUnique({ where: { id: ownerId } });
}

/** Soft delete for the account-deletion flow (FR-014, BR-08) — blocks sign-in. */
export async function softDeleteUser(ownerId: string): Promise<User | null> {
  const updated = await prisma.user.updateMany({
    where: { id: ownerId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (updated.count === 0) return null;
  return prisma.user.findUnique({ where: { id: ownerId } });
}

/** Preferences with defaults created on demand (FR-021). */
export async function getPreferences(ownerId: string): Promise<UserPreference> {
  const existing = await prisma.userPreference.findUnique({ where: { userId: ownerId } });
  if (existing) return existing;
  return prisma.userPreference.create({ data: { userId: ownerId } });
}

export async function upsertPreferences(ownerId: string, data: PreferencesUpdate): Promise<UserPreference> {
  const existing = await prisma.userPreference.findUnique({ where: { userId: ownerId } });
  if (existing) {
    return prisma.userPreference.update({ where: { userId: ownerId }, data });
  }
  return prisma.userPreference.create({ data: { userId: ownerId, ...data } });
}
