"use client";

import { useEffect, useState } from "react";
import { api, toApiError, type EventDto, type ItemDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LocationSelect, CREATE_LOCATION_VALUE } from "@/components/locations/LocationSelect";

/**
 * Record-location dialog (DESIGN_SPEC §1.9 / §1.10): appends a new event to an
 * item's history (FR-004). Optional backdating (FR-004.4 — > +5 min in the
 * future is rejected) and an optional note. History is append-only: this never
 * edits past events (FR-011.2).
 */

const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function RecordLocationDialog({
  open,
  onClose,
  item,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  item: ItemDto | null;
  onRecorded?: (event: EventDto) => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locationsState = useAsync(() => api.locations.list(), [open]);

  useEffect(() => {
    if (open) {
      setLocationId("");
      setOccurredAt("");
      setNote("");
      setFieldError(null);
      setFormError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!item) return;
    setFormError(null);
    setFieldError(null);

    if (!locationId || locationId === CREATE_LOCATION_VALUE) {
      setFieldError("Pilih lokasi barang ini.");
      return;
    }

    let occurredAtIso: string | undefined;
    if (occurredAt) {
      const date = new Date(occurredAt);
      if (Number.isNaN(date.getTime())) {
        setFieldError("Masukkan tanggal dan waktu yang valid.");
        return;
      }
      if (date.getTime() > Date.now() + FUTURE_SKEW_MS) {
        setFieldError("Waktu pencatatan tidak boleh di masa depan.");
        return;
      }
      occurredAtIso = date.toISOString();
    }

    setBusy(true);
    try {
      const event = await api.items.recordEvent(item.id, {
        locationId,
        occurredAt: occurredAtIso,
        note: note.trim() || undefined,
      });
      onRecorded?.(event);
      onClose();
    } catch (error) {
      const apiError = toApiError(error);
      const issue = apiError.issueFor("occurredAt") ?? apiError.issueFor("locationId");
      if (apiError.code === "VALIDATION_ERROR" && issue) setFieldError(issue);
      else setFormError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Catat lokasi"
      description={
        item
          ? `Di mana Anda menaruh “${item.name}”? Ini menambah entri baru ke riwayatnya.`
          : "Di mana barang ini sekarang?"
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Catat
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive"
          >
            {formError}
          </p>
        )}

        <LocationSelect
          locations={locationsState.data?.locations ?? []}
          value={locationId}
          onChange={(value) => {
            setLocationId(value);
            setFieldError(null);
          }}
          label="Lokasi"
          hint="Pilih lokasi yang sudah ada, atau buat lokasi baru."
          error={fieldError && (!locationId || locationId === CREATE_LOCATION_VALUE) ? fieldError : null}
          allowCreate
        />

        <Input
          label="Kapan Anda menaruhnya? (opsional)"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => {
            setOccurredAt(event.target.value);
            setFieldError(null);
          }}
          hint="Kosongkan dulu bila tidak yakin. Anda boleh mengisi waktu lampau."
          error={
            fieldError && locationId && locationId !== CREATE_LOCATION_VALUE ? fieldError : null
          }
        />

        <Textarea
          label="Catatan (opsional)"
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          hint="Apa pun yang membantu Anda mengingat — mis. “rak atas, di belakang kotak”."
        />

        <p className="text-dense text-muted-foreground">
          Riwayat hanya-tambah — mencatat di sini tidak pernah mengubah entri sebelumnya.
        </p>
      </div>
    </Dialog>
  );
}
