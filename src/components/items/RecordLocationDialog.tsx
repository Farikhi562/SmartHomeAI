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
      setFieldError("Choose where the item is now.");
      return;
    }

    let occurredAtIso: string | undefined;
    if (occurredAt) {
      const date = new Date(occurredAt);
      if (Number.isNaN(date.getTime())) {
        setFieldError("Enter a valid date and time.");
        return;
      }
      if (date.getTime() > Date.now() + FUTURE_SKEW_MS) {
        setFieldError("The recorded time can't be in the future.");
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
      title="Record location"
      description={
        item
          ? `Where did you put “${item.name}”? This adds a new entry to its history.`
          : "Where is the item now?"
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Record
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
          label="Location"
          hint="Pick an existing location, or create a new one."
          error={fieldError && (!locationId || locationId === CREATE_LOCATION_VALUE) ? fieldError : null}
          allowCreate
        />

        <Input
          label="When did you place it? (optional)"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => {
            setOccurredAt(event.target.value);
            setFieldError(null);
          }}
          hint="Leave blank for now. You can backdate if you remember the time."
          error={
            fieldError && locationId && locationId !== CREATE_LOCATION_VALUE ? fieldError : null
          }
        />

        <Textarea
          label="Note (optional)"
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          hint="Anything that helps you remember — e.g. “top shelf, behind the boxes”."
        />

        <p className="text-xs text-muted-foreground">
          History is append-only — recording here never changes earlier entries.
        </p>
      </div>
    </Dialog>
  );
}
