"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cx } from "@/lib/cx";
import type { IconProps } from "@/components/ui/icons";
import { Box, LayoutDashboard, MapPin, Search as SearchIcon, Sparkles } from "@/components/ui/icons";

/**
 * Bottom tab bar (Android-style) shown below `md`. Labeled tabs only — icons are
 * never alone — for the five primary destinations; Pengaturan lives in the top
 * header. Fixed with safe-area padding, and never printed.
 */
export type BottomNavItem = { label: string; href: string; icon: ComponentType<IconProps> };

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { label: "Barang", href: "/inventory", icon: Box },
  { label: "Lokasi", href: "/locations", icon: MapPin },
  { label: "Cari", href: "/search", icon: SearchIcon },
  { label: "Asisten", href: "/assistant", icon: Sparkles },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi bawah"
      className={cx(
        "app-shell-chrome fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]",
        "md:hidden print:hidden",
      )}
    >
      <ul className="flex items-stretch">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-center text-dense leading-tight",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={20} className="shrink-0" />
                <span className="w-full">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
