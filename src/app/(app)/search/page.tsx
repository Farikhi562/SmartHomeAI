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
 */

const MIN_QUERY = 2;
const MAX_QUERY = 200;
const PAGE_SIZE = 20;

type TypeFilter = "all" | "items" | "locations";

const TYPE_TABS: ReadonlyArray<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "items", label: "Items" },
  { value: "locations", label: "Locations" },
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
      ? "Exact match"
      : matchType === "prefix"
        ? "Starts with"
        : matchType === "fuzzy"
          ? "Similar"
          : "Full text";
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
      <PageHeader title="Search" />
      <SkeletonRows rows={6} />
      <span role="status" className="sr-only">
        Loading search results
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
      <PageHeader title="Search" subtitle="Deterministic search across your items and locations." />

      <form role="search" onSubmit={submit} className="mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search query"
            placeholder="e.g. motorcycle keys"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {truncated && (
        <p role="status" className="mb-4 rounded-md border border-border bg-muted p-3 text-dense text-muted-foreground">
          Your query was longer than {MAX_QUERY} characters and was shortened for this search.
        </p>
      )}

      {/* Type filter tabs */}
      <div className="mb-4 flex gap-1" role="tablist" aria-label="Result type">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={type === tab.value}
            onClick={() => navigate({ type: tab.value === "all" ? null : tab.value })}
            className={cx(
              "rounded-md px-3 py-1.5 text-dense font-medium",
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
          title="Keep typing"
          description={`${MIN_QUERY} characters minimum — the search needs a little more to go on.`}
        />
      )}

      {q.trim().length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<SearchIcon size={32} />}
          title="Search your records"
          description="Find an item by name, category, or note — or a location by path."
        />
      )}

      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}

      {state.loading && <SkeletonRows rows={6} />}

      {showResults && total === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<SearchIcon size={32} />}
          title={`No results for “${truncate(q, 40)}”`}
          description="Try a shorter or different term — or create the item if it doesn't exist yet."
          action={
            <Link
              href={`/inventory/new?name=${encodeURIComponent(q)}`}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Plus size={16} />
              Create item “{truncate(q, 24)}”
            </Link>
          }
        />
      )}

      {showResults && total > 0 && (
        <>
          <p className="mb-3 text-dense text-muted-foreground" aria-live="polite">
            {total} result{total === 1 ? "" : "s"}
          </p>

          {items.length > 0 && (
            <section aria-labelledby="items-results" className="mb-6">
              <h2 id="items-results" className="mb-2 text-base font-semibold text-foreground">
                Items
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-3 shadow-subtle transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/inventory/${item.id}`}
                        className={cx(
                          "text-base font-medium text-foreground underline-offset-4 hover:underline",
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
                      <p className="mt-1 text-dense text-muted-foreground">
                        <MapPin size={12} className="mr-1 inline" />
                        {item.lastLocation.path} —{" "}
                        <time
                          dateTime={toDateTimeAttr(item.lastLocation.occurredAt)}
                          title={formatDateTime(item.lastLocation.occurredAt)}
                        >
                          {formatRelativeTime(item.lastLocation.occurredAt)}
                        </time>
                      </p>
                    ) : (
                      <p className="mt-1 text-dense text-muted-foreground">Never recorded</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {locations.length > 0 && (
            <section aria-labelledby="locations-results" className="mb-6">
              <h2 id="locations-results" className="mb-2 text-base font-semibold text-foreground">
                Locations
              </h2>
              <ul className="flex flex-col gap-2">
                {locations.map((location) => (
                  <li
                    key={location.id}
                    className="rounded-lg border border-border bg-card p-3 shadow-subtle transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/locations?locationId=${location.id}`}
                        className={cx(
                          "text-base font-medium text-foreground underline-offset-4 hover:underline",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                        )}
                      >
                        {location.path}
                      </Link>
                      {location.matchType && <MatchBadge matchType={location.matchType} />}
                      {location.archivedAt && <Badge tone="muted">Archived</Badge>}
                      <Badge tone="outline">Depth {location.depth ?? "?"}</Badge>
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
        <p className="text-dense text-muted-foreground">
          No results of the selected type — try the “All” tab.
        </p>
      )}
    </>
  );
}
