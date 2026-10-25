/**
 * Small formatting helpers shared across pages (DESIGN_SPEC §0.4: relative
 * labels with absolute values available for `title`/`<time datetime>`).
 * Pure functions only — no data fetching, no fabricated values.
 */

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("id", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("id", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "baru saja" · "5 menit yang lalu" · "2 hari yang lalu" · "3 jam lagi" (locale id). */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return "—";
  const deltaSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 45) return "baru saja";
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds) {
      return rtf.format(Math.round(deltaSec / seconds), unit);
    }
  }
  return "baru saja";
}

/** Absolute date, e.g. "14 Okt 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFmt.format(date) : "—";
}

/** Absolute date + time, e.g. "14 Okt 2026, 20.30". */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFmt.format(date) : "—";
}

/** RFC 3339 value for `<time datetime>` / tooltips; empty string when invalid. */
export function toDateTimeAttr(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? date.toISOString() : "";
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** "Sam Rivera" → "SR"; single word → first two letters upper-cased. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? "") : "";
  const result = `${first}${second}`.toUpperCase();
  return result || "?";
}
