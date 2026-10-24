import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/**
 * limit/offset pagination (API_SPEC §1, ACCESSIBILITY §6.1): `<nav aria-label>`,
 * `aria-current="page"`, real disabled states, stored-data counts only.
 */
export type PaginationProps = {
  limit: number;
  offset: number;
  total: number;
  onChange: (offset: number) => void;
  className?: string;
};

function pageList(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set<number>([1, count, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("gap");
    out.push(page);
    previous = page;
  }
  return out;
}

export function Pagination({ limit, offset, total, onChange, className }: PaginationProps) {
  if (total <= limit) return null;
  const safeLimit = Math.max(1, limit);
  const current = Math.floor(offset / safeLimit) + 1;
  const count = Math.max(1, Math.ceil(total / safeLimit));
  const first = offset + 1;
  const last = Math.min(total, offset + safeLimit);

  return (
    <nav aria-label="Pagination" className={cx("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-dense text-muted-foreground" aria-live="polite">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={offset <= 0}
          aria-disabled={offset <= 0 || undefined}
          onClick={() => onChange(Math.max(0, offset - safeLimit))}
          iconLeft={<ChevronLeft size={14} />}
        >
          Previous
        </Button>
        {pageList(current, count).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-dense text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={entry}
              variant={entry === current ? "secondary" : "ghost"}
              size="sm"
              aria-current={entry === current ? "page" : undefined}
              aria-label={`Page ${entry}`}
              onClick={() => onChange((entry - 1) * safeLimit)}
              className={entry === current ? "font-semibold" : undefined}
            >
              {entry}
            </Button>
          ),
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={offset + safeLimit >= total}
          aria-disabled={offset + safeLimit >= total || undefined}
          onClick={() => onChange(offset + safeLimit)}
          iconRight={<ChevronRight size={14} />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
