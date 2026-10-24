import { cx } from "@/lib/cx";

/** Decorative spinner. Pass `label` when the spinner alone must be announced. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  const classes = cx(
    "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
    className,
  );
  if (label) {
    return (
      <span role="status" className={classes}>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return <span aria-hidden="true" className={classes} />;
}
