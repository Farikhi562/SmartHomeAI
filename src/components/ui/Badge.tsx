import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/**
 * Status badge (DESIGN_SYSTEM §1.3): colour + icon + text, never colour alone.
 * Icons passed as children are decorative — the label text carries the meaning.
 */
export type BadgeTone = "success" | "warning" | "danger" | "info" | "muted" | "outline" | "primary";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const TONES: Record<BadgeTone, string> = {
  success: "border-transparent bg-success-surface text-success",
  warning: "border-transparent bg-warning-surface text-warning",
  danger: "border-transparent bg-danger-surface text-destructive",
  info: "border-transparent bg-info-surface text-info",
  muted: "border-transparent bg-muted text-muted-foreground",
  outline: "border-border bg-transparent text-foreground",
  primary: "border-transparent bg-accent text-accent-foreground",
};

export function Badge({ tone = "muted", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-4",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
