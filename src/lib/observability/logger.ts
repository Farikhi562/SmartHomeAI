import { createHash } from "node:crypto";
import { getEnv } from "@/lib/config/env";

/**
 * Structured JSON logger with a redaction allowlist (OBSERVABILITY.md, NFR-007).
 * BR-09/BR-10: message content, item names, and location names are NEVER logged —
 * only the fields listed in LogFields, which are operational metadata.
 */

export type LogFields = {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number | string;
  latencyMs?: number;
  outcome?: "ok" | "error" | "fallback" | "denied";
  ownerIdHash?: string;
  intent?: string;
  errorCode?: string;
  event?: string;
  [key: string]: string | number | boolean | undefined;
};

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

/** Deterministic, salted, truncated hash so logs never contain raw user ids. */
export function hashOwner(ownerId: string): string {
  return createHash("sha256").update(`${getEnv().LOG_SALT}:${ownerId}`).digest("hex").slice(0, 12);
}

function emit(level: keyof typeof LEVELS, fields: LogFields): void {
  const envLevel = LEVELS[getEnv().LOG_LEVEL];
  if (LEVELS[level] < envLevel) return;
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (f: LogFields) => emit("debug", f),
  info: (f: LogFields) => emit("info", f),
  warn: (f: LogFields) => emit("warn", f),
  error: (f: LogFields) => emit("error", f),
};
