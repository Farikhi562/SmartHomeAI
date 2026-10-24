"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toApiError } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { LocationSelect, CREATE_LOCATION_VALUE } from "@/components/locations/LocationSelect";
import { itemCreateSchema, type ItemCreate } from "@/lib/validation";
import { cx } from "@/lib/cx";

/**
 * Create item (DESIGN_SPEC §1.8): name required, everything else optional.
 * Duplicate names are allowed but warned (FR-002.4) — the server answers 200
 * with a `DUPLICATE_NAME` warning that renders as a non-blocking banner with a
 * link to the existing item; saving is never prevented.
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px for the elderly audience.
 */

const linkButtonBase =
  "inline-flex min-h-11 items-center rounded-md px-4 text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function NewItemPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewItemForm />
    </Suspense>
  );
}

function FormSkeleton() {
  return (
    <>
      <PageHeader title="Barang baru" breadcrumbs={[{ label: "Barang", href: "/inventory" }, { label: "Barang baru" }]} />
      <div className="mx-auto max-w-[720px] rounded-lg border border-border bg-card p-6 shadow-subtle">
        <div className="flex flex-col gap-5">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" aria-hidden="true" />
          <div className="h-12 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" aria-hidden="true" />
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />
          <div className="h-12 w-40 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        </div>
      </div>
      <span role="status" className="sr-only">
        Memuat formulir…
      </span>
    </>
  );
}

function NewItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; itemId?: string } | null>(null);

  const prefillName = searchParams.get("name") ?? "";
  const prefillLocationId = searchParams.get("locationId") ?? "";

  const locationsState = useAsync(() => api.locations.list(), []);
  // Category suggestions come from stored categories only — never invented.
  const categoriesState = useAsync(() => api.items.list({ status: "all", limit: 100 }), []);

  const categorySuggestions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of categoriesState.data?.items ?? []) {
      if (item.category) seen.add(item.category);
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [categoriesState.data]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemCreate>({
    resolver: zodResolver(itemCreateSchema),
    defaultValues: { name: prefillName, locationId: prefillLocationId || undefined },
    shouldFocusError: true,
  });

  const locationValue = watch("locationId") ?? "";

  useEffect(() => {
    if (prefillLocationId) setValue("locationId", prefillLocationId);
  }, [prefillLocationId, setValue]);

  const onSubmit = async (values: ItemCreate) => {
    setFormError(null);
    setDuplicateWarning(null);
    try {
      const result = await api.items.create({
        name: values.name?.trim(),
        description: values.description?.trim() || undefined,
        category: values.category?.trim() || undefined,
        locationId:
          values.locationId && values.locationId !== CREATE_LOCATION_VALUE ? values.locationId : undefined,
      });

      const duplicate = result.warnings.find((w) => w.code === "DUPLICATE_NAME");
      if (duplicate) {
        setDuplicateWarning({
          message: duplicate.message,
          itemId: (duplicate as { itemId?: string }).itemId,
        });
      }

      toast({ title: "Barang ditambahkan", description: result.item.name, tone: "success" });
      router.push(`/inventory/${result.item.id}`);
      router.refresh();
    } catch (error) {
      const apiError = toApiError(error);
      const nameIssue = apiError.issueFor("name");
      if (apiError.code === "VALIDATION_ERROR" && nameIssue) {
        setError("name", { message: nameIssue });
        return;
      }
      if (apiError.code === "CONFLICT") {
        const items = apiError.numberExtra("referencedByItems");
        setFormError(
          items !== undefined
            ? `Lokasi tersebut masih dirujuk oleh ${items} barang. Pulihkan dulu lokasinya, atau pilih lokasi lain.`
            : apiError.message,
        );
        return;
      }
      setFormError(apiError.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Barang baru"
        subtitle="Beri nama barangnya, dan isi letaknya sekarang jika mau."
        breadcrumbs={[{ label: "Barang", href: "/inventory" }, { label: "Barang baru" }]}
      />

      {duplicateWarning && (
        <div
          role="status"
          className="mx-auto mb-4 flex max-w-[720px] items-start gap-2 rounded-md border border-warning/40 bg-warning-surface p-3 text-base text-warning"
        >
          <span className="min-w-0">
            {duplicateWarning.message}{" "}
            {duplicateWarning.itemId && (
              <Link
                href={`/inventory/${duplicateWarning.itemId}`}
                className="font-medium underline underline-offset-4"
              >
                Lihat barang yang sudah ada
              </Link>
            )}{" "}
            — Anda tetap bisa menyimpan barang ini.
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
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
          placeholder="Contoh: kunci motor"
          maxLength={120}
          error={errors.name?.message}
          aria-invalid={errors.name ? true : undefined}
          className="min-h-12 text-lg"
          {...register("name")}
        />

        <Textarea
          label="Deskripsi (opsional)"
          placeholder="Apa pun yang membantu Anda mengenalinya nanti."
          maxLength={2000}
          error={errors.description?.message}
          className="text-lg"
          {...register("description")}
        />

        <div>
          <Input
            label="Kategori (opsional)"
            placeholder="Contoh: perkakas"
            maxLength={60}
            hint="Tulis bebas dengan huruf kecil. Saran muncul dari kategori barang Anda yang sudah ada."
            list="category-suggestions"
            error={errors.category?.message}
            className="min-h-12 text-lg"
            {...register("category")}
          />
          <datalist id="category-suggestions">
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <LocationSelect
          locations={locationsState.data?.locations ?? []}
          value={locationValue}
          onChange={(value) => {
            setValue("locationId", value || undefined, { shouldDirty: true, shouldValidate: true });
            setFormError(null);
          }}
          label="Di mana letaknya sekarang? (opsional)"
          hint="Boleh dikosongkan — lokasi bisa dicatat nanti."
          placeholder="Belum ada lokasi"
          allowCreate
        />

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button type="submit" loading={isSubmitting} className="min-h-12 text-lg">
            Simpan barang
          </Button>
          <Link
            href="/inventory"
            className={cx(
              linkButtonBase,
              "border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
            )}
          >
            Batal
          </Link>
          {isSubmitting && <Spinner className="size-4 text-muted-foreground" aria-hidden="true" />}
        </div>
      </form>
    </>
  );
}
