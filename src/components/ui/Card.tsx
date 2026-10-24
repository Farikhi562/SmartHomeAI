import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Card surface (DESIGN_SYSTEM §5): default / interactive / flush via className. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-lg border border-border bg-card shadow-subtle", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, children, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3 className={cx("text-base font-semibold text-foreground", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("p-4", className)} {...props} />;
}

/** Visually-hidden section label helper (e.g. table captions). */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
