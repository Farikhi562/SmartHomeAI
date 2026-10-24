/**
 * Tiny class-name joiner (clsx is not a dependency — SCOPE: no new packages).
 * Falsy parts are dropped so `cx("a", cond && "b")` reads naturally.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
