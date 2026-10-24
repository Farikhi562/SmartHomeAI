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
 */

const linkButtonBase =
  "inline-flex h-9 items-center rounded-md px-4 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function EditItemPage() {
  const params = useParams<{ id: string }>();
  const itemId = params.id;

  const itemState = useAsync(() => api.items.get(itemId), [itemId]);

  if (itemState.loading) {
    return (
      <>
        <PageHeader
          title="Edit item"
          breadcrumbs={[
            { label: "Inventory", href: "/inventory" },
            { label: "Item", href: `/inventory/${itemId}` },
            { label: "Edit" },
          ]}
        />
        <div className="mx-auto max-w-[720px] rounded-lg border border-border bg-card p-6 shadow-subtle">
          <div className="flex flex-col gap-5" aria-hidden="true">
            <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <span role="status" className="sr-only">
          Loading item
        </span>
      </>
    );
  }

  if (itemState.error || !itemState.data) {
    const notFound = itemState.error?.code === "NOT_FOUND";
    return (
      <>
        <PageHeader
          title="Edit item"
          breadcrumbs={[
            { label: "Inventory", href: "/inventory" },
            { label: "Edit" },
          ]}
        />
        {notFound ? (
          <EmptyState
            headingLevel={2}
            icon={<Box size={32} />}
            title="We can't find that item"
            description="It may have been deleted, or it isn't yours."
            action={
              <Link
                href="/inventory"
                className={`${linkButtonBase} bg-primary text-primary-foreground hover:bg-primary-hover`}
              >
                Back to inventory
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
      toast({ title: "Item updated", tone: "success" });
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
        title="Edit item"
        subtitle="Editing details never changes your location history."
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: item.name, href: `/inventory/${item.id}` },
          { label: "Edit" },
        ]}
      />

      <form
        onSubmit={handleSubmit(submit)}
        noValidate
        className="mx-auto max-w-[720px] rounded-lg border border-border bg-card p-6 shadow-subtle"
      >
        {formError && (
          <p
            role="alert"
            className="mb-5 rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive"
          >
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            maxLength={120}
            error={errors.name?.message}
            aria-invalid={errors.name ? true : undefined}
            {...register("name")}
          />

          <Textarea
            label="Description (optional)"
            maxLength={2000}
            hint="Anything that helps you identify it."
            error={errors.description?.message}
            {...register("description")}
          />

          <Input
            label="Category (optional)"
            maxLength={60}
            hint="Lowercase free text."
            error={errors.category?.message}
            {...register("category")}
          />

          <p className="text-xs text-muted-foreground">
            Editing details never changes your location history — corrections there happen by
            recording a new entry.
          </p>

          <div className="flex items-center gap-2 border-t border-border pt-5">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting}>
              Save changes
            </Button>
            <Link
              href={`/inventory/${item.id}`}
              className={cx(
                linkButtonBase,
                "border border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
              )}
            >
              Cancel
            </Link>
            {!isDirty && (
              <p className="text-xs text-muted-foreground">Nothing changed yet.</p>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
