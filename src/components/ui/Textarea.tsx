"use client";

import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Labelled textarea with the same error/hint association rules as `Input`. */
export type TextareaProps = ComponentPropsWithRef<"textarea"> & {
  label?: ReactNode;
  hint?: string;
  error?: string | null;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  "aria-describedby": callerDescribedBy,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-textarea`;
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
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          "min-h-32 w-full rounded-md border bg-card px-3 py-2.5 text-base text-foreground",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          error ? "border-destructive" : "border-input",
          className,
        )}
        {...props}
      />
      {hint !== undefined && (
        <p id={hintId} className="text-dense text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-dense font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
