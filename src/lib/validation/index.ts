import { z } from "zod";

/**
 * Shared request/response validation schemas (single source of truth for route
 * handlers and forms — SYSTEM_ARCHITECTURE §5). Named exports keep imports stable.
 */

export const uuid = z.string().uuid();

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
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

// ── Items ───────────────────────────────────────────────────────────────────
export const itemName = z.string().trim().min(1).max(120);
export const itemCategory = z.string().trim().max(60);

export const itemCreateSchema = z.object({
  name: itemName,
  description: z.string().trim().max(2000).optional(),
  category: itemCategory.optional(),
  locationId: uuid.optional(),
});
export type ItemCreate = z.infer<typeof itemCreateSchema>;

export const itemUpdateSchema = z
  .object({
    name: itemName.optional(),
    // `null` clears the column (PATCH semantics); `undefined` leaves it untouched.
    description: z.string().trim().max(2000).nullish(),
    category: itemCategory.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "No fields to update." });
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;

export const itemListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  locationId: uuid.optional(),
  category: itemCategory.optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sort: z.enum(["name", "updatedAt", "lastRecordedAt"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ItemListQuery = z.infer<typeof itemListQuery>;

// ── Locations ───────────────────────────────────────────────────────────────
export const locationName = z.string().trim().min(1).max(80);

export const locationCreateSchema = z.object({
  name: locationName,
  description: z.string().trim().max(2000).optional(),
  parentId: uuid.nullish(),
});
export type LocationCreate = z.infer<typeof locationCreateSchema>;

export const locationUpdateSchema = z
  .object({
    name: locationName.optional(),
    // `null` clears the column; `undefined` leaves it untouched (PATCH semantics).
    description: z.string().trim().max(2000).nullish(),
    parentId: uuid.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "No fields to update." });
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

export const locationListQuery = z.object({
  includeArchived: boolParam(false),
});
export type LocationListQuery = z.infer<typeof locationListQuery>;

// ── Location events ─────────────────────────────────────────────────────────
export const eventCreateSchema = z.object({
  locationId: uuid,
  // Backdating allowed (FR-004); rejected beyond 5 min future skew (BR/event rule).
  occurredAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(300).optional(),
});
export type EventCreate = z.infer<typeof eventCreateSchema>;

// ── Search / activity ───────────────────────────────────────────────────────
export const searchQuery = paginationQuery.extend({
  q: z.string().trim().min(2).max(200),
  type: z.enum(["items", "locations", "all"]).default("all"),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const activityQuery = paginationQuery.extend({
  sinceDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type ActivityQuery = z.infer<typeof activityQuery>;

// ── Assistant ───────────────────────────────────────────────────────────────
export const assistantMessageSchema = z.object({
  conversationId: uuid.optional(),
  message: z.string().trim().min(1).max(2000),
});
export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;

export const actionDecisionSchema = z.object({
  decision: z.enum(["confirm", "cancel"]),
  overrides: z
    .object({
      locationId: uuid.optional(),
      occurredAt: z.string().datetime({ offset: true }).optional(),
    })
    .optional(),
});
export type ActionDecision = z.infer<typeof actionDecisionSchema>;

// ── Preferences / profile ───────────────────────────────────────────────────
export const preferencesUpdateSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  locale: z.string().trim().max(10).optional(),
  showSuggestedQuestions: z.boolean().optional(),
});
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

// ── Dev login ───────────────────────────────────────────────────────────────
export const devLoginSchema = z.object({
  email: z.string().trim().email().max(320),
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
