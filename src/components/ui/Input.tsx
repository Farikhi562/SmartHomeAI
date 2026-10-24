"use client";

import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Labelled input (ACCESSIBILITY §4.1): visible label, `aria-invalid` on error,
 * hint + error linked through `aria-describedby`, error announced with role=alert.
 */
export type InputProps = ComponentPropsWithRef<"input"> & {
  label?: ReactNode;
  hint?: string;
  error?: string | null;
};

export function Input({
  label,
  hint,
  error,
  className,
  id,
  "aria-describedby": callerDescribedBy,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const hintId = hint ? `${autoId}-hint` : undefined;
  const errorId = `${autoId}-error`;
  const describedBy =
    [hintId, error ? errorId : undefined, callerDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={inputId} className="text-dense font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          "h-9 w-full rounded-md border bg-card px-3 text-base text-foreground",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          error ? "border-destructive" : "border-input",
          className,
        )}
        {...props}
      />
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
