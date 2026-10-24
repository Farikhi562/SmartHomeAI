import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "@/components/ui/icons";
import { truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/** Page header: breadcrumbs (nested routes only), `h1` title, subtitle, actions. */
export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  return (
    <div className={cx("mb-5", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Jejak navigasi" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-dense text-muted-foreground">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight size={14} className="text-muted-foreground" />}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="hover:text-foreground hover:underline">
                      {truncate(crumb.label, 40)}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? "page" : undefined} className="text-foreground">
                      {truncate(crumb.label, 40)}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 max-w-prose text-base text-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
