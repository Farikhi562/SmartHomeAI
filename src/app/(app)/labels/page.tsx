"use client";

import Link from "next/link";
import { api, type ItemDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Box, ChevronLeft, Printer } from "@/components/ui/icons";
import { truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Label cetak (FR-031, AC-031-1/2): one printable label per item — item name,
 * full location path, category — rendered purely client-side from the existing
 * owner-scoped `GET /api/items` (no new endpoint). Everything outside the label
 * grid is `print:hidden` (the app chrome already carries `.app-shell-chrome`),
 * so printing / print-to-PDF yields labels only. Cards are ~9 cm wide in a
 * 2-column A4 grid and never split across pages (`break-inside-avoid`).
 * Copy is Bahasa Indonesia; tap targets ≥ 44 px.
 */

const PAGE_SIZE = 100; // API max per request (API_SPEC §1)
const LABEL_CAP = 200; // sane cap: a household prints a stack, not a warehouse

/** Page through the owner's active items until done or the print cap. */
async function loadItemsForLabels(): Promise<ItemDto[]> {
  const items: ItemDto[] = [];
  let offset = 0;
  while (items.length < LABEL_CAP) {
    const page = await api.items.list({
      status: "active",
      sort: "name",
      order: "asc",
      limit: PAGE_SIZE,
      offset,
    });
    items.push(...page.items);
    if (page.items.length === 0 || items.length >= page.pagination.total) break;
    offset += page.items.length;
  }
  return items.slice(0, LABEL_CAP);
}

export default function LabelsPage() {
  const state = useAsync(loadItemsForLabels, []);
  const items = state.data ?? [];

  return (
    <>
      {/* Screen-only chrome: hidden on paper (AC-031-2). */}
      <div className="print:hidden">
        <PageHeader
          title="Cetak label"
          subtitle="Satu label berisi nama barang, lokasi terakhir, dan kategori — siap ditempel di kotak atau laci."
        />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-subtle">
          <Link
            href="/inventory"
            className={cx(
              "inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-base font-medium text-foreground hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <ChevronLeft size={18} aria-hidden="true" />
            Kembali ke Barang
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-base text-muted-foreground" aria-live="polite">
              {state.loading ? "Memuat…" : `${items.length} label`}
            </p>
            <Button
              className="min-h-12 text-lg"
              onClick={() => window.print()}
              iconLeft={<Printer size={18} />}
              disabled={state.loading || Boolean(state.error) || items.length === 0}
            >
              Cetak
            </Button>
          </div>
        </div>
      </div>

      {state.loading && (
        <>
          <SkeletonRows rows={6} />
          <span role="status" className="sr-only">
            Memuat label…
          </span>
        </>
      )}

      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}

      {!state.loading && !state.error && items.length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<Box size={32} />}
          title="Belum ada barang untuk dicetak"
          description="Tambahkan barang dulu, lalu kembali ke halaman ini untuk mencetak labelnya."
          action={
            <Link
              href="/inventory/new"
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-lg font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              Tambah barang
            </Link>
          }
        />
      )}

      {!state.loading && !state.error && items.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="break-inside-avoid rounded-lg border border-border bg-card p-4 shadow-subtle print:break-inside-avoid print:border-2 print:border-foreground print:shadow-none print:p-5"
            >
              <p className="text-lg font-bold leading-snug text-foreground print:text-2xl">
                {item.name}
              </p>
              <p className="mt-2 text-base text-foreground print:text-lg">
                {item.lastLocation ? (
                  item.lastLocation.path
                ) : (
                  <span className="text-muted-foreground">Belum pernah dicatat</span>
                )}
              </p>
              {item.category && (
                <p className="mt-1 text-base text-muted-foreground print:text-base">
                  Kategori: {truncate(item.category, 40)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
