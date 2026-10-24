"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import type { MeDto } from "@/client/api";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { LogOut, Menu, Monitor, Moon, Search as SearchIcon, Settings, Sun, User } from "@/components/ui/icons";

/** Route → page title (also written to `document.title` as "Page — SmartHomeAI"). */
function titleFor(pathname: string): string {
  if (pathname.startsWith("/inventory/new")) return "New item";
  if (/^\/inventory\/[^/]+\/edit/.test(pathname)) return "Edit item";
  if (/^\/inventory\/[^/]+/.test(pathname)) return "Item";
  if (pathname.startsWith("/inventory")) return "Inventory";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/locations")) return "Locations";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/assistant")) return "Assistant";
  if (pathname.startsWith("/activity")) return "Activity";
  if (pathname.startsWith("/settings")) return "Settings";
  return "SmartHomeAI";
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "LIGHT", label: "Light", icon: Sun },
  { value: "DARK", label: "Dark", icon: Moon },
  { value: "SYSTEM", label: "System", icon: Monitor },
];

export function Topbar({
  user,
  onMenu,
  onSignOut,
}: {
  user: MeDto | null;
  onMenu: () => void;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Document title follows the route (ACCESSIBILITY §4.3: "Page — SmartHomeAI").
  useEffect(() => {
    document.title = `${titleFor(pathname)} — SmartHomeAI`;
  }, [pathname]);

  // Prefill the top-bar field from /search?q=… without useSearchParams (shell
  // stays Suspense-free; the search page itself owns the URL state).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    setQuery(pathname === "/search" && q ? q : "");
  }, [pathname]);

  // Account menu: outside click + Escape close, focus moves in and returns.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    menuRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  };

  const displayName = user ? (user.displayName || user.email) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation menu"
          className={cx(
            "rounded-md p-2 text-foreground hover:bg-muted lg:hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <Menu size={18} />
        </button>

        <Link
          href="/dashboard"
          className={cx(
            "rounded-md text-base font-semibold tracking-tight text-foreground lg:hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          SmartHomeAI
        </Link>

        <form role="search" onSubmit={submitSearch} className="relative min-w-0 flex-1 sm:max-w-md">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search items and locations"
            placeholder="Search items and locations…"
            className={cx(
              "h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base text-foreground",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          />
        </form>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            ref={triggerRef}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={displayName ? `Account menu for ${displayName}` : "Account menu"}
            className={cx(
              "flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-dense font-semibold text-secondary-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            {displayName ? initials(displayName) : <User size={16} />}
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Account"
              className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-raised"
            >
              <div className="border-b border-border pb-3">
                <p className="truncate text-dense font-medium">{displayName ?? "Signed in"}</p>
                {user && <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{user.email}</p>}
              </div>

              <div className="border-b border-border py-3">
                <p id="theme-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Theme
                </p>
                <div role="radiogroup" aria-labelledby="theme-label" className="flex gap-1">
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTheme(option.value)}
                        className={cx(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Icon size={14} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1 pt-2">
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className={cx(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-dense text-popover-foreground hover:bg-muted",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <Settings size={16} />
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className={cx(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-dense text-destructive hover:bg-danger-surface",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
