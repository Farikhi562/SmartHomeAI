import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * BR-06 append-only invariant (AC-004-1/2, UT-004-1): ItemLocationEvent rows are
 * never updated or deleted by application code — corrections append new events.
 * The only sanctioned exception (retention/purge jobs, BR-07/BR-08) must carry an
 * explicit `// APPEND-ONLY-EXEMPT` marker on the mutating line or the line above.
 *
 * Static source scan — no database, no runtime import of repositories (their APIs
 * are in flux while implementation lands).
 */

const SERVER_ROOT = fileURLToPath(new URL("../../../src/server", import.meta.url));

/** Delegate-style mutations of the Prisma ItemLocationEvent model. */
const MUTATION_PATTERN = "\\bitemLocationEvent\\s*\\.\\s*(update|updateMany|delete|deleteMany|upsert)\\b";
const EXEMPT_MARKER = "APPEND-ONLY-EXEMPT";

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Returns one "<label>:<line>: <trimmed source>" entry per non-exempt mutation.
 * Scans the whole file content so multi-line calls (`itemLocationEvent\n .update(`)
 * are caught too, while still reporting the line number of the mutation start.
 */
function findAppendOnlyViolations(source: string, label: string): string[] {
  const violations: string[] = [];
  // Normalize \r to a space so offsets hold while \n stays countable for line numbers.
  const flat = source.replace(/\r/g, " ");
  const re = new RegExp(MUTATION_PATTERN, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(flat)) !== null) {
    const startLine = flat.slice(0, match.index).split("\n").length;
    const lines = source.split("\n");
    const sameLine = lines[startLine - 1] ?? "";
    const lineAbove = lines[startLine - 2] ?? "";
    if (sameLine.includes(EXEMPT_MARKER) || lineAbove.includes(EXEMPT_MARKER)) continue;
    const snippet = match[0].replace(/\s+/g, " ").trim();
    violations.push(`${label}:${startLine}: ${snippet}`);
  }
  return violations;
}

describe("BR-06 append-only invariant (static source scan of src/server)", () => {
  const files = listSourceFiles(SERVER_ROOT);

  it("finds the src/server source tree", () => {
    expect(files.length).toBeGreaterThan(0);
    // Sanity: the scan actually covers the rules module it is supposed to watch.
    expect(files.some((f) => f.replace(/\\/g, "/").endsWith("src/server/rules/events.ts"))).toBe(true);
  });

  it("no file mutates itemLocationEvent without an APPEND-ONLY-EXEMPT marker", () => {
    const violations: string[] = [];
    for (const file of files) {
      violations.push(...findAppendOnlyViolations(readFileSync(file, "utf8"), file));
    }
    expect(violations).toEqual([]);
  });

  it("the detector flags a raw mutation in synthetic source", () => {
    const bad = `
      export function corrupt(db: Db) {
        return db.itemLocationEvent.update({ where: { id: "x" }, data: {} });
      }
    `;
    expect(findAppendOnlyViolations(bad, "synthetic")).toHaveLength(1);
    expect(findAppendOnlyViolations(bad, "synthetic")[0]).toContain("synthetic:3");
  });

  it("the detector flags multi-line mutations too", () => {
    const bad = `
      export function corrupt(db: Db) {
        return db.itemLocationEvent
          .delete({ where: { id: "x" } });
      }
    `;
    const found = findAppendOnlyViolations(bad, "synthetic");
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(".delete");
  });

  it("allows a marker-sanctioned purge/retention exception", () => {
    const exemptSameLine = `
      export function purge(db: Db) {
        // APPEND-ONLY-EXEMPT: BR-07 retention job hard-deletes purged item events
        return db.itemLocationEvent.deleteMany({ where: { itemId } });
      }
    `;
    expect(findAppendOnlyViolations(exemptSameLine, "synthetic")).toEqual([]);

    const exemptLineAbove = `
      export function purgeAccount(db: Db) {
        // APPEND-ONLY-EXEMPT: BR-08 account purge
        return db.itemLocationEvent.updateMany({ where: { ownerId }, data: { note: null } });
      }
    `;
    expect(findAppendOnlyViolations(exemptLineAbove, "synthetic")).toEqual([]);
  });

  it("read/append calls are not mutations and never flag", () => {
    const ok = `
      export function last(db: Db) {
        const a = db.itemLocationEvent.findMany({ where: { itemId } });
        const b = db.itemLocationEvent.create({ data: { ... } });
        const c = db.itemLocationEvent.aggregate({ _max: { occurredAt: true } });
        return [a, b, c];
      }
    `;
    expect(findAppendOnlyViolations(ok, "synthetic")).toEqual([]);
  });
});
