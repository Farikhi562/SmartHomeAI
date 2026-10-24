import Link from "next/link";

/**
 * 404 (DESIGN_SPEC §1.14): "We can't find that page or record." It may have
 * been deleted, or it isn't yours (FR-012 — identical treatment, no existence
 * leaks). Actions: Back to Dashboard, Search inventory.
 */

const linkBase =
  "inline-flex h-9 items-center rounded-md px-4 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[480px] text-center">
          <p className="text-6xl font-bold tabular-nums text-muted-foreground" aria-hidden="true">
            404
          </p>
          <h1 className="mt-3 text-2xl font-bold text-foreground">We can&apos;t find that page or record</h1>
          <p className="mt-2 text-base text-muted-foreground">
            It may have been deleted, moved, or it isn&apos;t yours. Nothing is wrong with your
            account — the rest of the app still works.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/dashboard"
              className={`${linkBase} bg-primary text-primary-foreground hover:bg-primary-hover`}
            >
              Back to dashboard
            </Link>
            <Link
              href="/search"
              className={`${linkBase} border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted`}
            >
              Search inventory
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
