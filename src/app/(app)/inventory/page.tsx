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
  Archive, Box, CircleDashed, MapPin, Pencil, Plus, Printer, RotateCcw, Search as SearchIcon, Trash,
} from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime, toDateTimeAttr, truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Inventory list (DESIGN_SPEC §1.6, §3): URL is the state — `?q= &status= &category=
 * &locationId= &sort= &order= &offset=` — so views are shareable and the back
 * button behaves. Server-side filtering/sorting/pagination per API_SPEC §3.2.
 * TanStack Table and a DropdownMenu library are out of scope; the table and the
 * mobile card list are hand-built with the same semantics (§3.3).
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px (min-h-11/min-h-12) for the
 * elderly family audience.
 */

const PAGE_SIZES = [20, 50, 100] as const;

type SortKey = "name" | "updatedAt" | "lastRecordedAt";
type SortOrder = "asc" | "desc";
type StatusFilter = "active" | "archived" | "all";

const SORTS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "updatedAt", label: "Terakhir diperbarui" },
  { value: "lastRecordedAt", label: "Terakhir dicatat" },
  { value: "name", label: "Nama (A–Z)" },
];

const STATUSES: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "archived", label: "Diarsipkan" },
  { value: "all", label: "Semua" },
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
        Diarsipkan
      </Badge>
    );
  }
  if (item.lastLocation) {
    return (
      <Badge tone="success">
        <MapPin size={12} />
        Tercatat
      </Badge>
    );
  }
  return (
    <Badge tone="outline">
      <CircleDashed size={12} />
      Belum dicatat
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
      <PageHeader title="Barang" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="h-12 w-64 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        <div className="h-12 w-32 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        <div className="h-12 w-32 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      </div>
      <SkeletonRows rows={10} />
      <span role="status" className="sr-only">
        Memuat daftar barang…
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
        title: "Barang diarsipkan",
        description: `${item.name} disembunyikan dari daftar aktif.`,
        tone: "success",
        action: {
          label: "Urungkan",
          onClick: () => {
            void api.items.unarchive(item.id).then(
              () => {
                listState.reload();
                toast({ title: "Berhasil dipulihkan", tone: "success" });
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
          title: "Belum bisa diarsipkan",
          description: `Masih dirujuk oleh ${items ?? "beberapa"} barang dan ${events ?? "beberapa"} catatan. Perbarui catatan tersebut terlebih dahulu.`,
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
      toast({ title: "Barang dikembalikan ke daftar aktif", tone: "success" });
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
        title: "Barang dihapus",
        description: `${pendingDelete.name} bisa dipulihkan selama 30 hari.`,
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
        title="Barang"
        subtitle="Semua barang yang Anda catat, lengkap dengan tempat terakhir disimpan."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/labels"
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-secondary px-4 text-lg font-medium text-secondary-foreground hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Printer size={16} aria-hidden="true" />
              Cetak label
            </Link>
            <Link
              href="/inventory/new"
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-lg font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Plus size={16} aria-hidden="true" />
              Tambah barang
            </Link>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-subtle">
        <form role="search" onSubmit={onSearchSubmit} className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Cari barang"
              placeholder="Cari nama, kategori, atau catatan…"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                debouncedSearch(event.target.value);
              }}
              className="min-h-12 pl-9 text-lg"
            />
          </div>
          <Button type="submit" variant="secondary" className="min-h-11 text-lg">
            Cari
          </Button>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select
              label="Status"
              value={status}
              onChange={(event) => setParams({ status: event.target.value })}
              className="min-h-12"
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
              label="Kategori"
              value={category}
              onChange={(event) => setParams({ category: event.target.value })}
              className="min-h-12"
            >
              <option value="">Semua kategori</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-52">
            <Select
              label="Lokasi"
              value={locationId}
              onChange={(event) => setParams({ locationId: event.target.value })}
              className="min-h-12"
            >
              <option value="">Semua lokasi</option>
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
              label="Urutkan"
              value={sort}
              onChange={(event) => setParams({ sort: event.target.value })}
              className="min-h-12"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select
              label="Urutan"
              value={order}
              onChange={(event) => setParams({ order: event.target.value })}
              className="min-h-12"
            >
              <option value="desc">Terbaru dulu</option>
              <option value="asc">Terlama dulu</option>
            </Select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => router.replace("/inventory", { scroll: false })}
              className="min-h-11"
            >
              Hapus semua filter
            </Button>
          )}
        </div>

        {pagination && !listState.loading && !listState.error && (
          <p className="text-base text-muted-foreground" aria-live="polite">
            {pagination.total} barang
            {hasFilters ? " sesuai filter Anda" : ""}
          </p>
        )}
      </div>

      {listState.error && <ErrorState error={listState.error} onRetry={listState.reload} className="mb-4" />}

      {listState.loading && <SkeletonRows rows={10} />}

      {!listState.loading && !listState.error && items.length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<Box size={32} />}
          title={hasFilters ? "Tidak ada barang yang cocok" : "Belum ada barang"}
          description={
            hasFilters
              ? "Coba kata kunci lain, atau hapus filter untuk melihat semua barang."
              : "Tambahkan barang pertama untuk mulai mencatat di mana Anda menyimpannya."
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                className="min-h-11 text-lg"
                onClick={() => router.replace("/inventory", { scroll: false })}
              >
                Hapus filter
              </Button>
            ) : (
              <Link
                href="/inventory/new"
                className={cx(
                  "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-lg font-medium text-primary-foreground hover:bg-primary-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <Plus size={16} aria-hidden="true" />
                Tambah barang pertama
              </Link>
            )
          }
        />
      )}

      {!listState.loading && !listState.error && items.length > 0 && (
        <>
          {/* Desktop table (≥ 768 px) */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-subtle md:block">
            <table className="w-full border-collapse text-base">
              <caption className="sr-only">
                Daftar barang Anda, dengan lokasi terakhir tercatat dan statusnya
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold text-foreground">Barang</th>
                  <th scope="col" className="w-40 px-4 py-3 font-semibold text-foreground">Kategori</th>
                  <th scope="col" className="w-60 px-4 py-3 font-semibold text-foreground">Terakhir dicatat</th>
                  <th scope="col" className="w-40 px-4 py-3 font-semibold text-foreground">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-foreground">
                    <span className="sr-only">Aksi</span>
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
                          <span className="sr-only">Tanpa kategori</span>
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
                            className="text-sm text-muted-foreground"
                          >
                            {formatRelativeTime(item.lastLocation.occurredAt)}
                          </time>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Belum pernah dicatat</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge item={item} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => router.push(`/inventory/${item.id}/edit`)}
                          className="min-h-11"
                          iconLeft={<Pencil size={16} aria-hidden="true" />}
                        >
                          Ubah
                        </Button>
                        {item.archivedAt ? (
                          <Button
                            variant="ghost"
                            onClick={() => void unarchiveItem(item)}
                            className="min-h-11"
                            iconLeft={<RotateCcw size={16} aria-hidden="true" />}
                          >
                            Pulihkan
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => void archiveItem(item)}
                            className="min-h-11"
                            iconLeft={<Archive size={16} aria-hidden="true" />}
                          >
                            Arsipkan
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete(item);
                          }}
                          className="min-h-11"
                          iconLeft={<Trash size={16} aria-hidden="true" />}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (< 768 px) */}
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card p-4 shadow-subtle">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/inventory/${item.id}`}
                    className={cx(
                      "min-w-0 flex-1 text-lg font-medium text-foreground underline-offset-4 hover:underline",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                    )}
                  >
                    {truncate(item.name, 60)}
                  </Link>
                  <StatusBadge item={item} />
                </div>
                <dl className="mt-3 space-y-1.5 text-base">
                  <div className="flex gap-3">
                    <dt className="w-28 shrink-0 font-medium text-muted-foreground">Kategori</dt>
                    <dd className="text-foreground">{item.category || "—"}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-28 shrink-0 font-medium text-muted-foreground">Terakhir dicatat</dt>
                    <dd className="text-foreground">
                      {item.lastLocation ? (
                        <>
                          {truncate(item.lastLocation.path, 40)}{" "}
                          <time
                            dateTime={toDateTimeAttr(item.lastLocation.occurredAt)}
                            title={formatDateTime(item.lastLocation.occurredAt)}
                            className="text-sm text-muted-foreground"
                          >
                            {formatRelativeTime(item.lastLocation.occurredAt)}
                          </time>
                        </>
                      ) : (
                        "Belum pernah dicatat"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    className="min-h-11 text-lg"
                    onClick={() => router.push(`/inventory/${item.id}/edit`)}
                  >
                    Ubah
                  </Button>
                  {item.archivedAt ? (
                    <Button variant="ghost" className="min-h-11 text-lg" onClick={() => void unarchiveItem(item)}>
                      Pulihkan
                    </Button>
                  ) : (
                    <Button variant="ghost" className="min-h-11 text-lg" onClick={() => void archiveItem(item)}>
                      Arsipkan
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="min-h-11 text-lg"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(item);
                    }}
                  >
                    Hapus
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
        title="Hapus barang ini?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” akan dihapus dari catatan aktif Anda. Barang bisa dipulihkan selama 30 hari.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" className="min-h-11 text-lg" onClick={() => setPendingDelete(null)} disabled={deleteBusy}>
              Batal
            </Button>
            <Button variant="danger" className="min-h-11 text-lg" loading={deleteBusy} onClick={() => void confirmDelete()}>
              Hapus
            </Button>
          </>
        }
      >
        {deleteError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-base text-destructive">
            {deleteError}
          </p>
        )}
      </Dialog>
    </>
  );
}
