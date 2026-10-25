import Link from "next/link";
import type { ReactNode } from "react";
import { List } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

const linkButtonBase =
  "inline-flex min-h-11 items-center rounded-md px-4 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** `PublicShell` (DESIGN_SPEC §0.3): brand header + footer around public pages. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Beranda SmartHomeAI"
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
          <nav aria-label="Navigasi utama" className="flex items-center gap-3">
            <Link
              href="/login"
              className={cx(
                linkButtonBase,
                "text-foreground hover:bg-muted",
              )}
            >
              Masuk
            </Link>
            <Link
              href="/login"
              className={cx(
                linkButtonBase,
                "bg-primary text-primary-foreground hover:bg-primary-hover",
              )}
            >
              Mulai
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-dense text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            SmartHomeAI mencatat di mana Anda menaruh barang — yang ditampilkan adalah lokasi
            terakhir yang dicatat, bukan pelacakan langsung.
          </p>
          <p>Ekspor data dan penghapusan akun tersedia di Pengaturan.</p>
        </div>
      </footer>
    </div>
  );
}
