"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, toApiError, type ItemDto, type ItemsListResponse } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  Archive, Box, CircleDashed, MapPin, Pencil, Plus, RotateCcw, Search as SearchIcon, Trash,
} from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime, toDateTimeAttr, truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Inventory list (DESIGN_SPEC §1.6, §3): URL is the state — `?q= &status= &category=
 * &locationId= &sort= &order= &offset=` — so views are shareable and the back
 * button behaves. Server-side filtering/sorting/pagination per API_SPEC §3.2.
 * TanStack Table and a DropdownMenu library are out of scope; the table and the
 * mobile card list are hand-built with the same semantics (§3.3).
 */

const PAGE_SIZES = [20, 50, 100] as const;

type SortKey = "name" | "updatedAt" | "lastRecordedAt";
type SortOrder = "asc" | "desc";
type StatusFilter = "active" | "archived" | "all";

const SORTS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "updatedAt", label: "Recently updated" },
  { value: "lastRecordedAt", label: "Last recorded" },
  { value: "name", label: "Name" },
];

const STATUSES: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

function useDebouncedCallback(callback: (value: string) => void, delayMs = 300) {
  const timerRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  return useCallback(
    (value: string) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => callbackRef.current(value), delayMs);
    },
    [delayMs],
  );
}

function StatusBadge({ item }: { item: ItemDto }) {
  if (item.archivedAt) {
    return (
      <Badge tone="muted">
        <Archive size={12} />
        Archived
      </Badge>
    );
  }
  if (item.lastLocation) {
    return (
      <Badge tone="success">
        <MapPin size={12} />
        Recorded
      </Badge>
    );
  }
  return (
    <Badge tone="outline">
      <CircleDashed size={12} />
      Never recorded
    </Badge>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventorySkeleton />}>
      <InventoryView />
    </Suspense>
  );
}

function InventorySkeleton() {
  return (
    <>
      <PageHeader title="Inventory" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      </div>
      <SkeletonRows rows={10} />
      <span role="status" className="sr-only">
        Loading inventory
      </span>
    </>
  );
}

