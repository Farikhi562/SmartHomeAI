"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, type ReactNode } from "react";
import { api } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Box, History, Lightbulb, MapPin, Plus, Search, Sparkles } from "@/components/ui/icons";
import { toDateTimeAttr, truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Dashboard (DESIGN_SPEC §1.4, FR-015): orientation + quick actions. Every
 * number is a stored-data count; cards load independently so one failure never
 * blanks the page (§2.4). Composes the three documented collections rather than
 * GET /api/dashboard (which was added later, 2026-10-21, as an optional single
 * source — API_SPEC §3.5) so a partial outage degrades per card, not per page.
 */

const RECENT_WINDOW_DAYS = 7;
const LIST_CAP = 5;

/* Indonesian labels — `src/lib/format.ts` stays locale-neutral (English). */
const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];
const relativeTime = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
const absoluteDateTime = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "baru saja" → "5 menit yang lalu" → "2 hari yang lalu". */
function relTime(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const deltaSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 45) return "baru saja";
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds) return relativeTime.format(Math.round(deltaSec / seconds), unit);
  }
  return "baru saja";
}

function StatCard({
  label,
  value,
  loading,
  icon,
  href,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  icon: ReactNode;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {loading || value === null ? "—" : value}
        </p>
        <p className="truncate text-dense font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          "block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border border-border bg-card p-4">{body}</div>;
}

function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className="mb-5 flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      <div className="relative min-w-0 flex-1">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Cari cepat barang dan lokasi"
          placeholder="Barang saya taruh di…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
        />
      </div>
      <Button type="submit" variant="secondary" disabled={query.trim().length < 2}>
        Cari
      </Button>
    </form>
  );
}

