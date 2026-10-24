"use client";

import Link from "next/link";

/**
 * 500 boundary (DESIGN_SPEC §1.14, FR-013): "Something went wrong on our
 * side." Never leaks stack traces, provider messages, or SQL (API_SPEC §2
 * `INTERNAL`) — the client already redacts those; this surface just shows a
 * plain message plus a `requestId` slot when one is available.
 */

const linkBase =
  "inline-flex h-9 items-center rounded-md px-4 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[480px] text-center">
          <p className="text-6xl font-bold tabular-nums text-muted-foreground" aria-hidden="true">
            500
          </p>
          <h1 className="mt-3 text-2xl font-bold text-foreground">Something went wrong on our side</h1>
          <p className="mt-2 text-base text-muted-foreground">
            That&apos;s on us, not you. Your records are safe — try again, and if it keeps happening
            the support team can use the reference below.
          </p>

          {error.digest && (
            <details className="mt-4 rounded-lg border border-border bg-card p-3 text-left">
              <summary className="cursor-pointer text-dense font-medium text-foreground">
                Technical reference
              </summary>
              <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
            </details>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className={`${linkBase} bg-primary text-primary-foreground hover:bg-primary-hover`}
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className={`${linkBase} border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted`}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
