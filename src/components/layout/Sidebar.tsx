"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cx } from "@/lib/cx";
import type { IconProps } from "@/components/ui/icons";
import {
  Box,
  History,
  LayoutDashboard,
  List,
  MapPin,
  Printer,
  Search as SearchIcon,
  Settings,
  Sparkles,
} from "@/components/ui/icons";

/**
 * Deep-navy primary navigation (INFORMATION_ARCHITECTURE §2.1):
 * single `nav[aria-label="Navigasi utama"]`, active item = accent bg + left
 * indicator bar + `aria-current="page"` (never colour alone).
 */
export type NavItem = { label: string; href: string; icon: ComponentType<IconProps> };

export const NAV_ITEMS: NavItem[] = [
  { label: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { label: "Barang", href: "/inventory", icon: Box },
  // Label cetak (FR-031): sidebar + inventory toolbar entry only — the mobile
  // bottom bar keeps its five tabs (no room for a sixth).
  { label: "Cetak label", href: "/labels", icon: Printer },
  { label: "Lokasi", href: "/locations", icon: MapPin },
  { label: "Cari", href: "/search", icon: SearchIcon },
  { label: "Asisten", href: "/assistant", icon: Sparkles },
  // Listed in the primary nav per the app brief; IA marks Activity as P1 ("hidden until enabled").
  { label: "Riwayat", href: "/activity", icon: History },
  { label: "Pengaturan", href: "/settings", icon: Settings },
];

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  onNavigate,
  className,
}: {
  /** Called after a link click (the mobile drawer closes itself). */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div className={cx("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <List size={16} />
        </span>
        <span className="text-base font-semibold tracking-tight">SmartHomeAI</span>
      </div>

      <nav aria-label="Navigasi utama" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {/* gap-3 = 12.5 px: neighbouring nav targets stay ≥12 px apart. */}
        <ul className="flex flex-col gap-3">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cx(
                    "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-base font-medium",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-navy",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/70",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-sidebar-indicator"
                    />
                  )}
                  <Icon size={18} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-4 py-3 text-dense text-sidebar-foreground/80">
        v0.1.0 · Catatan barang pribadi
      </div>
    </div>
  );
}
