"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toApiError, type LocationDto, type LocationUpdate } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Archive, ChevronRight, MapPin, Pencil, Plus, Trash } from "@/components/ui/icons";
import { locationCreateSchema, locationUpdateSchema, type LocationCreate } from "@/lib/validation";
import { cx } from "@/lib/cx";

/**
 * Location management (DESIGN_SPEC §1.9): tree on the left, detail on the
 * right, deep-linkable via `?locationId=`. Hierarchy is capped at depth 3
 * (BR-04); archive is blocked while items/events reference the location and the
 * 409 body supplies the exact counts (BR-05, FR-017.2).
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px for the elderly audience.
 */

const MAX_DEPTH = 3;

type TreeNode = {
  location: LocationDto;
  children: TreeNode[];
  depth: number;
};

function buildTree(locations: LocationDto[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const location of locations) {
    byId.set(location.id, { location, children: [], depth: 0 });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.location.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const assignDepth = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots, 1);
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.location.name.localeCompare(b.location.name));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}

export default function LocationsPage() {
  return (
    <Suspense fallback={<LocationsSkeleton />}>
      <LocationsView />
    </Suspense>
  );
}

function LocationsSkeleton() {
  return (
    <>
      <PageHeader title="Lokasi" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
      <span role="status" className="sr-only">
        Memuat lokasi…
      </span>
    </>
  );
}

