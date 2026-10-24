import { ApiError } from "@/lib/errors";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Inventory CRUD + ownership isolation (FR-002, FR-012, BR-01) — REAL integration
 * test against Postgres, GUARDED so it contributes nothing on machines without a
 * database (no Docker on the current machine — T-020).
 *
 * Enable with:  IT_PG=1 DATABASE_URL=postgresql://… npm test
 *
 * Repository modules (@/server/repositories/*) are imported DYNAMICALLY inside the
 * guarded suite: `describe.runIf` gates execution, and the dynamic imports gate
 * module resolution, so this file loads and reports its skip banner even while the
 * repositories are still being implemented concurrently. Every repository call goes
 * through call(), which throws a pointed adapt-me error if the landed API uses
 * different export names — never a silent pass.
 */
const dbUrl = process.env.DATABASE_URL;
const hasDb = Boolean(dbUrl) && process.env.IT_PG === "1";

type Json = Record<string, unknown>;

/** Invoke a repository export; fail loudly (only when the suite is enabled) on API drift. */
async function call<T>(mod: unknown, exportName: string, ...args: unknown[]): Promise<T> {
  const fn = (mod as Json)[exportName];
  if (typeof fn !== "function") {
    throw new Error(
      `Repository export '${exportName}' is not available — adapt tests/integration/inventory-crud.test.ts to the landed repository API.`,
    );
  }
  return (await (fn as (...a: unknown[]) => unknown)(...args)) as T;
}

/** Result of an ownership-scoped operation: success value or the thrown error. */
type Settled = { ok: true; value: unknown } | { ok: false; error: unknown };

async function settle(fn: () => Promise<unknown>): Promise<Settled> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Denied reads must be indistinguishable from missing rows: falsy result or 404. */
function expectDenied(settled: Settled): void {
  if (settled.ok) {
    expect(settled.value === undefined || settled.value === null).toBe(true);
  } else {
    expect(settled.error).toBeInstanceOf(ApiError);
    expect((settled.error as ApiError).code).toBe("NOT_FOUND");
    expect((settled.error as ApiError).status).toBe(404);
  }
}

if (!hasDb) {
  describe.skip("inventory CRUD integration (enable: IT_PG=1 with a reachable Postgres)", () => {
    it.skip("create → read → update → soft-delete with cross-user isolation (blocked on T-020: no database on this machine)", () => {
      // Inert by design — the suite above only ever executes against a real database.
    });
  });
}

describe.runIf(hasDb)("inventory CRUD + ownership isolation (IT_PG=1)", () => {
  const suffix = Date.now().toString(36);
  let usersRepo: unknown;
  let itemsRepo: unknown;
  let locationsRepo: unknown;
  let ownerAId = "";
  let ownerBId = "";

  beforeAll(async () => {
    usersRepo = await import("@/server/repositories/users");
    itemsRepo = await import("@/server/repositories/items");
    locationsRepo = await import("@/server/repositories/locations");

    ownerAId = await call<string>(usersRepo, "createUser", { email: `qa-owner-a-${suffix}@example.test` });
    ownerBId = await call<string>(usersRepo, "createUser", { email: `qa-owner-b-${suffix}@example.test` });
    expect(ownerAId).toBeTruthy();
    expect(ownerBId).toBeTruthy();
    expect(ownerAId).not.toBe(ownerBId);
  });

  it("creates, reads and updates an item for its owner", async () => {
    const location = await call<{ id: string; name: string }>(
      locationsRepo,
      "createLocation",
      { ownerId: ownerAId, name: `QA Drawer ${suffix}` },
    );
    expect(location.id).toBeTruthy();

    const created = await call<{ id: string; name: string; ownerId: string }>(
      itemsRepo,
      "createItem",
      { ownerId: ownerAId, name: `QA Wallet ${suffix}`, locationId: location.id },
    );
    expect(created.name).toBe(`QA Wallet ${suffix}`);
    expect(created.ownerId).toBe(ownerAId);

    const readBack = await call<{ id: string; name: string; ownerId: string } | null | undefined>(
      itemsRepo,
      "getItem",
      ownerAId,
      created.id,
    );
    expect(readBack).toBeTruthy();
    expect(readBack?.name).toBe(`QA Wallet ${suffix}`);
    expect(readBack?.ownerId).toBe(ownerAId);

    const updated = await call<{ id: string; name: string }>(itemsRepo, "updateItem", ownerAId, created.id, {
      name: `QA Wallet updated ${suffix}`,
    });
    expect(updated.name).toBe(`QA Wallet updated ${suffix}`);
  });

  it("userB cannot read, update or delete userA's item (404 / not-found semantics)", async () => {
    const created = await call<{ id: string; name: string }>(itemsRepo, "createItem", {
      ownerId: ownerAId,
      name: `QA Isolation ${suffix}`,
    });

    expectDenied(await settle(() => call(itemsRepo, "getItem", ownerBId, created.id)));
    expectDenied(
      await settle(() => call(itemsRepo, "updateItem", ownerBId, created.id, { name: "stolen rename" })),
    );
    expectDenied(await settle(() => call(itemsRepo, "deleteItem", ownerBId, created.id)));

    // The item must remain intact and owned by A after the foreign attempts.
    const stillA = await call<{ name: string; ownerId: string } | null | undefined>(
      itemsRepo,
      "getItem",
      ownerAId,
      created.id,
    );
    expect(stillA).toBeTruthy();
    expect(stillA?.name).toBe(`QA Isolation ${suffix}`);
    expect(stillA?.ownerId).toBe(ownerAId);
  });

  it("soft-deleting hides the item from its owner's read path (BR-07)", async () => {
    const created = await call<{ id: string; name: string }>(itemsRepo, "createItem", {
      ownerId: ownerAId,
      name: `QA SoftDelete ${suffix}`,
    });
    await call(itemsRepo, "deleteItem", ownerAId, created.id);

    const afterDelete = await settle(() => call(itemsRepo, "getItem", ownerAId, created.id));
    if (afterDelete.ok) {
      expect(afterDelete.value === undefined || afterDelete.value === null).toBe(true);
    } else {
      expect(afterDelete.error).toBeInstanceOf(ApiError);
      expect((afterDelete.error as ApiError).code).toBe("NOT_FOUND");
    }
  });
});
