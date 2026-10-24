import Link from "next/link";
import type { ReactNode } from "react";
import { List } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

const linkButtonBase =
  "inline-flex h-9 items-center rounded-md px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** `PublicShell` (DESIGN_SPEC §0.3): brand header + footer around public pages. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="SmartHomeAI home"
            className={cx(
              "flex items-center gap-2 rounded-md text-base font-semibold",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
              <List size={16} />
            </span>
            SmartHomeAI
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link
              href="/login"
              className={cx(
                linkButtonBase,
                "text-foreground hover:bg-muted",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className={cx(
                linkButtonBase,
                "bg-primary text-primary-foreground hover:bg-primary-hover",
              )}
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            SmartHomeAI records where you put things — it reports the last recorded location, never
            live tracking.
          </p>
          <p>Data export and account deletion are available from Settings.</p>
        </div>
      </footer>
    </div>
  );
}
