import { describe, expect, it } from "vitest";
import {
  SEARCH_HISTORY_KEY,
  SEARCH_HISTORY_MAX,
  addQuery,
  clearHistory,
  normalizeQuery,
  parseHistory,
  readHistory,
  removeFromHistory,
  safeLocalStorage,
  saveQuery,
  writeHistory,
  type SearchHistoryStorage,
} from "@/client/search-history";

/**
 * UT-032-1 (FR-032 / AC-032-1, AC-032-2): riwayat pencarian — cap, dedupe,
 * removal, and the storage-fallback rules. A missing or corrupt localStorage
 * value is treated as empty history; no operation may throw when storage is
 * blocked (private mode) or full.
 */

function fakeStorage(initial?: Record<string, string>): SearchHistoryStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Storage that rejects every call — Safari private mode / disabled storage. */
const blockedStorage: SearchHistoryStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("normalizeQuery", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeQuery("  kunci   motor  ")).toBe("kunci motor");
    expect(normalizeQuery("\t\n")).toBe("");
  });
});

describe("parseHistory (AC-032-2: corrupt value → empty history)", () => {
  it("returns [] for missing, invalid JSON or wrong-shaped values", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory(undefined)).toEqual([]);
    expect(parseHistory("")).toEqual([]);
    expect(parseHistory("{not json")).toEqual([]);
    expect(parseHistory('{"q":"kunci"}')).toEqual([]);
    expect(parseHistory("42")).toEqual([]);
    expect(parseHistory('["kunci", 5, null, {"a":1}]')).toEqual(["kunci"]);
  });

  it("keeps the 10 newest entries, newest first, dropping older ones", () => {
    // Stored order is newest-first (the writer prepends), so entries beyond the
    // 10th are the oldest and must be dropped.
    const many = Array.from({ length: 15 }, (_, index) => `query ${14 - index}`);
    const parsed = parseHistory(JSON.stringify(many));
    expect(parsed).toHaveLength(SEARCH_HISTORY_MAX);
    expect(parsed[0]).toBe("query 14");
    expect(parsed[SEARCH_HISTORY_MAX - 1]).toBe("query 5");
    expect(parsed).not.toContain("query 0");
    expect(parsed).not.toContain("query 4");
  });

  it("collapses duplicates case-insensitively, keeping the first (newest) one", () => {
    expect(parseHistory(JSON.stringify(["Kunci Motor", "kunci motor", "KUNCI   MOTOR"]))).toEqual([
      "Kunci Motor",
    ]);
  });
});

describe("addQuery (AC-032-1: newest first, dedupe, cap)", () => {
  it("prepends the newest query", () => {
    expect(addQuery(["satu", "dua"], "tiga")).toEqual(["tiga", "satu", "dua"]);
  });

  it("moves a re-run duplicate to the front, keeping the newly-typed casing", () => {
    expect(addQuery(["satu", "dua", "tiga"], "DUA ")).toEqual(["DUA", "satu", "tiga"]);
  });

  it("enforces the cap of 10 (oldest dropped)", () => {
    let history: string[] = [];
    for (let i = 0; i < 12; i += 1) history = addQuery(history, `query ${i}`);
    expect(history).toHaveLength(SEARCH_HISTORY_MAX);
    expect(history[0]).toBe("query 11");
    expect(history[SEARCH_HISTORY_MAX - 1]).toBe("query 2");
  });

  it("ignores empty or whitespace-only queries", () => {
    expect(addQuery(["satu"], "   ")).toEqual(["satu"]);
  });
});

describe("removeFromHistory / clearHistory", () => {
  it("removes one chip case-insensitively", () => {
    expect(removeFromHistory(["Kunci Motor", "dompet"], "kunci  motor")).toEqual(["dompet"]);
  });

  it("clear-all removes the stored key", () => {
    const storage = fakeStorage({ [SEARCH_HISTORY_KEY]: JSON.stringify(["satu"]) });
    clearHistory(storage);
    expect(storage.data.has(SEARCH_HISTORY_KEY)).toBe(false);
    expect(readHistory(storage)).toEqual([]);
  });
});

describe("storage fallback (AC-032-2)", () => {
  it("read/save round-trip through storage", () => {
    const storage = fakeStorage();
    expect(saveQuery("kunci motor", storage)).toEqual(["kunci motor"]);
    expect(saveQuery("dompet", storage)).toEqual(["dompet", "kunci motor"]);
    expect(readHistory(storage)).toEqual(["dompet", "kunci motor"]);
    expect(JSON.parse(storage.data.get(SEARCH_HISTORY_KEY) ?? "null")).toEqual([
      "dompet",
      "kunci motor",
    ]);
  });

  it("treats a corrupt stored value as empty history, then overwrites it", () => {
    const storage = fakeStorage({ [SEARCH_HISTORY_KEY]: "not-json{{" });
    expect(readHistory(storage)).toEqual([]);
    expect(saveQuery("kunci motor", storage)).toEqual(["kunci motor"]);
    expect(readHistory(storage)).toEqual(["kunci motor"]);
  });

  it("never throws when storage is missing or blocked", () => {
    expect(safeLocalStorage() === null || typeof safeLocalStorage()?.getItem === "function").toBe(true);
    expect(readHistory(null)).toEqual([]);
    expect(() => writeHistory(["satu"], null)).not.toThrow();
    expect(() => clearHistory(null)).not.toThrow();
    // Without storage the value still updates in memory — it just isn't persisted.
    expect(saveQuery("kunci motor", null)).toEqual(["kunci motor"]);

    expect(() => readHistory(blockedStorage)).not.toThrow();
    expect(readHistory(blockedStorage)).toEqual([]);
    expect(() => writeHistory(["satu"], blockedStorage)).not.toThrow();
    expect(() => clearHistory(blockedStorage)).not.toThrow();
    expect(saveQuery("kunci motor", blockedStorage)).toEqual(["kunci motor"]);
  });
});