function InventoryView() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") ?? "active") as StatusFilter;
  const category = searchParams.get("category") ?? "";
  const locationId = searchParams.get("locationId") ?? "";
  const sort = (searchParams.get("sort") ?? "updatedAt") as SortKey;
  const order = (searchParams.get("order") ?? "desc") as SortOrder;
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
  const limitParam = Math.max(1, Number(searchParams.get("limit") ?? "20") || 20);
  const limit = (PAGE_SIZES as readonly number[]).includes(limitParam) ? limitParam : 20;

  const [searchText, setSearchText] = useState(q);
  const [pendingDelete, setPendingDelete] = useState<ItemDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Keep the local input in sync when the URL changes underneath us (back nav).
  useEffect(() => {
    setSearchText(q);
  }, [q]);

  const setParams = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      // Any filter change resets paging unless offset itself is being set.
      if (!("offset" in patch) && !("limit" in patch)) next.delete("offset");
      router.replace(`/inventory?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const debouncedSearch = useDebouncedCallback((value: string) => setParams({ q: value }));

  const listState = useAsync<ItemsListResponse>(
    () => api.items.list({ q: q || undefined, status, category: category || undefined, locationId: locationId || undefined, sort, order, limit, offset }),
    [q, status, category, locationId, sort, order, limit, offset],
  );

  const categoriesState = useAsync(() => api.items.list({ status: "all", limit: 100 }), []);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of categoriesState.data?.items ?? []) {
      if (item.category) seen.add(item.category);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [categoriesState.data]);

  const locationsState = useAsync(() => api.locations.list(), []);

  const hasFilters = Boolean(q || category || locationId || status !== "active");

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParams({ q: searchText.trim() });
  };

  const archiveItem = async (item: ItemDto) => {
    try {
      const updated = await api.items.archive(item.id);
      listState.reload();
      toast({
        title: "Item archived",
        description: `${item.name} is hidden from the active view.`,
        tone: "success",
        action: {
          label: "Undo",
          onClick: () => {
            void api.items.unarchive(item.id).then(
              () => {
                listState.reload();
                toast({ title: "Restored", tone: "success" });
              },
              (error: unknown) => {
                toast({ title: toApiError(error).message, tone: "error" });
              },
            );
          },
        },
      });
      return updated;
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "CONFLICT") {
        const items = apiError.numberExtra("referencedByItems");
        const events = apiError.numberExtra("referencedByEvents");
        toast({
          title: "Can't archive yet",
          description: `Still referenced by ${items ?? "some"} item(s) and ${events ?? "some"} event(s). Update those records first.`,
          tone: "error",
        });
        return;
      }
      toast({ title: apiError.message, tone: "error" });
    }
  };

  const unarchiveItem = async (item: ItemDto) => {
    try {
      await api.items.unarchive(item.id);
      listState.reload();
      toast({ title: "Item restored to active", tone: "success" });
    } catch (error) {
      toast({ title: toApiError(error).message, tone: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.items.remove(pendingDelete.id);
      setPendingDelete(null);
      listState.reload();
      toast({
        title: "Item deleted",
        description: `${pendingDelete.name} can be restored for 30 days.`,
        tone: "success",
      });
    } catch (error) {
      setDeleteError(toApiError(error).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const items = listState.data?.items ?? [];
  const pagination = listState.data?.pagination;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Everything you track, with where you last left it."
        actions={
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
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-subtle">
        <form role="search" onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search inventory"
              placeholder="Search by name, category, or note…"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                debouncedSearch(event.target.value);
              }}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select
              label="Status"
              value={status}
              onChange={(event) => setParams({ status: event.target.value })}
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select
              label="Category"
              value={category}
              onChange={(event) => setParams({ category: event.target.value })}
            >
              <option value="">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-52">
            <Select
              label="Location"
              value={locationId}
              onChange={(event) => setParams({ locationId: event.target.value })}
            >
              <option value="">All locations</option>
              {(locationsState.data?.locations ?? [])
                .filter((location) => !location.archivedAt)
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {truncate(`${"\u00A0".repeat(location.depth * 2)}${location.path}`, 60)}
                  </option>
                ))}
            </Select>
          </div>
          <div className="w-48">
            <Select
              label="Sort by"
              value={sort}
              onChange={(event) => setParams({ sort: event.target.value })}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Select
              label="Order"
              value={order}
              onChange={(event) => setParams({ order: event.target.value })}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => router.replace("/inventory", { scroll: false })}
              className="mb-0.5"
            >
              Clear all
            </Button>
          )}
        </div>

        {pagination && !listState.loading && !listState.error && (
          <p className="text-dense text-muted-foreground" aria-live="polite">
            {pagination.total} item{pagination.total === 1 ? "" : "s"}
            {hasFilters ? " matching your filters" : ""}
          </p>
        )}
      </div>

      {listState.error && <ErrorState error={listState.error} onRetry={listState.reload} className="mb-4" />}

      {listState.loading && <SkeletonRows rows={10} />}

      {!listState.loading && !listState.error && items.length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<Box size={32} />}
          title={hasFilters ? "No items match your filters" : "No items yet"}
          description={
            hasFilters
              ? "Try a different search term, or clear the filters to see everything."
              : "Add your first item to start tracking where you leave things."
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={() => router.replace("/inventory", { scroll: false })}>
                Clear filters
              </Button>
            ) : (
              <Link
                href="/inventory/new"
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <Plus size={16} />
                Add your first item
              </Link>
            )
          }
        />
      )}

      {!listState.loading && !listState.error && items.length > 0 && (
        <>
          {/* Desktop table (≥ 768 px) */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-subtle md:block">
            <table className="w-full border-collapse text-dense">
              <caption className="sr-only">Your inventory, with last recorded location and status</caption>
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th scope="col" className="px-4 py-2.5 font-semibold text-foreground">Item</th>
                  <th scope="col" className="w-40 px-4 py-2.5 font-semibold text-foreground">Category</th>
                  <th scope="col" className="w-60 px-4 py-2.5 font-semibold text-foreground">Last recorded</th>
                  <th scope="col" className="w-40 px-4 py-2.5 font-semibold text-foreground">Status</th>
                  <th scope="col" className="w-56 px-4 py-2.5 text-right font-semibold text-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="group hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/inventory/${item.id}`}
                        className={cx(
                          "font-medium text-foreground underline-offset-4 hover:underline",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                        )}
                      >
                        {truncate(item.name, 60)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.category ? (
                        truncate(item.category, 30)
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">No category</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.lastLocation ? (
                        <>
                          <span className="block truncate text-foreground" title={item.lastLocation.path}>
                            {truncate(item.lastLocation.name, 28)}
                          </span>
                          <time
                            dateTime={toDateTimeAttr(item.lastLocation.occurredAt)}
                            title={formatDateTime(item.lastLocation.occurredAt)}
                            className="text-xs text-muted-foreground"
                          >
                            {formatRelativeTime(item.lastLocation.occurredAt)}
                          </time>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never recorded</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge item={item} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/inventory/${item.id}/edit`)}>
                          <Pencil size={14} />
                          <span className="sr-only">Edit {item.name}</span>
                        </Button>
                        {item.archivedAt ? (
                          <Button variant="ghost" size="sm" onClick={() => void unarchiveItem(item)}>
                            <RotateCcw size={14} />
                            <span className="sr-only">Restore {item.name}</span>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => void archiveItem(item)}>
                            <Archive size={14} />
                            <span className="sr-only">Archive {item.name}</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete(item);
                          }}
                        >
                          <Trash size={14} />
                          <span className="sr-only">Delete {item.name}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (< 768 px) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card p-3 shadow-subtle">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/inventory/${item.id}`}
                    className={cx(
                      "min-w-0 flex-1 text-base font-medium text-foreground underline-offset-4 hover:underline",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                    )}
                  >
                    {truncate(item.name, 60)}
                  </Link>
                  <StatusBadge item={item} />
                </div>
                <dl className="mt-2 space-y-1 text-dense">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted-foreground">Category</dt>
                    <dd className="text-foreground">{item.category || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted-foreground">Last recorded</dt>
                    <dd className="text-foreground">
                      {item.lastLocation ? (
                        <>
                          {truncate(item.lastLocation.path, 40)}{" "}
                          <time
                            dateTime={toDateTimeAttr(item.lastLocation.occurredAt)}
                            title={formatDateTime(item.lastLocation.occurredAt)}
                            className="text-xs text-muted-foreground"
                          >
                            {formatRelativeTime(item.lastLocation.occurredAt)}
                          </time>
                        </>
                      ) : (
                        "Never recorded"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/inventory/${item.id}/edit`)}>
                    Edit
                  </Button>
                  {item.archivedAt ? (
                    <Button variant="ghost" size="sm" onClick={() => void unarchiveItem(item)}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => void archiveItem(item)}>
                      Archive
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(item);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {pagination && (
        <Pagination
          limit={pagination.limit}
          offset={pagination.offset}
          total={pagination.total}
          onChange={(nextOffset) => setParams({ offset: nextOffset })}
          className="mt-4"
        />
      )}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this item?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be removed from your active records. You can restore it for 30 days.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      >
        {deleteError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive">
            {deleteError}
          </p>
        )}
      </Dialog>
    </>
  );
}
