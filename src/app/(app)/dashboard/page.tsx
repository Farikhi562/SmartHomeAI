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
import { formatDateTime, formatRelativeTime, toDateTimeAttr, truncate } from "@/lib/format";
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
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {loading || value === null ? "—" : value}
        </p>
        <p className="truncate text-dense text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          "rounded-lg border border-border bg-card p-4 shadow-subtle block transition-colors hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border border-border bg-card p-4 shadow-subtle">{body}</div>;
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
      className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-subtle"
    >
      <div className="relative min-w-0 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Quick search items and locations"
          placeholder="Where did I put…?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit" variant="secondary" disabled={query.trim().length < 2}>
        Search
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
        <CardTitle>Recently updated</CardTitle>
        <Link
          href="/inventory?sort=updatedAt"
          className={cx(
            "text-dense font-medium text-primary underline-offset-4 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {state.loading && <SkeletonRows rows={5} />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={state.reload} />}
        {!state.loading && !state.error && state.data && state.data.items.length === 0 && (
          <p className="text-dense text-muted-foreground">Nothing here yet — add your first item.</p>
        )}
        {!state.loading && !state.error && state.data && state.data.items.length > 0 && (
          <ul className="divide-y divide-border">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/inventory/${item.id}`}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-md px-1 py-2.5 hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-dense font-medium text-foreground">
                      {truncate(item.name, 48)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.lastLocation ? truncate(item.lastLocation.path, 48) : "Never recorded"}
                    </span>
                  </span>
                  <time
                    dateTime={toDateTimeAttr(item.updatedAt)}
                    title={formatDateTime(item.updatedAt)}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatRelativeTime(item.updatedAt)}
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
        <CardTitle>Recently recorded</CardTitle>
        <Link
          href="/activity"
          className={cx(
            "text-dense font-medium text-primary underline-offset-4 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {state.loading && <SkeletonRows rows={5} />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={state.reload} />}
        {!state.loading && !state.error && state.data && state.data.events.length === 0 && (
          <p className="text-dense text-muted-foreground">
            No locations recorded in the last {RECENT_WINDOW_DAYS} days.
          </p>
        )}
        {!state.loading && !state.error && state.data && state.data.events.length > 0 && (
          <ul className="divide-y divide-border">
            {state.data.events.map((event) => (
              <li key={event.id}>
                <Link
                  href={event.item ? `/inventory/${event.item.id}` : "/activity"}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-md px-1 py-2.5 hover:bg-muted/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-dense font-medium text-foreground">
                      {truncate(event.item?.name ?? "An item", 40)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      → {truncate(event.location.path, 44)}
                    </span>
                  </span>
                  <time
                    dateTime={toDateTimeAttr(event.occurredAt)}
                    title={formatDateTime(event.occurredAt)}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {formatRelativeTime(event.occurredAt)}
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
      <PageHeader title="Dashboard" subtitle="What you have, and where you last left it." />
      <QuickSearch />

      {bothEmpty ? (
        <EmptyState
          headingLevel={2}
          icon={<Sparkles size={32} />}
          title="Let's record your first things"
          description="Add a location, add an item, then ask the assistant where you left something."
          action={
            <Link
              href="/locations"
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <MapPin size={16} />
              Add a location
            </Link>
          }
          secondaryAction={
            <Link
              href="/inventory/new"
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-secondary px-4 text-base font-medium text-secondary-foreground hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Plus size={16} />
              Add an item
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Active items"
              value={totalItems}
              loading={itemsState.loading}
              icon={<Box size={18} />}
              href="/inventory?status=active"
            />
            <StatCard
              label="Locations"
              value={totalLocations}
              loading={locationsState.loading}
              icon={<MapPin size={18} />}
              href="/locations"
            />
            <StatCard
              label={`Recorded (last ${RECENT_WINDOW_DAYS} days)`}
              value={activityState.data?.pagination.total ?? null}
              loading={activityState.loading}
              icon={<History size={18} />}
              href="/activity"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RecentItemsCard />
            <RecentLocationsCard />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Ask the assistant</p>
                    <p className="text-dense text-muted-foreground">
                      “Where did I last put my motorcycle keys?”
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Answers come only from your recorded locations — the assistant cites the entries it
                  used and asks before writing anything new.
                </p>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Link
                    href="/assistant"
                    className={cx(
                      "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <Lightbulb size={16} />
                    Open assistant
                  </Link>
                  <Link
                    href="/search"
                    className={cx(
                      "inline-flex h-9 items-center rounded-md border border-border-strong bg-secondary px-4 text-base font-medium text-secondary-foreground hover:bg-muted",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <Search size={16} />
                    Search instead
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Plus size={18} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Quick actions</p>
                    <p className="text-dense text-muted-foreground">Keep your records current.</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Link
                    href="/inventory/new"
                    className={cx(
                      "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <Plus size={16} />
                    Add item
                  </Link>
                  <Link
                    href="/locations"
                    className={cx(
                      "inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-secondary px-4 text-base font-medium text-secondary-foreground hover:bg-muted",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <MapPin size={16} />
                    Manage locations
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
