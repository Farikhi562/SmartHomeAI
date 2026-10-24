"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toApiError, type ItemDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { Box } from "@/components/ui/icons";
import { itemUpdateSchema, type ItemUpdate } from "@/lib/validation";
import { cx } from "@/lib/cx";

/**
 * Edit item (DESIGN_SPEC §1.8): identity fields only — editing never touches
 * location events (FR-002.3), and the form says so in helper text. Breadcrumbs
 * are required on this route (§5.3).
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px for the elderly audience.
 */

const linkButtonBase =
  "inline-flex min-h-11 items-center rounded-md px-4 text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function EditItemPage() {
  const params = useParams<{ id: string }>();
  const itemId = params.id;

  const itemState = useAsync(() => api.items.get(itemId), [itemId]);

  if (itemState.loading) {
    return (
      <>
        <PageHeader
          title="Ubah barang"
          breadcrumbs={[
            { label: "Barang", href: "/inventory" },
            { label: "Barang", href: `/inventory/${itemId}` },
            { label: "Ubah" },
          ]}
        />
        <div className="mx-auto max-w-[720px] rounded-lg border border-border bg-card p-6 shadow-subtle">
          <div className="flex flex-col gap-5" aria-hidden="true">
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-2/3 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <span role="status" className="sr-only">
          Memuat barang…
        </span>
      </>
    );
  }

  if (itemState.error || !itemState.data) {
    const notFound = itemState.error?.code === "NOT_FOUND";
    return (
      <>
        <PageHeader
          title="Ubah barang"
          breadcrumbs={[
            { label: "Barang", href: "/inventory" },
            { label: "Ubah" },
          ]}
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
                className={`${linkButtonBase} bg-primary text-primary-foreground hover:bg-primary-hover`}
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

  return <EditForm item={itemState.data} />;
}

function EditForm({ item }: { item: ItemDto }) {
  const router = useRouter();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ItemUpdate>({
    resolver: zodResolver(itemUpdateSchema),
    defaultValues: {
      name: item.name,
      description: item.description ?? "",
      category: item.category ?? "",
    },
    shouldFocusError: true,
  });

  // Unsaved-changes guard (DESIGN_SPEC §1.8): confirm before a hard leave.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const submit = async (values: ItemUpdate) => {
    setFormError(null);
    try {
      await api.items.update(item.id, {
        name: values.name?.trim(),
        description: values.description?.trim() || null,
        category: values.category?.trim() || null,
      });
      toast({ title: "Perubahan disimpan", tone: "success" });
      router.push(`/inventory/${item.id}`);
      router.refresh();
    } catch (error) {
      const apiError = toApiError(error);
      const issue = apiError.issueFor("name");
      if (apiError.code === "VALIDATION_ERROR" && issue) setError("name", { message: issue });
      else setFormError(apiError.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Ubah barang"
        subtitle="Mengubah detail ini tidak mengubah riwayat lokasi Anda."
        breadcrumbs={[
          { label: "Barang", href: "/inventory" },
          { label: item.name, href: `/inventory/${item.id}` },
          { label: "Ubah" },
        ]}
      />

      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="mx-auto flex max-w-[720px] flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-subtle"
      >
        {formError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-base text-destructive"
          >
            {formError}
          </p>
        )}

        <Input
          label="Nama"
          maxLength={120}
          error={errors.name?.message}
          aria-invalid={errors.name ? true : undefined}
          className="min-h-12 text-lg"
          {...register("name")}
        />

        <Textarea
          label="Deskripsi (opsional)"
          maxLength={2000}
          hint="Apa pun yang membantu Anda mengenalinya nanti."
          error={errors.description?.message}
          className="text-lg"
          {...register("description")}
        />

        <Input
          label="Kategori (opsional)"
          maxLength={60}
          hint="Tulis bebas dengan huruf kecil."
          error={errors.category?.message}
          className="min-h-12 text-lg"
          {...register("category")}
        />

        <p className="text-base text-muted-foreground">
          Mengubah detail ini tidak mengubah riwayat lokasi — untuk mengoreksi riwayat, catatlah
          lokasi baru.
        </p>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting} className="min-h-12 text-lg">
            Simpan perubahan
          </Button>
          <Link
            href={`/inventory/${item.id}`}
            className={cx(
              linkButtonBase,
              "border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
            )}
          >
            Batal
          </Link>
          {!isDirty && (
            <p className="text-base text-muted-foreground">Belum ada perubahan.</p>
          )}
        </div>
      </form>
    </>
  );
}
