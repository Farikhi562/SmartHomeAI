"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { api, type SearchResponse } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { MapPin, Plus, Search as SearchIcon } from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime, toDateTimeAttr, truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Search results (DESIGN_SPEC §1.11, FR-005): deterministic recall over items
 * and locations with visible match provenance. The URL is the state, so views
 * are shareable and the assistant's outage fallback can link straight here
 * (FR-013). Match-type badges come from the server's `matchType` — ranking is
 * exact > prefix > fuzzy > full-text, and never fabricated client-side.
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px for the elderly audience.
 */

const MIN_QUERY = 2;
const MAX_QUERY = 200;
const PAGE_SIZE = 20;

type TypeFilter = "all" | "items" | "locations";

const TYPE_TABS: ReadonlyArray<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "items", label: "Barang" },
  { value: "locations", label: "Lokasi" },
];

const MATCH_TONES: Record<string, "success" | "info" | "warning" | "muted"> = {
  exact: "success",
  prefix: "info",
  fuzzy: "warning",
  fulltext: "muted",
};

function MatchBadge({ matchType }: { matchType: string }) {
  const label =
    matchType === "exact"
      ? "Cocok persis"
      : matchType === "prefix"
        ? "Awalan sama"
        : matchType === "fuzzy"
          ? "Mirip"
          : "Teks lengkap";
  return <Badge tone={MATCH_TONES[matchType] ?? "muted"}>{label}</Badge>;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchView />
    </Suspense>
  );
}

function SearchSkeleton() {
  return (
    <>
      <PageHeader title="Cari" />
      <SkeletonRows rows={6} />
      <span role="status" className="sr-only">
        Memuat hasil pencarian…
      </span>
    </>
  );
}

function SearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const type = (searchParams.get("type") ?? "all") as TypeFilter;
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  // < 2 chars → no request, prompt instead (FR-005 error conditions).
  const tooShort = q.trim().length > 0 && q.trim().length < MIN_QUERY;
  const truncated = q.length > MAX_QUERY;
  const effectiveQuery = truncated ? q.slice(0, MAX_QUERY) : q;

  const state = useAsync<SearchResponse>(
    () => api.search({ q: effectiveQuery, type, limit: PAGE_SIZE, offset }),
    [effectiveQuery, type, offset],
  );

  const navigate = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    if (!("offset" in patch)) params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate({ q: draft.trim() });
  };

  const items = state.data?.items ?? [];
  const locations = state.data?.locations ?? [];
  const total = state.data?.pagination.total ?? 0;
  const showResults = !state.loading && !state.error && !tooShort && q.trim().length >= MIN_QUERY;

  return (
    <>
      <PageHeader title="Cari" subtitle="Pencarian pasti di semua barang dan lokasi Anda." />

      <form role="search" onSubmit={submit} className="mb-5 flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Kata kunci pencarian"
            placeholder="Contoh: kunci motor"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-12 pl-9 text-lg"
          />
        </div>
        <Button type="submit" className="min-h-12 text-lg">
          Cari
        </Button>
      </form>

      {truncated && (
        <p role="status" className="mb-4 rounded-md border border-border bg-muted p-3 text-base text-foreground">
          Kata kunci Anda lebih dari {MAX_QUERY} karakter dan sudah dipotong untuk pencarian ini.
        </p>
      )}

      {/* Type filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Jenis hasil">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={type === tab.value}
            onClick={() => navigate({ type: tab.value === "all" ? null : tab.value })}
            className={cx(
              "min-h-11 rounded-md px-4 py-2 text-base font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              type === tab.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tooShort && (
        <EmptyState
          headingLevel={2}
          icon={<SearchIcon size={32} />}
          title="Terus mengetik saja"
          description={`Minimal ${MIN_QUERY} karakter — pencarian butuh sedikit lebih banyak lagi.`}
        />
      )}

      {q.trim().length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<SearchIcon size={32} />}
          title="Cari di catatan Anda"
          description="Temukan barang berdasarkan nama, kategori, atau catatan — atau lokasi berdasarkan namanya."
        />
      )}

      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}

      {state.loading && <SkeletonRows rows={6} />}

      {showResults && total === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<SearchIcon size={32} />}
          title={`Tidak ada hasil untuk “${truncate(q, 40)}”`}
          description="Coba kata kunci yang lebih pendek atau berbeda — atau tambahkan barangnya jika belum tercatat."
          action={
            <Link
              href={`/inventory/new?name=${encodeURIComponent(q)}`}
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-lg font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Plus size={16} aria-hidden="true" />
              Tambahkan “{truncate(q, 24)}”
            </Link>
          }
        />
      )}

      {showResults && total > 0 && (
        <>
          <p className="mb-3 text-base text-muted-foreground" aria-live="polite">
            {total} hasil
          </p>

          {items.length > 0 && (
            <section aria-labelledby="items-results" className="mb-6">
              <h2 id="items-results" className="mb-2 text-lg font-semibold text-foreground">
                Barang
              </h2>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-4 shadow-subtle transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/inventory/${item.id}`}
                        className={cx(
                          "text-lg font-medium text-foreground underline-offset-4 hover:underline",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                        )}
                      >
                        {item.name}
                      </Link>
                      <MatchBadge matchType={item.matchType} />
                      {item.category && (
                        <Badge tone="outline">{item.category}</Badge>
                      )}
                    </div>
                    {item.lastLocation ? (
                      <p className="mt-1 text-base text-muted-foreground">
                        <MapPin size={12} className="mr-1 inline" aria-hidden="true" />
                        {item.lastLocation.path} —{" "}
                        <time
                          dateTime={toDateTimeAttr(item.lastLocation.occurredAt)}
                          title={formatDateTime(item.lastLocation.occurredAt)}
                        >
                          {formatRelativeTime(item.lastLocation.occurredAt)}
                        </time>
                      </p>
                    ) : (
                      <p className="mt-1 text-base text-muted-foreground">Belum pernah dicatat</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {locations.length > 0 && (
            <section aria-labelledby="locations-results" className="mb-6">
              <h2 id="locations-results" className="mb-2 text-lg font-semibold text-foreground">
                Lokasi
              </h2>
              <ul className="flex flex-col gap-3">
                {locations.map((location) => (
                  <li
                    key={location.id}
                    className="rounded-lg border border-border bg-card p-4 shadow-subtle transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/locations?locationId=${location.id}`}
                        className={cx(
                          "text-lg font-medium text-foreground underline-offset-4 hover:underline",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                        )}
                      >
                        {location.path}
                      </Link>
                      {location.matchType && <MatchBadge matchType={location.matchType} />}
                      {location.archivedAt && <Badge tone="muted">Diarsipkan</Badge>}
                      <Badge tone="outline">Tingkat {location.depth ?? "?"}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Pagination
            limit={PAGE_SIZE}
            offset={offset}
            total={total}
            onChange={(nextOffset) => navigate({ offset: nextOffset })}
          />
        </>
      )}

      {showResults && items.length === 0 && locations.length === 0 && total > 0 && (
        <p className="text-base text-muted-foreground">
          Tidak ada hasil untuk jenis yang dipilih — coba tab “Semua”.
        </p>
      )}
    </>
  );
}
