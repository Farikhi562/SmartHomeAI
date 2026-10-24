import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Empty state (DESIGN_SPEC §0.4): explains what will appear here plus one
 * primary next action — never a bare "No data".
 */
export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className="text-muted-foreground">
          {icon}
        </span>
      )}
      <Heading className="text-lg font-semibold text-foreground">{title}</Heading>
      {description && (
        <p className="max-w-prose text-base text-foreground">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
