import { cx } from "@/lib/cx";

/**
 * Loading placeholder (DESIGN_SYSTEM §5): always `aria-hidden` — the loading
 * container around it carries `aria-busy` / a status message instead.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-md bg-muted", className)} />;
}

/** Stacked text-line skeleton (title + 2 lines). */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-2", className)}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full" />
      ))}
    </div>
  );
}

/** Table/list-row skeletons for list loading states. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex flex-col gap-3", className)}>
      {Array.from({ length: Math.max(1, rows) }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
