"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MeDto } from "@/client/api";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { X } from "@/components/ui/icons";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { cx } from "@/lib/cx";

/**
 * Authenticated app frame (DESIGN_SPEC §0.3 `AppShell`): fixed deep-navy
 * sidebar ≥ 1024 px, drawer + menu button below, sticky top bar, `main` landmark.
 */
export function AppShell({
  user,
  onSignOut,
  children,
}: {
  user: MeDto | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(drawerRef, drawerOpen, { onEscape: () => setDrawerOpen(false) });

  // Reaching desktop width closes the drawer (the persistent sidebar takes over).
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) setDrawerOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="skip-link print:hidden">
        Lewati ke konten utama
      </a>

      <aside className="app-shell-chrome fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-sidebar-border lg:block">
        <Sidebar />
      </aside>

      <div className="lg:pl-60">
        <Topbar user={user} onMenu={() => setDrawerOpen(true)} onSignOut={onSignOut} />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-6 outline-none sm:px-6 md:pb-10 lg:px-8"
        >
          {children}
        </main>
      </div>

      <BottomNav />

      {drawerOpen && (
        <div
          className={cx("fixed inset-0 z-50 lg:hidden")}
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onMouseDown={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-overlay">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup menu navigasi"
              className={cx(
                "absolute right-2 top-3 rounded-md p-3 text-sidebar-foreground hover:bg-sidebar-accent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-navy",
              )}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
