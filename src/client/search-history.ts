/**
 * Riwayat pencarian (FR-032, AC-032-1/2) — client-side ONLY: nothing here ever
 * touches the network. Queries live in `localStorage` under `sh.riwayat-cari`
 * (max 10, newest first, duplicates collapsed case-insensitively).
 *
 * `localStorage` can be absent (SSR), blocked (private mode / policy) or hold
 * corrupt data — every access is guarded and any failure reads as "no history",
 * so the search page keeps working (AC-032-2).
 */

export const SEARCH_HISTORY_KEY = "sh.riwayat-cari";
export const SEARCH_HISTORY_MAX = 10;

/** The slice of the Web Storage API this module uses (injectable for tests). */
export type SearchHistoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * `globalThis.localStorage` itself can throw (SecurityError when storage is
 * disabled), so the property access is inside the try block.
 */
export function safeLocalStorage(): SearchHistoryStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Trim + collapse inner whitespace; empty string means "not a real query". */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

/** Parse + validate the stored JSON; corrupt / wrong-shaped → empty history. */
export function parseHistory(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const history: string[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "string") continue;
    const query = normalizeQuery(entry);
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    history.push(query);
    if (history.length >= SEARCH_HISTORY_MAX) break;
  }
  return history;
}

export function readHistory(storage: SearchHistoryStorage | null = safeLocalStorage()): string[] {
  if (!storage) return [];
  try {
    return parseHistory(storage.getItem(SEARCH_HISTORY_KEY));
  } catch {
    return [];
  }
}

/** Newest first, case-insensitive dedupe, hard cap (oldest dropped). */
export function addQuery(history: string[], rawQuery: string, max = SEARCH_HISTORY_MAX): string[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return history;
  const key = query.toLowerCase();
  const rest = history.filter((entry) => entry.toLowerCase() !== key);
  return [query, ...rest].slice(0, max);
}

/** Best-effort persist; a full/blocked storage bucket never breaks the caller. */
export function writeHistory(
  history: string[],
  storage: SearchHistoryStorage | null = safeLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full or blocked — history simply stops persisting.
  }
}

/** Read → prepend → persist; returns the new list to render immediately. */
export function saveQuery(
  rawQuery: string,
  storage: SearchHistoryStorage | null = safeLocalStorage(),
): string[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return readHistory(storage);
  const next = addQuery(readHistory(storage), query);
  writeHistory(next, storage);
  return next;
}

export function removeFromHistory(history: string[], rawQuery: string): string[] {
  const key = normalizeQuery(rawQuery).toLowerCase();
  return history.filter((entry) => entry.toLowerCase() !== key);
}

export function clearHistory(storage: SearchHistoryStorage | null = safeLocalStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // Blocked storage — nothing to clear.
  }
}
