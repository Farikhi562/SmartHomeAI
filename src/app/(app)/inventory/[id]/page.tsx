"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api, toApiError, type EventDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { RecordLocationDialog } from "@/components/items/RecordLocationDialog";
import {
  AlertTriangle, Archive, Box, Clock, MapPin, Pencil, Plus, RotateCcw, Sparkles, Trash,
} from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime, toDateTimeAttr, truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Item detail (DESIGN_SPEC §1.7) + embedded location timeline (§1.10).
 * The item's location is always *derived* from its newest event and shown with
 * the "may have moved since" caveat (FR-003.3, FR-008.1) — never as a stored
 * authoritative field. History is append-only (FR-004.2).
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px for the elderly audience.
 */

const linkButtonBase =
  "inline-flex min-h-11 items-center rounded-md px-4 text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-3 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event, highlight }: { event: EventDto; highlight?: boolean }) {
  return (
    <li
      id={`event-${event.id}`}
      className={cx(
        "flex gap-3 scroll-mt-24 rounded-md p-2 transition-colors",
        highlight && "bg-accent/60",
      )}
    >
      <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-medium text-foreground">{event.location.path}</p>
          <Badge tone={event.source === "ASSISTANT" ? "info" : "muted"}>
            {event.source === "ASSISTANT" ? <Sparkles size={12} aria-hidden="true" /> : <Pencil size={12} aria-hidden="true" />}
            {event.source === "ASSISTANT" ? "Asisten" : "Manual"}
          </Badge>
          {event.confidence === "INFERRED" && (
            <Badge tone="warning">
              <AlertTriangle size={12} aria-hidden="true" />
              Disimpulkan
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <time dateTime={toDateTimeAttr(event.occurredAt)} title={formatDateTime(event.occurredAt)}>
            Diletakkan {formatDateTime(event.occurredAt)}
          </time>
          {" · "}
          <time
            dateTime={toDateTimeAttr(event.recordedAt)}
            title={formatDateTime(event.recordedAt)}
          >
            dicatat {formatRelativeTime(event.recordedAt)}
          </time>
        </p>
        {event.note && <p className="mt-1 text-base text-muted-foreground">{event.note}</p>}
      </div>
    </li>
  );
}

export default function ItemDetailPage() {
  return <ItemDetail />;
}

function ItemDetail() {
  const params = useParams<{ id: string }>();
  const itemId = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [highlightEvent, setHighlightEvent] = useState<string | null>(null);

  const itemState = useAsync(() => api.items.get(itemId), [itemId]);
  const eventsState = useAsync(() => api.items.events(itemId, { limit: 50 }), [itemId]);

  const item = itemState.data;
  const events = eventsState.data?.events ?? [];

  const archive = async () => {
    if (!item) return;
    try {
      await api.items.archive(item.id);
      itemState.reload();
      toast({
        title: "Barang diarsipkan",
        description: "Barang disembunyikan dari daftar aktif.",
        tone: "success",
        action: {
          label: "Urungkan",
          onClick: () => {
            void api.items.unarchive(item.id).then(
              () => {
                itemState.reload();
                toast({ title: "Berhasil dipulihkan", tone: "success" });
              },
              (error: unknown) => toast({ title: toApiError(error).message, tone: "error" }),
            );
          },
        },
      });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "CONFLICT") {
        const items = apiError.numberExtra("referencedByItems");
        const evts = apiError.numberExtra("referencedByEvents");
        toast({
          title: "Belum bisa diarsipkan",
          description: `Masih dirujuk oleh ${items ?? "beberapa"} barang dan ${evts ?? "beberapa"} catatan.`,
          tone: "error",
        });
        return;
      }
      toast({ title: apiError.message, tone: "error" });
    }
  };

  const unarchive = async () => {
    if (!item) return;
    try {
      await api.items.unarchive(item.id);
      itemState.reload();
      toast({ title: "Barang dipulihkan", tone: "success" });
    } catch (error) {
      toast({ title: toApiError(error).message, tone: "error" });
    }
  };

  const restore = async () => {
    if (!item) return;
    try {
      await api.items.restore(item.id);
      itemState.reload();
      toast({ title: "Barang dipulihkan", tone: "success" });
    } catch (error) {
      toast({ title: toApiError(error).message, tone: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!item) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.items.remove(item.id);
      toast({
        title: "Barang dihapus",
        description: `${item.name} bisa dipulihkan selama 30 hari.`,
        tone: "success",
      });
      router.push("/inventory");
    } catch (error) {
      setDeleteError(toApiError(error).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const onRecorded = useCallback(
    (event: EventDto) => {
      setHighlightEvent(event.id);
      eventsState.reload();
      itemState.reload();
      toast({
        title: "Lokasi dicatat",
        description: `${item?.name ?? "Barang"} → ${event.location.path}`,
        tone: "success",
      });
    },
    // Whole state objects: `reload` inside them is stable (useAsync uses
    // useCallback([])), and exhaustive-deps asks for the objects themselves.
    [eventsState, itemState, item?.name, toast],
  );

  if (itemState.loading) {
    return (
      <>
        <PageHeader
          title="Memuat barang…"
          breadcrumbs={[{ label: "Barang", href: "/inventory" }, { label: "Barang" }]}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
        <span role="status" className="sr-only">
          Memuat barang…
        </span>
      </>
    );
  }

  if (itemState.error || !item) {
    const notFound = itemState.error?.code === "NOT_FOUND";
    return (
      <>
        <PageHeader
          title="Barang"
          breadcrumbs={[{ label: "Barang", href: "/inventory" }, { label: "Barang" }]}
        />
        {notFound ? (
          <EmptyState
            headingLevel={2}
            icon={<Box size={32} />}
            title="Barang tidak ditemukan"
            description="Barangnya mungkin sudah dihapus, atau bukan milik Anda."
            action={
              <Link
                href="/inventory"
                className={cx(
                  linkButtonBase,
                  "bg-primary text-primary-foreground hover:bg-primary-hover",
                )}
              >
                Kembali ke daftar barang
              </Link>
            }
          />
        ) : (
          <ErrorState error={itemState.error} onRetry={itemState.reload} />
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={truncate(item.name, 60)}
        breadcrumbs={[{ label: "Barang", href: "/inventory" }, { label: item.name }]}
        subtitle={item.category ? `Kategori: ${item.category}` : "Tanpa kategori"}
        actions={
          <>
            <Button
              variant="secondary"
              className="min-h-11 text-lg"
              onClick={() => router.push(`/inventory/${item.id}/edit`)}
              iconLeft={<Pencil size={16} aria-hidden="true" />}
            >
              Ubah
            </Button>
            <Button
              className="min-h-11 text-lg"
              onClick={() => setRecordOpen(true)}
              iconLeft={<MapPin size={16} aria-hidden="true" />}
            >
              Catat lokasi
            </Button>
            {item.deletedAt ? (
              <Button
                variant="secondary"
                className="min-h-11 text-lg"
                onClick={() => void restore()}
                iconLeft={<RotateCcw size={16} aria-hidden="true" />}
              >
                Pulihkan
              </Button>
            ) : item.archivedAt ? (
              <Button
                variant="secondary"
                className="min-h-11 text-lg"
                onClick={() => void unarchive()}
                iconLeft={<RotateCcw size={16} aria-hidden="true" />}
              >
                Pulihkan
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="min-h-11 text-lg"
                onClick={() => void archive()}
                iconLeft={<Archive size={16} aria-hidden="true" />}
              >
                Arsipkan
              </Button>
            )}
            <Button
              variant="danger"
              className="min-h-11 text-lg"
              onClick={() => setDeleteOpen(true)}
              iconLeft={<Trash size={16} aria-hidden="true" />}
            >
              Hapus
            </Button>
          </>
        }
      />

      {item.deletedAt && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-surface p-3 text-base text-warning"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Barang ini sudah dihapus. Anda bisa memulihkannya sebelum dihapus permanen.</span>
        </div>
      )}
      {item.archivedAt && !item.deletedAt && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-base text-foreground"
        >
          <Archive size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Barang ini sedang diarsipkan. Pulihkan untuk mengembalikannya ke daftar aktif.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Facts + last location */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Detail</CardTitle>
              {item.createdVia === "ASSISTANT" && (
                <Badge tone="info">
                  <Sparkles size={12} aria-hidden="true" />
                  Ditambahkan oleh asisten
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border text-base">
                <div className="flex gap-4 py-2">
                  <dt className="w-32 shrink-0 font-medium text-muted-foreground">Nama</dt>
                  <dd className="text-foreground">{item.name}</dd>
                </div>
                <div className="flex gap-4 py-2">
                  <dt className="w-32 shrink-0 font-medium text-muted-foreground">Kategori</dt>
                  <dd className="text-foreground">{item.category || "Tanpa kategori"}</dd>
                </div>
                <div className="flex gap-4 py-2">
                  <dt className="w-32 shrink-0 font-medium text-muted-foreground">Deskripsi</dt>
                  <dd className="text-foreground">{item.description || "—"}</dd>
                </div>
                <div className="flex gap-4 py-2">
                  <dt className="w-32 shrink-0 font-medium text-muted-foreground">Dibuat</dt>
                  <dd>
                    <time
                      dateTime={toDateTimeAttr(item.createdAt)}
                      title={formatDateTime(item.createdAt)}
                      className="text-foreground"
                    >
                      {formatDateTime(item.createdAt)}
                    </time>
                  </dd>
                </div>
                <div className="flex gap-4 py-2">
                  <dt className="w-32 shrink-0 font-medium text-muted-foreground">Terakhir diperbarui</dt>
                  <dd>
                    <time
                      dateTime={toDateTimeAttr(item.updatedAt)}
                      title={formatDateTime(item.updatedAt)}
                      className="text-foreground"
                    >
                      {formatRelativeTime(item.updatedAt)}
                    </time>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Di mana letaknya sekarang</CardTitle>
            </CardHeader>
            <CardContent>
              {item.lastLocation ? (
                <>
                  <p className="text-lg font-semibold text-foreground">{item.lastLocation.name}</p>
                  <p className="text-base text-muted-foreground">{item.lastLocation.path}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <Clock size={12} className="mr-1 inline" aria-hidden="true" />
                    <time
                      dateTime={toDateTimeAttr(item.lastLocation.occurredAt)}
                      title={formatDateTime(item.lastLocation.occurredAt)}
                    >
                      {formatRelativeTime(item.lastLocation.occurredAt)}
                    </time>
                  </p>
                  <p className="mt-3 text-sm italic text-muted-foreground">
                    Itulah lokasi terakhir yang tercatat — barangnya mungkin sudah dipindahkan sejak saat itu.
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-base text-muted-foreground">Belum pernah dicatat.</p>
                  <Button
                    className="min-h-11 text-lg"
                    onClick={() => setRecordOpen(true)}
                    iconLeft={<MapPin size={16} aria-hidden="true" />}
                  >
                    Catat di mana Anda meletakkannya
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Riwayat lokasi</CardTitle>
            <Button
              variant="ghost"
              className="min-h-11 text-lg"
              onClick={() => setRecordOpen(true)}
              iconLeft={<Plus size={14} aria-hidden="true" />}
            >
              Catat
            </Button>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-base text-muted-foreground">
              Riwayat tidak bisa diubah — untuk mengoreksi, catatlah entri baru.
            </p>
            {eventsState.loading && <TimelineSkeleton />}
            {!eventsState.loading && eventsState.error && (
              <ErrorState error={eventsState.error} onRetry={eventsState.reload} />
            )}
            {!eventsState.loading && !eventsState.error && events.length === 0 && (
              <EmptyState
                title="Belum ada lokasi tercatat"
                description="Barang tetap tersimpan tanpa lokasi — tambahkan ketika Anda tahu di mana letaknya."
                action={
                  <Button
                    className="min-h-11 text-lg"
                    onClick={() => setRecordOpen(true)}
                    iconLeft={<MapPin size={16} aria-hidden="true" />}
                  >
                    Catat lokasi
                  </Button>
                }
              />
            )}
            {!eventsState.loading && !eventsState.error && events.length > 0 && (
              <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} highlight={event.id === highlightEvent} />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <RecordLocationDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        item={item}
        onRecorded={onRecorded}
      />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Hapus barang ini?"
        description={`“${item.name}” akan dihapus dari catatan aktif Anda. Barang bisa dipulihkan selama 30 hari.`}
        footer={
          <>
            <Button variant="secondary" className="min-h-11 text-lg" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Batal
            </Button>
            <Button variant="danger" className="min-h-11 text-lg" loading={deleteBusy} onClick={() => void confirmDelete()}>
              Hapus
            </Button>
          </>
        }
      >
        {deleteError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-base text-destructive"
          >
            {deleteError}
          </p>
        )}
      </Dialog>
    </>
  );
}
