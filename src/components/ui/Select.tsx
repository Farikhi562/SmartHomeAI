"use client";

import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { ChevronDown } from "@/components/ui/icons";

/**
 * Native `<select>` with enterprise styling (Radix is not installed — scope).
 * Keyboard behavior comes for free from the native control.
 */
export type SelectProps = ComponentPropsWithRef<"select"> & {
  label?: ReactNode;
  hint?: string;
  error?: string | null;
};

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  "aria-describedby": callerDescribedBy,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? `${autoId}-select`;
  const hintId = hint ? `${autoId}-hint` : undefined;
  const errorId = `${autoId}-error`;
  const describedBy =
    [hintId, error ? errorId : undefined, callerDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={selectId} className="text-dense font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            "h-9 w-full appearance-none rounded-md border bg-card px-3 pr-8 text-base text-foreground",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            error ? "border-destructive" : "border-input",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
