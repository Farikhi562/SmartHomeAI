import { z } from "zod";

/**
 * Shared request/response validation schemas (single source of truth for route
 * handlers and forms — SYSTEM_ARCHITECTURE §5). Named exports keep imports stable.
 */

// Semua pesan di bawah adalah teks yang dilihat user (Bahasa Indonesia).
// Bentuk schema, aturan, dan kode error tidak berubah.
export const uuid = z.string().uuid("ID tidak valid.");

/**
 * Query-string boolean: `?flag=true|1|yes` → true; `false|0|no|absent` → false.
 * (z.coerce.boolean() would treat the STRING "false" as true — classic trap.)
 */
export const boolParam = (defaultValue = false) =>
  z.preprocess(
    (v) =>
      v === undefined || v === null || v === ""
        ? defaultValue
        : v === true || v === false
          ? v
          : ["true", "1", "yes"].includes(String(v).toLowerCase()),
    z.boolean(),
  );

// ── Pagination ──────────────────────────────────────────────────────────────
export const paginationQuery = z.object({
  limit: z.coerce
    .number({ message: "Harus berupa angka." })
    .int("Harus berupa bilangan bulat.")
    .min(1, "Minimal 1.")
    .max(100, "Maksimal 100.")
    .default(20),
  offset: z.coerce
    .number({ message: "Harus berupa angka." })
    .int("Harus berupa bilangan bulat.")
    .min(0, "Tidak boleh negatif.")
    .default(0),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

// ── Items ───────────────────────────────────────────────────────────────────
export const itemName = z
  .string()
  .trim()
  .min(1, "Nama barang wajib diisi.")
  .max(120, "Nama barang maksimal 120 karakter.");
export const itemCategory = z.string().trim().max(60, "Kategori maksimal 60 karakter.");

export const itemCreateSchema = z.object({
  name: itemName,
  description: z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter.").optional(),
  category: itemCategory.optional(),
  locationId: uuid.optional(),
});
export type ItemCreate = z.infer<typeof itemCreateSchema>;

export const itemUpdateSchema = z
  .object({
    name: itemName.optional(),
    // `null` clears the column (PATCH semantics); `undefined` leaves it untouched.
    description: z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter.").nullish(),
    category: itemCategory.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Tidak ada kolom yang diperbarui.",
  });
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;

export const itemListQuery = paginationQuery.extend({
  q: z.string().trim().max(200, "Kata kunci maksimal 200 karakter.").optional(),
  locationId: uuid.optional(),
  category: itemCategory.optional(),
  status: z.enum(["active", "archived", "all"], { message: "Status tidak valid." }).default("active"),
  sort: z
    .enum(["name", "updatedAt", "lastRecordedAt"], { message: "Pilihan pengurutan tidak valid." })
    .default("updatedAt"),
  order: z.enum(["asc", "desc"], { message: "Arah pengurutan tidak valid." }).default("desc"),
});
export type ItemListQuery = z.infer<typeof itemListQuery>;

// ── Locations ───────────────────────────────────────────────────────────────
export const locationName = z
  .string()
  .trim()
  .min(1, "Nama lokasi wajib diisi.")
  .max(80, "Nama lokasi maksimal 80 karakter.");

export const locationCreateSchema = z.object({
  name: locationName,
  description: z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter.").optional(),
  parentId: uuid.nullish(),
});
export type LocationCreate = z.infer<typeof locationCreateSchema>;

export const locationUpdateSchema = z
  .object({
    name: locationName.optional(),
    // `null` clears the column; `undefined` leaves it untouched (PATCH semantics).
    description: z.string().trim().max(2000, "Deskripsi maksimal 2000 karakter.").nullish(),
    parentId: uuid.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Tidak ada kolom yang diperbarui.",
  });
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

export const locationListQuery = z.object({
  includeArchived: boolParam(false),
});
export type LocationListQuery = z.infer<typeof locationListQuery>;

// ── Location events ─────────────────────────────────────────────────────────
export const eventCreateSchema = z.object({
  locationId: uuid,
  // Backdating allowed (FR-004); rejected beyond 5 min future skew (BR/event rule).
  occurredAt: z
    .string()
    .datetime({ offset: true, message: "Waktu tidak valid." })
    .optional(),
  note: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
});
export type EventCreate = z.infer<typeof eventCreateSchema>;

// ── Search / activity ───────────────────────────────────────────────────────
export const searchQuery = paginationQuery.extend({
  q: z
    .string()
    .trim()
    .min(2, "Masukkan minimal 2 karakter.")
    .max(200, "Kata kunci maksimal 200 karakter."),
  type: z
    .enum(["items", "locations", "all"], { message: "Jenis pencarian tidak valid." })
    .default("all"),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const activityQuery = paginationQuery.extend({
  sinceDays: z.coerce
    .number({ message: "Harus berupa angka." })
    .int("Harus berupa bilangan bulat.")
    .min(1, "Minimal 1 hari.")
    .max(365, "Maksimal 365 hari.")
    .default(30),
});
export type ActivityQuery = z.infer<typeof activityQuery>;

// ── Assistant ───────────────────────────────────────────────────────────────
export const assistantMessageSchema = z.object({
  conversationId: uuid.optional(),
  message: z
    .string()
    .trim()
    .min(1, "Pesan wajib diisi.")
    .max(2000, "Pesan maksimal 2000 karakter."),
});
export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;

export const actionDecisionSchema = z.object({
  decision: z.enum(["confirm", "cancel"], { message: "Keputusan tidak valid." }),
  overrides: z
    .object({
      locationId: uuid.optional(),
      occurredAt: z
        .string()
        .datetime({ offset: true, message: "Waktu tidak valid." })
        .optional(),
    })
    .optional(),
});
export type ActionDecision = z.infer<typeof actionDecisionSchema>;

// ── Preferences / profile ───────────────────────────────────────────────────
export const preferencesUpdateSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"], { message: "Tema tidak valid." }).optional(),
  locale: z.string().trim().max(10, "Kode bahasa tidak valid.").optional(),
  showSuggestedQuestions: z.boolean().optional(),
});
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Nama tampilan wajib diisi.")
    .max(120, "Nama tampilan maksimal 120 karakter.")
    .optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

// ── Dev login ───────────────────────────────────────────────────────────────
export const devLoginSchema = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid.").max(320),
});

// ── Result DTO types (mirror API_SPEC §3) ───────────────────────────────────
export type LastLocationDto = {
  locationId: string;
  name: string;
  path: string;
  occurredAt: string;
} | null;

export type ItemDto = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  createdVia: "USER" | "ASSISTANT";
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLocation: LastLocationDto;
};

export type EventDto = {
  id: string;
  item?: { id: string; name: string };
  location: { id: string; name: string; path: string };
  occurredAt: string;
  recordedAt: string;
  source: "MANUAL" | "ASSISTANT";
  confidence: "CONFIRMED" | "INFERRED";
  note: string | null;
};

export type LocationDto = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  depth: number;
  path: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