function LocationsView() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("locationId");

  const [includeArchived, setIncludeArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LocationDto | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<LocationDto | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LocationDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expandAll, setExpandAll] = useState(true);

  const locationsState = useAsync(() => api.locations.list({ includeArchived }), [includeArchived]);

  // Memoized so the tree below doesn't rebuild on every render while loading
  // (a fresh `?? []` would produce a new array identity each time).
  const locations = useMemo(
    () => locationsState.data?.locations ?? [],
    [locationsState.data],
  );
  const selected = locations.find((location) => location.id === selectedId) ?? null;

  const tree = useMemo(() => buildTree(locations), [locations]);

  // Items last recorded at the selected location — derived from stored events.
  const itemsState = useAsync(
    () => (selectedId ? api.items.list({ locationId: selectedId, status: "active", limit: 20 }) : Promise.resolve(null)),
    [selectedId],
  );

  const select = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("locationId", id);
    else params.delete("locationId");
    const qs = params.toString();
    router.replace(qs ? `/locations?${qs}` : "/locations", { scroll: false });
  };

  const doArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await api.locations.archive(archiveTarget.id);
      setArchiveTarget(null);
      locationsState.reload();
      toast({ title: "Lokasi diarsipkan", tone: "success" });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "CONFLICT") {
        const items = apiError.numberExtra("referencedByItems") ?? 0;
        const events = apiError.numberExtra("referencedByEvents") ?? 0;
        setArchiveError(
          `Lokasi ini masih dirujuk oleh ${items} barang dan ${events} catatan. Perbarui catatan tersebut terlebih dahulu, atau arsipkan barangnya.`,
        );
        return;
      }
      setArchiveError(apiError.message);
    } finally {
      setArchiveBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.locations.remove(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) select(null);
      locationsState.reload();
      toast({ title: "Lokasi dihapus", tone: "success" });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "CONFLICT") {
        const items = apiError.numberExtra("referencedByItems") ?? 0;
        const events = apiError.numberExtra("referencedByEvents") ?? 0;
        setDeleteError(
          `Lokasi ini masih dirujuk oleh ${items} barang dan ${events} catatan.`,
        );
        return;
      }
      setDeleteError(apiError.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Lokasi"
        subtitle="Struktur sederhana — paling dalam tiga tingkat."
        actions={
          <Button className="min-h-11 text-lg" onClick={() => setCreateOpen(true)} iconLeft={<Plus size={16} aria-hidden="true" />}>
            Lokasi baru
          </Button>
        }
      />

      {locationsState.error && (
        <ErrorState error={locationsState.error} onRetry={locationsState.reload} className="mb-4" />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Tree pane */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Semua lokasi</CardTitle>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base text-foreground">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                className="size-5 rounded border-input"
              />
              Tampilkan yang diarsipkan
            </label>
          </CardHeader>
          <CardContent>
            {locationsState.loading && (
              <div className="flex flex-col gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            )}

            {!locationsState.loading && locations.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-base text-foreground">Belum ada lokasi.</p>
                <p className="text-base text-muted-foreground">Beberapa contoh untuk memulai:</p>
                <ul className="flex flex-col gap-1 text-base text-muted-foreground">
                  <li>· Rumah › Laci kamar tidur</li>
                  <li>· Rumah › Rak garasi</li>
                  <li>· Kantor › Meja kerja</li>
                </ul>
                <Button
                  className="min-h-11 self-start text-lg"
                  onClick={() => setCreateOpen(true)}
                  iconLeft={<Plus size={14} aria-hidden="true" />}
                >
                  Tambah lokasi pertama
                </Button>
              </div>
            )}

            {!locationsState.loading && locations.length > 0 && (
              <>
                <ul className="flex flex-col" role="tree" aria-label="Daftar lokasi">
                  {tree.map((node) => (
                    <TreeRow
                      key={node.location.id}
                      node={node}
                      selectedId={selectedId}
                      onSelect={select}
                      expanded={expandAll}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setExpandAll((value) => !value)}
                  className={cx(
                    "mt-3 min-h-11 text-base font-medium text-primary underline-offset-4 hover:underline",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                  )}
                >
                  {expandAll ? "Tutup semua" : "Buka semua"}
                </button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail pane */}
        <Card>
          {selected ? (
            <>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>{selected.name}</CardTitle>
                  <p className="mt-0.5 truncate text-base text-muted-foreground">{selected.path}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.archivedAt && (
                    <Badge tone="muted">
                      <Archive size={12} aria-hidden="true" />
                      Diarsipkan
                    </Badge>
                  )}
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => setEditTarget(selected)}
                    iconLeft={<Pencil size={14} aria-hidden="true" />}
                  >
                    Ubah
                  </Button>
                  {selected.archivedAt ? null : (
                    <Button
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => {
                        setArchiveError(null);
                        setArchiveTarget(selected);
                      }}
                      iconLeft={<Archive size={14} aria-hidden="true" />}
                    >
                      Arsipkan
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="min-h-11"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(selected);
                    }}
                    iconLeft={<Trash size={14} aria-hidden="true" />}
                  >
                    Hapus
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {selected.description && (
                  <p className="text-base text-foreground">{selected.description}</p>
                )}

                <section aria-labelledby="items-here-heading">
                  <h3 id="items-here-heading" className="mb-2 text-base font-semibold text-foreground">
                    Barang yang terakhir dicatat di sini
                  </h3>
                  {itemsState.loading && <Skeleton className="h-20 w-full" />}
                  {!itemsState.loading && itemsState.error && (
                    <ErrorState error={itemsState.error} onRetry={itemsState.reload} />
                  )}
                  {!itemsState.loading && !itemsState.error && itemsState.data && itemsState.data.items.length === 0 && (
                    <p className="text-base text-muted-foreground">Belum ada yang dicatat di sini.</p>
                  )}
                  {!itemsState.loading && !itemsState.error && itemsState.data && itemsState.data.items.length > 0 && (
                    <ul className="divide-y divide-border">
                      {itemsState.data.items.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/inventory/${item.id}`}
                            className={cx(
                              "flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-2 text-base hover:bg-muted/50",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            )}
                          >
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.lastLocation && (
                              <span className="text-sm text-muted-foreground">
                                {item.lastLocation.name}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </CardContent>
            </>
          ) : (
            <CardContent>
              <EmptyState
                icon={<MapPin size={32} />}
                title="Pilih sebuah lokasi"
                description="Pilih lokasi pada daftar untuk melihat detailnya dan barang yang terakhir dicatat di sini."
              />
            </CardContent>
          )}
        </Card>
      </div>

      <LocationFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        locations={locations}
        parent={selected}
        onSaved={(created) => {
          locationsState.reload();
          select(created.id);
          toast({ title: "Lokasi ditambahkan", description: created.path, tone: "success" });
        }}
      />

      <LocationEditDialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        location={editTarget}
        locations={locations}
        onSaved={(updated) => {
          locationsState.reload();
          select(updated.id);
          toast({ title: "Lokasi diperbarui", tone: "success" });
        }}
      />

      <Dialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Arsipkan lokasi ini?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” akan disembunyikan dari pilihan. Catatan lama tetap tersimpan.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" className="min-h-11 text-lg" onClick={() => setArchiveTarget(null)} disabled={archiveBusy}>
              Batal
            </Button>
            <Button className="min-h-11 text-lg" loading={archiveBusy} onClick={() => void doArchive()}>
              Arsipkan
            </Button>
          </>
        }
      >
        {archiveError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-base text-destructive">
            {archiveError}
          </p>
        )}
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Hapus lokasi ini?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" className="min-h-11 text-lg" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Batal
            </Button>
            <Button variant="danger" className="min-h-11 text-lg" loading={deleteBusy} onClick={() => void doDelete()}>
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

function TreeRow({
  node,
  selectedId,
  onSelect,
  expanded,
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expanded: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isSelected = node.location.id === selectedId;

  return (
    <li role="treeitem" aria-selected={isSelected} aria-expanded={hasChildren ? expanded : undefined}>
      <button
        type="button"
        onClick={() => onSelect(node.location.id)}
        className={cx(
          "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-base",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted/60",
        )}
        style={{ paddingLeft: `${8 + (node.depth - 1) * 16}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            size={14}
            className={cx("shrink-0 transition-transform", expanded && "rotate-90")}
            aria-hidden="true"
          />
        ) : (
          <span className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <MapPin size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{node.location.name}</span>
        {node.location.archivedAt && (
          <Badge tone="muted" className="ml-1">
            <Archive size={10} aria-hidden="true" />
            Diarsipkan
          </Badge>
        )}
      </button>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeRow key={child.location.id} node={child} selectedId={selectedId} onSelect={onSelect} expanded={expanded} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Create dialog — supports a pre-selected parent (depth re-validated, BR-04). */
function LocationFormDialog({
  open,
  onClose,
  locations,
  parent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  locations: LocationDto[];
  parent: LocationDto | null;
  onSaved: (location: LocationDto) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LocationCreate>({
    resolver: zodResolver(locationCreateSchema),
    defaultValues: { name: "", parentId: parent?.id ?? null },
    shouldFocusError: true,
  });

  useEffect(() => {
    if (open) {
      reset({ name: "", description: "", parentId: parent?.id ?? null });
      setFormError(null);
    }
  }, [open, parent, reset]);

  const parentValue = watch("parentId") ?? "";

  // Only parents that keep the child within the depth cap are offered.
  const parentOptions = useMemo(
    () => locations.filter((location) => !location.archivedAt && location.depth < MAX_DEPTH),
    [locations],
  );

  const submit = async (values: LocationCreate) => {
    setFormError(null);
    try {
      const created = await api.locations.create({
        name: values.name?.trim(),
        description: values.description?.trim() || undefined,
        parentId: values.parentId || null,
      });
      onSaved(created);
      onClose();
    } catch (error) {
      const apiError = toApiError(error);
      const nameIssue = apiError.issueFor("name");
      if (apiError.code === "VALIDATION_ERROR" && nameIssue) {
        setError("name", { message: nameIssue });
        return;
      }
      if (apiError.code === "CONFLICT") {
        setError("name", { message: "Nama itu sudah dipakai pada tingkat ini." });
        return;
      }
      setFormError(apiError.message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Lokasi baru"
      description={
        parent
          ? `Dibuat di bawah “${parent.path}”. Lokasi bisa bersarang paling dalam ${MAX_DEPTH} tingkat.`
          : `Lokasi bisa bersarang paling dalam ${MAX_DEPTH} tingkat.`
      }
      footer={
        <>
          <Button variant="secondary" className="min-h-11 text-lg" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="create-location-form" className="min-h-11 text-lg" loading={isSubmitting}>
            Tambah
          </Button>
        </>
      }
    >
      <form id="create-location-form" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-base text-destructive">
            {formError}
          </p>
        )}
        <Input
          label="Nama"
          placeholder="Contoh: Rak garasi"
          maxLength={80}
          error={errors.name?.message}
          aria-invalid={errors.name ? true : undefined}
          className="min-h-12 text-lg"
          {...register("name")}
        />
        <Input
          label="Deskripsi (opsional)"
          maxLength={2000}
          className="min-h-12 text-lg"
          {...register("description")}
        />
        <div>
          <label htmlFor="create-location-parent" className="text-base font-medium text-foreground">
            Lokasi induk (opsional)
          </label>
          <select
            id="create-location-parent"
            value={parentValue}
            onChange={(event) => setValue("parentId", event.target.value || null, { shouldDirty: true })}
            className={cx(
              "mt-1.5 min-h-12 w-full appearance-none rounded-md border border-input bg-card px-3 text-lg text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <option value="">Tingkat teratas (tanpa induk)</option>
            {parentOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.path}
              </option>
            ))}
          </select>
          <p className="mt-1 text-base text-muted-foreground">
            Hanya lokasi induk yang tetap membuat lokasi ini berada dalam {MAX_DEPTH} tingkat.
          </p>
        </div>
      </form>
    </Dialog>
  );
}

/** Edit dialog — rename / re-parent (re-validates depth server-side). */
function LocationEditDialog({
  open,
  onClose,
  location,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  location: LocationDto | null;
  locations: LocationDto[];
  onSaved: (location: LocationDto) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LocationUpdate>({
    resolver: zodResolver(locationUpdateSchema),
    shouldFocusError: true,
  });

  useEffect(() => {
    if (open && location) {
      reset({ name: location.name, description: location.description ?? "", parentId: location.parentId });
      setFormError(null);
    }
  }, [open, location, reset]);

  const parentValue = watch("parentId") ?? "";

  // Exclude the location itself and its own subtree from the parent list (no cycles).
  const excluded = useMemo(() => {
    if (!location) return new Set<string>();
    const ids = new Set<string>([location.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of locations) {
        if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
          ids.add(candidate.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [location, locations]);

  const parentOptions = useMemo(
    () =>
      locations.filter(
        (candidate) => !candidate.archivedAt && !excluded.has(candidate.id) && candidate.depth < MAX_DEPTH,
      ),
    [locations, excluded],
  );

  const submit = async (values: LocationUpdate) => {
    if (!location) return;
    setFormError(null);
    try {
      const updated = await api.locations.update(location.id, {
        name: values.name?.trim(),
        description: values.description?.trim() || null,
        parentId: values.parentId ?? null,
      });
      onSaved(updated);
      onClose();
    } catch (error) {
      const apiError = toApiError(error);
      const nameIssue = apiError.issueFor("name");
      if (apiError.code === "VALIDATION_ERROR" && nameIssue) {
        setError("name", { message: nameIssue });
        return;
      }
      if (apiError.code === "CONFLICT") {
        setError("name", { message: "Nama itu sudah dipakai pada tingkat ini." });
        return;
      }
      setFormError(apiError.message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ubah lokasi"
      description="Mengganti nama tidak mengubah catatan lama — catatan tetap menyimpan jalur seperti saat dicatat."
      footer={
        <>
          <Button variant="secondary" className="min-h-11 text-lg" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form="edit-location-form" className="min-h-11 text-lg" loading={isSubmitting}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="edit-location-form" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-base text-destructive">
            {formError}
          </p>
        )}
        <Input
          label="Nama"
          maxLength={80}
          error={errors.name?.message}
          aria-invalid={errors.name ? true : undefined}
          className="min-h-12 text-lg"
          {...register("name")}
        />
        <Input
          label="Deskripsi (opsional)"
          maxLength={2000}
          className="min-h-12 text-lg"
          {...register("description")}
        />
        <div>
          <label htmlFor="edit-location-parent" className="text-base font-medium text-foreground">
            Lokasi induk (opsional)
          </label>
          <select
            id="edit-location-parent"
            value={parentValue ?? ""}
            onChange={(event) => setValue("parentId", event.target.value || null, { shouldDirty: true })}
            className={cx(
              "mt-1.5 min-h-12 w-full appearance-none rounded-md border border-input bg-card px-3 text-lg text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <option value="">Tingkat teratas (tanpa induk)</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.path}
              </option>
            ))}
          </select>
          <p className="mt-1 text-base text-muted-foreground">
            Lokasi ini dan lokasi di bawahnya tidak boleh menjadi induknya sendiri.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
