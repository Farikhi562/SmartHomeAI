"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type SearchResponse } from "@/client/api";
import {
  clearHistory,
  readHistory,
  removeFromHistory,
  saveQuery,
  writeHistory,
} from "@/client/search-history";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Box, MapPin, Plus, Search as SearchIcon, X } from "@/components/ui/icons";
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

/**
 * Riwayat/saran chips (FR-032): ≥ 44 px tall, ≥ 12 px apart (the list carries
 * `gap-3`), text truncated instead of forcing horizontal scroll at 360 px.
 */
const CHIP_CLASS =
  "inline-flex min-h-11 max-w-[16rem] items-center gap-2 rounded-full border border-border bg-card px-4 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CHIP_REMOVE_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-danger-surface hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  // Riwayat pencarian (FR-032): browser-local only, newest first, cap 10.
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    setHistory(readHistory());
  }, []);

  // Remember every executed search (a `q` in the URL, ≥ 2 chars). Re-running an
  // identical query moves it to the front instead of duplicating it.
  useEffect(() => {
    const executed = q.trim();
    if (executed.length < MIN_QUERY) return;
    setHistory(saveQuery(executed));
  }, [q]);

  // Saran (FR-032): existing owner-scoped APIs only — recent items (newest
  // updated first) and locations. Failures hide the section, never the page.
  const suggestionsState = useAsync(async () => {
    const [recentItems, locations] = await Promise.all([
      api.items.list({ status: "active", limit: 5, sort: "updatedAt", order: "desc" }),
      api.locations.list(),
    ]);
    return {
      items: recentItems.items.map((item) => item.name).slice(0, 5),
      locations: locations.locations.filter((loc) => !loc.archivedAt).map((loc) => loc.name).slice(0, 5),
    };
  }, []);

  const suggestionChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: { value: string; icon: typeof Box }[] = [];
    const push = (value: string, icon: typeof Box) => {
      const trimmed = value.trim();
      const key = trimmed.toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      chips.push({ value: trimmed, icon });
    };
    for (const entry of history.slice(0, 5)) push(entry, SearchIcon);
    for (const name of suggestionsState.data?.items ?? []) push(name, Box);
    for (const name of suggestionsState.data?.locations ?? []) push(name, MapPin);
    return chips;
  }, [history, suggestionsState.data]);

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

  /** Tap a riwayat/saran chip: fill the field and run that query (AC-032-2). */
  const runQuery = (value: string) => {
    setDraft(value);
    navigate({ q: value });
  };

  const removeChip = (value: string) => {
    const next = removeFromHistory(history, value);
    setHistory(next);
    writeHistory(next);
  };

  const clearAll = () => {
    setHistory([]);
    clearHistory();
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

      {/* Riwayat pencarian (FR-032): browser-local chips, hidden when empty. */}
      {history.length > 0 && (
        <section aria-labelledby="riwayat-heading" className="mb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="riwayat-heading" className="text-lg font-semibold text-foreground">
              Riwayat pencarian
            </h2>
            <Button variant="ghost" className="min-h-11" onClick={clearAll}>
              Hapus semua
            </Button>
          </div>
          <ul className="flex flex-wrap gap-3">
            {history.map((entry) => (
              <li key={entry} className="flex items-center gap-3">
                <button type="button" onClick={() => runQuery(entry)} className={CHIP_CLASS}>
                  <span className="min-w-0 truncate">{entry}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Hapus “${entry}” dari riwayat`}
                  onClick={() => removeChip(entry)}
                  className={CHIP_REMOVE_CLASS}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Saran (FR-032): recent queries + the owner's recent items & locations. */}
      {suggestionChips.length > 0 && (
        <section aria-labelledby="saran-heading" className="mb-5">
          <h2 id="saran-heading" className="mb-3 text-lg font-semibold text-foreground">
            Saran
          </h2>
          <ul className="flex flex-wrap gap-3">
            {suggestionChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <li key={chip.value}>
                  <button type="button" onClick={() => runQuery(chip.value)} className={CHIP_CLASS}>
                    <Icon size={16} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{chip.value}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
