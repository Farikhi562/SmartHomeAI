"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api, type EventDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { History, MapPin, Package, Pencil, Sparkles } from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime, toDateTimeAttr } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * Activity history (DESIGN_SPEC §1.12, FR-018): a cross-item chronological
 * feed over a fixed 30-day window. Every entry links the item and the location
 * it references; occurredAt and recordedAt are both shown because they can
 * differ (backdating). No invented trends or aggregations.
 */

const WINDOW_DAYS = 30;
const PAGE_SIZE = 20;

export default function ActivityPage() {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <ActivityView />
    </Suspense>
  );
}

function ActivitySkeleton() {
  return (
    <>
      <PageHeader title="Riwayat" />
      <SkeletonRows rows={8} />
      <span role="status" className="sr-only">
        Memuat riwayat…
      </span>
    </>
  );
}

function ActivityView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const state = useAsync(() => api.activity({ sinceDays: WINDOW_DAYS, limit: PAGE_SIZE, offset }), [offset]);

  const setOffset = (nextOffset: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextOffset === 0) params.delete("offset");
    else params.set("offset", String(nextOffset));
    const qs = params.toString();
    router.replace(qs ? `/activity?${qs}` : "/activity", { scroll: false });
  };

  const events = state.data?.events ?? [];
  const total = state.data?.pagination.total ?? 0;

  return (
    <>
      <PageHeader
        title="Riwayat"
        subtitle={`Semua yang dicatat dalam ${WINDOW_DAYS} hari terakhir, yang terbaru di urutan paling atas.`}
      />

      {state.error && <ErrorState error={state.error} onRetry={state.reload} className="mb-4" />}
      {state.loading && <SkeletonRows rows={8} />}

      {!state.loading && !state.error && events.length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<History size={32} />}
          title={`Belum ada catatan dalam ${WINDOW_DAYS} hari terakhir`}
          description="Saat Anda mencatat di mana Anda menaruh sesuatu, catatannya akan muncul di sini."
          action={
            <Link
              href="/inventory"
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-base font-medium text-primary-foreground hover:bg-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <Package size={18} aria-hidden="true" />
              Buka daftar barang
            </Link>
          }
        />
      )}

      {!state.loading && !state.error && events.length > 0 && (
        <>
          <p className="mb-3 text-dense text-muted-foreground" aria-live="polite">
            {total} catatan
          </p>
          <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
            {events.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </ol>
          <Pagination
            limit={PAGE_SIZE}
            offset={offset}
            total={total}
            onChange={setOffset}
            className="mt-6"
          />
        </>
      )}
    </>
  );
}

function ActivityRow({ event }: { event: EventDto }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[26px] top-1.5 size-3 rounded-full border-2 border-background bg-primary"
      />
      <div className="rounded-lg border border-border bg-card p-3 shadow-subtle">
        <div className="flex flex-wrap items-center gap-2">
          {event.item ? (
            <Link
              href={`/inventory/${event.item.id}#event-${event.id}`}
              className={cx(
                "inline-flex min-h-11 items-center text-dense font-semibold text-foreground underline-offset-4 hover:underline",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              )}
            >
              {event.item.name}
            </Link>
          ) : (
            <span className="text-dense font-semibold text-foreground">Sebuah barang</span>
          )}
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
          <span className="text-dense text-foreground">
            <MapPin size={12} className="mr-1 inline text-muted-foreground" />
            {event.location.path}
          </span>
          <Badge tone={event.source === "ASSISTANT" ? "info" : "muted"}>
            {event.source === "ASSISTANT" ? <Sparkles size={11} /> : <Pencil size={11} />}
            {event.source === "ASSISTANT" ? "Asisten" : "Manual"}
          </Badge>
          {event.confidence === "INFERRED" && <Badge tone="warning">Disimpulkan</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <time dateTime={toDateTimeAttr(event.occurredAt)} title={formatDateTime(event.occurredAt)}>
            Diletakkan {formatDateTime(event.occurredAt)}
          </time>
          {" · "}
          <time dateTime={toDateTimeAttr(event.recordedAt)} title={formatDateTime(event.recordedAt)}>
            dicatat {formatRelativeTime(event.recordedAt)}
          </time>
        </p>
        {event.note && <p className="mt-1 text-dense text-muted-foreground">{event.note}</p>}
      </div>
    </li>
  );
}
