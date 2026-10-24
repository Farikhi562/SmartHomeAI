"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/Select";
import type { LocationDto } from "@/lib/validation";
import { truncate } from "@/lib/format";

/** Sentinel option value that opens the create-inline mini dialog. */
export const CREATE_LOCATION_VALUE = "__create_location__";

/**
 * Location picker (DESIGN_SPEC §1.8): a native select over the non-archived
 * hierarchy, labelled by full path and indented by depth. Radix `Combobox` is
 * out of scope (no Radix installed) — this keeps full keyboard semantics.
 */
export function LocationSelect({
  locations,
  value,
  onChange,
  label = "Lokasi",
  hint,
  error,
  includeArchived = false,
  allowCreate = false,
  placeholder = "Pilih lokasi",
  disabled = false,
  id,
}: {
  locations: LocationDto[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string | null;
  includeArchived?: boolean;
  allowCreate?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const options = useMemo(
    () =>
      [...locations]
        .filter((location) => includeArchived || !location.archivedAt)
        .sort((a, b) => a.path.localeCompare(b.path)),
    [locations, includeArchived],
  );

  return (
    <Select
      id={id}
      label={label}
      hint={hint}
      error={error}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((location) => (
        <option key={location.id} value={location.id}>
          {truncate(`${"\u00A0".repeat(location.depth * 2)}${location.path}`, 80)}
          {location.archivedAt ? " (diarsipkan)" : ""}
        </option>
      ))}
      {allowCreate && <option value={CREATE_LOCATION_VALUE}>＋ Buat lokasi baru…</option>}
    </Select>
  );
}