function RecentItemsCard() {
  const state = useAsync(
    () => api.items.list({ sort: "updatedAt", order: "desc", status: "active", limit: LIST_CAP }),
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barang terbaru</CardTitle>
        <Link
          href="/inventory?sort=updatedAt"
          className={cx(
            "flex min-h-11 items-center text-dense font-medium text-primary underline-offset-4 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          Lihat semua
        </Link>
      </CardHeader>
      <CardContent>
        {state.loading && <SkeletonRows rows={5} />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={state.reload} />}
        {!state.loading && !state.error && state.data && state.data.items.length === 0 && (
          <p className="text-base text-foreground">Belum ada apa pun di sini — tambahkan barang pertama Anda.</p>
        )}
        {!state.loading && !state.error && state.data && state.data.items.length > 0 && (
          <ul className="divide-y divide-border">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/inventory/${item.id}`}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium text-foreground">
                      {truncate(item.name, 48)}
                    </span>
                    <span className="block truncate text-dense text-muted-foreground">
                      {item.lastLocation ? truncate(item.lastLocation.path, 48) : "Belum pernah dicatat"}
                    </span>
                  </span>
                  <time
                    dateTime={toDateTimeAttr(item.updatedAt)}
                    title={absoluteDateTime.format(new Date(item.updatedAt))}
                    className="shrink-0 text-dense text-muted-foreground"
                  >
                    {relTime(item.updatedAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentLocationsCard() {
  const state = useAsync(
    () => api.activity({ sinceDays: RECENT_WINDOW_DAYS, limit: LIST_CAP }),
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat terbaru</CardTitle>
        <Link
          href="/activity"
          className={cx(
            "flex min-h-11 items-center text-dense font-medium text-primary underline-offset-4 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          Lihat semua
        </Link>
      </CardHeader>
      <CardContent>
        {state.loading && <SkeletonRows rows={5} />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={state.reload} />}
        {!state.loading && !state.error && state.data && state.data.events.length === 0 && (
          <p className="text-base text-foreground">
            Belum ada lokasi yang dicatat dalam {RECENT_WINDOW_DAYS} hari terakhir.
          </p>
        )}
        {!state.loading && !state.error && state.data && state.data.events.length > 0 && (
          <ul className="divide-y divide-border">
            {state.data.events.map((event) => (
              <li key={event.id}>
                <Link
                  href={event.item ? `/inventory/${event.item.id}` : "/activity"}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium text-foreground">
                      {truncate(event.item?.name ?? "Sebuah barang", 40)}
                    </span>
                    <span className="block truncate text-dense text-muted-foreground">
                      → {truncate(event.location.path, 44)}
                    </span>
                  </span>
                  <time
                    dateTime={toDateTimeAttr(event.occurredAt)}
                    title={absoluteDateTime.format(new Date(event.occurredAt))}
                    className="shrink-0 text-dense text-muted-foreground"
                  >
                    {relTime(event.occurredAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const itemsState = useAsync(() => api.items.list({ status: "active", limit: 1 }), []);
  const activityState = useAsync(() => api.activity({ sinceDays: RECENT_WINDOW_DAYS, limit: LIST_CAP }), []);
  const locationsState = useAsync(() => api.locations.list(), []);

  const totalItems = itemsState.data?.pagination.total ?? null;
  const totalLocations = locationsState.data?.pagination?.total ?? null;
  const itemCount = itemsState.data?.pagination.total ?? 0;
  const locationCount = locationsState.data?.pagination?.total ?? 0;
  const bothEmpty =
    !itemsState.loading &&
    !locationsState.loading &&
    !itemsState.error &&
    !locationsState.error &&
    itemCount === 0 &&
    locationCount === 0;

  return (
    <>
      <PageHeader title="Beranda" subtitle="Barang Anda dan di mana terakhir kali Anda meletakkannya." />
      <QuickSearch />

      {bothEmpty ? (
        <EmptyState
          headingLevel={2}
          icon={<Sparkles size={32} />}
          title="Ayo catat barang pertama Anda"
          description="Tambahkan satu lokasi, masukkan barang Anda, lalu tanyakan ke asisten di mana Anda meletakkan sesuatu."
          action={
            <Link
              href="/locations"
              className={cx(
                "inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <MapPin size={18} />
              Tambah lokasi
            </Link>
          }
          secondaryAction={
            <Link
              href="/inventory/new"
              className={cx(
                "inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-secondary px-5 text-base font-medium text-secondary-foreground hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Plus size={18} />
              Tambah barang
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Barang aktif"
              value={totalItems}
              loading={itemsState.loading}
              icon={<Box size={20} />}
              href="/inventory?status=active"
            />
            <StatCard
              label="Lokasi"
              value={totalLocations}
              loading={locationsState.loading}
              icon={<MapPin size={20} />}
              href="/locations"
            />
            <StatCard
              label={`Dicatat (${RECENT_WINDOW_DAYS} hari terakhir)`}
              value={activityState.data?.pagination.total ?? null}
              loading={activityState.loading}
              icon={<History size={20} />}
              href="/activity"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <RecentItemsCard />
            <RecentLocationsCard />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="flex h-full flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Sparkles size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground">Tanya asisten</p>
                    <p className="text-base text-muted-foreground">
                      “Di mana saya taruh kunci motor saya?”
                    </p>
                  </div>
                </div>
                <p className="text-base text-foreground">
                  Jawaban hanya diambil dari lokasi yang Anda catat — asisten menyebut sumbernya dan
                  selalu meminta izin sebelum menulis sesuatu yang baru.
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/assistant"
                    className={cx(
                      "inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <Lightbulb size={18} />
                    Buka asisten
                  </Link>
                  <Link
                    href="/search"
                    className={cx(
                      "inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-secondary px-5 text-base font-medium text-secondary-foreground hover:bg-muted",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <Search size={18} />
                    Cari sendiri
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex h-full flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Plus size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground">Aksi cepat</p>
                    <p className="text-base text-muted-foreground">Jaga catatan Anda tetap terbaru.</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/inventory/new"
                    className={cx(
                      "inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <Plus size={18} />
                    Tambah barang
                  </Link>
                  <Link
                    href="/locations"
                    className={cx(
                      "inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-secondary px-5 text-base font-medium text-secondary-foreground hover:bg-muted",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <MapPin size={18} />
                    Kelola lokasi
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
