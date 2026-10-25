import type { ApiErrorCode } from "@/lib/errors";
import type {
  ActionDecision,
  ActivityQuery,
  AssistantMessageInput,
  EventCreate,
  EventDto,
  ItemCreate,
  ItemDto,
  ItemListQuery,
  ItemUpdate,
  LastLocationDto,
  LocationCreate,
  LocationDto,
  LocationUpdate,
  PreferencesUpdate,
  ProfileUpdate,
  SearchQuery,
} from "@/lib/validation";

// Re-exported so pages import their DTOs from the client module in one place
// (`import type { ItemDto } from "@/client/api"`), matching the API contract.
export type {
  ActionDecision,
  ActivityQuery,
  AssistantMessageInput,
  EventCreate,
  EventDto,
  ItemCreate,
  ItemDto,
  ItemListQuery,
  ItemUpdate,
  LastLocationDto,
  LocationCreate,
  LocationDto,
  LocationUpdate,
  PreferencesUpdate,
  ProfileUpdate,
  SearchQuery,
} from "@/lib/validation";

/**
 * Typed HTTP client — THE ONLY place raw `fetch("/api/…")` lives (FR-012: every
 * call funnels through this enforcement point; handlers own authorization).
 *
 * Conventions (docs/architecture/API_SPEC.md):
 *  - cookie session via `credentials: "include"`
 *  - error envelope `{ error: { code, message, details?, requestId } }` → `ApiError`
 *  - pagination `{ limit, offset, total }`
 *  - 401 on a GET (page load) redirects to `/login?next=…`; mutations rethrow so
 *    the calling page can surface the error inline instead of navigating away
 *    from unsaved input (DESIGN_SPEC §0.4).
 */

// ── Shared response shapes ────────────────────────────────────────────────

export type Pagination = { limit: number; offset: number; total: number };
export type ApiErrorDetail = { path: string; issue: string };

export type HealthDto = { status: string; version: string; db: "up" | "down" };
export type MeDto = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  deletedAt: string | null;
};
export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type AuthConfigDto = { mode: "dev" | "supabase"; signupEnabled: boolean };
export type PreferencesDto = {
  theme: ThemePreference;
  locale: string | null;
  showSuggestedQuestions: boolean;
};

export type ItemsListResponse = { items: ItemDto[]; pagination: Pagination };
export type LocationsListResponse = { locations: LocationDto[]; pagination?: Pagination };
export type EventsListResponse = { events: EventDto[]; pagination: Pagination };

export type ItemWarning = { code: string; message: string };
export type ItemCreateResponse = { item: ItemDto; warnings: ItemWarning[] };

export type SearchMatchType = "exact" | "prefix" | "fuzzy" | "fulltext";
export type SearchItemDto = {
  id: string;
  name: string;
  category: string | null;
  score: number;
  matchType: SearchMatchType;
  lastLocation: LastLocationDto;
};
export type SearchLocationDto = {
  id: string;
  name: string;
  path: string;
  depth?: number;
  score?: number;
  matchType?: SearchMatchType;
  archivedAt?: string | null;
};
export type SearchResponse = {
  items: SearchItemDto[];
  locations: SearchLocationDto[];
  pagination: Pagination;
};
export type ActivityResponse = { events: EventDto[]; pagination: Pagination };

/** FR-022 file download: the raw export payload as a Blob plus its save-as name. */
export type ExportFile = { blob: Blob; filename: string };

export type MessageRole = "USER" | "ASSISTANT";
export type ReplyStatus = "COMPLETE" | "PENDING_ACTION" | "FALLBACK" | "ERROR";

export type CitationDto = {
  type: "item" | "event" | "location";
  id: string;
  label?: string | null;
  occurredAt?: string | null;
};
export type CandidateDto = { id?: string; name: string; reason?: string | null };
export type PendingActionPayload = {
  item?: { existingId?: string; name?: string };
  location?: { existingId?: string; name?: string; path?: string };
  occurredAt?: string;
  note?: string | null;
};
export type PendingActionDto = {
  id: string;
  type: "record_location" | "create_item" | "correct_location";
  payload: PendingActionPayload;
  expiresAt: string;
  consumedAt?: string | null;
};
export type ReplyDto = {
  id: string;
  role: MessageRole;
  text: string;
  intent?: string | null;
  status: ReplyStatus;
  citations: CitationDto[];
  candidates: CandidateDto[];
  pendingAction: PendingActionDto | null;
};
export type AssistantMessageDto = { id: string; role: MessageRole; content: string; createdAt?: string };
export type AssistantReplyDto = {
  conversationId: string;
  message: AssistantMessageDto;
  reply: ReplyDto;
  meta?: { fallbackUsed?: boolean; latencyMs?: number; model?: string };
};
export type ConversationDto = {
  id: string;
  title?: string | null;
  lastMessageAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
export type StoredMessageDto = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
  intent?: string | null;
  status?: ReplyStatus | null;
  citations?: CitationDto[] | null;
  candidates?: CandidateDto[] | null;
  pendingAction?: PendingActionDto | null;
};
export type ConversationsListResponse = { conversations: ConversationDto[]; pagination?: Pagination };
export type MessagesListResponse = { messages: StoredMessageDto[]; pagination?: Pagination };
export type DecisionResponseDto = {
  status?: string;
  pendingAction?: PendingActionDto | null;
  event?: EventDto | null;
  item?: ItemDto | null;
};

/** 503 AI_UNAVAILABLE carries deterministic fallback results (FR-013). */
export type FallbackResult = {
  id: string;
  name: string;
  lastLocation?: { name?: string; path?: string; occurredAt?: string } | null;
};
export type FallbackPayload = { searchQuery?: string; results?: FallbackResult[] };

// ── Error type ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;
  readonly retryAfterSec?: number;
  readonly fallback?: FallbackPayload;
  /** Extra envelope fields (e.g. 409 `referencedByItems` / `referencedByEvents`). */
  readonly extra?: Record<string, unknown>;

  constructor(opts: {
    code: ApiErrorCode;
    message: string;
    status: number;
    details?: ApiErrorDetail[];
    requestId?: string;
    retryAfterSec?: number;
    fallback?: FallbackPayload;
    extra?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
    this.requestId = opts.requestId;
    this.retryAfterSec = opts.retryAfterSec;
    this.fallback = opts.fallback;
    this.extra = opts.extra;
  }

  /** Numeric envelope extras (BR-05 archive-conflict counts). */
  numberExtra(key: string): number | undefined {
    const value = this.extra?.[key];
    return typeof value === "number" ? value : undefined;
  }

  /** Field-level message for a form path, if the envelope carried one. */
  issueFor(path: string): string | undefined {
    return this.details?.find((d) => d.path === path)?.issue;
  }
}

const KNOWN_CODES: ReadonlyArray<ApiErrorCode> = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "AI_UNAVAILABLE",
  "INTERNAL",
];

function asCode(value: unknown): ApiErrorCode {
  return KNOWN_CODES.find((c) => c === value) ?? "INTERNAL";
}

/** Normalize anything thrown by the client layer into an `ApiError`. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof DOMException && err.name === "AbortError") {
    return new ApiError({ code: "INTERNAL", message: "Permintaan dibatalkan.", status: 0 });
  }
  const message =
    err instanceof Error && err.message
      ? err.message
      : "Terjadi kesalahan. Periksa koneksi internet Anda lalu coba lagi.";
  return new ApiError({ code: "INTERNAL", message, status: 0 });
}

// ── 401 handling ──────────────────────────────────────────────────────────

type UnauthorizedHandler = (target: string) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** The (app) layout registers a handler so 401s use client navigation. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  const next = `${window.location.pathname}${window.location.search}`;
  const target = `/login?next=${encodeURIComponent(next)}`;
  if (unauthorizedHandler) unauthorizedHandler(target);
  else window.location.assign(target);
}

/**
 * Single-flight silent session refresh: parallel 401s trigger exactly one
 * POST /api/auth/refresh (Supabase refresh grant); `true` = retry worth doing.
 */
let refreshInFlight: Promise<boolean> | null = null;
function tryRefreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// ── Request plumbing ──────────────────────────────────────────────────────

export type QueryValue = string | number | boolean | null | undefined;
export type RequestOptions = Omit<RequestInit, "body"> & {
  query?: Record<string, QueryValue>;
  /** Serialized as JSON when present; `undefined` sends no body. */
  body?: unknown;
};

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** The `<date>` (YYYY-MM-DD) used in the export filename, from the server clock. */
function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pull the save-as name out of `Content-Disposition: attachment; filename="…"`.
 * Falls back to the documented `smarthomeai-ekspor-<date>.json` shape (API_SPEC
 * §3.7) when the header is absent or unparseable, so the download always has a
 * usable name.
 */
function exportFilename(contentDisposition: string | null): string {
  const fallback = `smarthomeai-ekspor-${todayStamp()}.json`;
  if (!contentDisposition) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  const name = match?.[1]?.trim();
  return name ? name : fallback;
}

/** Legal `unknown` → DTO cast (response shapes are normalized, never assumed). */
function asDto<T>(value: unknown): T {
  return value as T;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Pick the first present key from a response body (tolerates wrapper shapes). */
function pick(body: unknown, keys: ReadonlyArray<string>): unknown {
  const rec = record(body);
  if (!rec) return undefined;
  for (const key of keys) {
    const value = rec[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function asPagination(value: unknown, fallback: { limit: number; offset: number }): Pagination {
  const rec = record(value);
  if (!rec) return { limit: fallback.limit, offset: fallback.offset, total: 0 };
  const limit = typeof rec.limit === "number" ? rec.limit : fallback.limit;
  const offset = typeof rec.offset === "number" ? rec.offset : fallback.offset;
  const total = typeof rec.total === "number" ? rec.total : 0;
  return { limit, offset, total };
}

/** GET/PATCH /api/me answers `{ user: {...}, requestId }` — unwrap to the bare profile. */
function asMe(raw: unknown): MeDto {
  const body = record(raw);
  const rec = record(body?.user) ?? body ?? {};
  return {
    id: typeof rec.id === "string" ? rec.id : "",
    email: typeof rec.email === "string" ? rec.email : "",
    displayName: typeof rec.displayName === "string" ? rec.displayName : null,
    createdAt: typeof rec.createdAt === "string" ? rec.createdAt : "",
    // Soft-deleted sessions are rejected at the auth boundary, so this is
    // always null for a reachable user (FR-014).
    deletedAt: typeof rec.deletedAt === "string" ? rec.deletedAt : null,
  };
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Non-2xx → typed `ApiError` (error envelope, API_SPEC §2). Shared by the
 * normal request path and the file-download path (`exportData`), so both map
 * codes/details/requestId/Retry-After identically.
 */
async function errorFromResponse(res: Response): Promise<ApiError> {
  const parsed = record(await parseBody(res));
  const err = record(parsed?.error);
  const retryAfterHeader = res.headers.get("retry-after");
  const fallbackRec = record(err?.fallback);
  const details = asArray<unknown>(err?.details)
    .map((d) => {
      const rec = record(d);
      if (!rec) return null;
      const pathValue = typeof rec.path === "string" ? rec.path : "";
      const issue = typeof rec.issue === "string" ? rec.issue : "";
      return pathValue && issue ? { path: pathValue, issue } : null;
    })
    .filter((d): d is ApiErrorDetail => d !== null);

  const extra: Record<string, unknown> = {};
  if (err) {
    for (const [key, value] of Object.entries(err)) {
      if (!["code", "message", "details", "requestId"].includes(key)) extra[key] = value;
    }
  }

  return new ApiError({
    code: asCode(err?.code),
    message:
      typeof err?.message === "string" && err.message
        ? err.message
        : res.status === 401
          ? "Sesi Anda telah berakhir. Silakan masuk kembali."
          : "Terjadi kesalahan. Silakan coba lagi.",
    status: res.status,
    details: details.length > 0 ? details : undefined,
    requestId: typeof err?.requestId === "string" ? err.requestId : (res.headers.get("x-request-id") ?? undefined),
    retryAfterSec:
      typeof err?.retryAfter === "number"
        ? err.retryAfter
        : retryAfterHeader !== null && !Number.isNaN(Number(retryAfterHeader))
          ? Number(retryAfterHeader)
          : undefined,
    fallback: fallbackRec
      ? {
          searchQuery: typeof fallbackRec.searchQuery === "string" ? fallbackRec.searchQuery : undefined,
          results: asArray<FallbackResult>(fallbackRec.results),
        }
      : undefined,
    extra,
  });
}

export class ApiClient {
  /** Raw request — never call this outside this module. */
  private async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const { query, body, headers, ...rest } = init;
    const method = (rest.method ?? "GET").toUpperCase();
    const url = buildUrl(path, query);

    const send = async (): Promise<Response> => {
      try {
        return await fetch(url, {
          ...rest,
          method,
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(headers ?? {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch {
        throw new ApiError({
          code: "INTERNAL",
          message: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.",
          status: 0,
        });
      }
    };

    let res = await send();
    // Access token expired: one silent refresh via the httpOnly refresh cookie,
    // then retry the request exactly once. Auth endpoints are excluded so a
    // failed refresh can never recurse through /api/auth/*.
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      if (await tryRefreshSession()) res = await send();
    }

    if (!res.ok) {
      const apiError = await errorFromResponse(res);
      // GET = page load: redirect to sign-in. Mutations rethrow for inline display.
      if (apiError.code === "UNAUTHENTICATED" && (method === "GET" || method === "HEAD")) {
        handleUnauthorized();
      }
      throw apiError;
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError({ code: "INTERNAL", message: "Server mengembalikan respons yang tidak terbaca.", status: res.status });
    }
  }

  // ── Health & identity ───────────────────────────────────────────────────

  health(): Promise<HealthDto> {
    return this.request<HealthDto>("/api/health");
  }

  me(): Promise<MeDto> {
    return this.request<unknown>("/api/me").then(asMe);
  }

  updateMe(payload: ProfileUpdate): Promise<MeDto> {
    return this.request<unknown>("/api/me", { method: "PATCH", body: payload }).then(asMe);
  }

  preferences(): Promise<PreferencesDto> {
    return this.request<unknown>("/api/preferences").then((raw) => {
      const rec = record(pick(raw, ["preferences"])) ?? {};
      const theme = rec.theme === "DARK" || rec.theme === "SYSTEM" ? rec.theme : "LIGHT";
      return {
        theme,
        locale: typeof rec.locale === "string" ? rec.locale : null,
        showSuggestedQuestions:
          typeof rec.showSuggestedQuestions === "boolean" ? rec.showSuggestedQuestions : true,
      } satisfies PreferencesDto;
    });
  }

  updatePreferences(payload: PreferencesUpdate): Promise<PreferencesDto> {
    return this.request<unknown>("/api/preferences", { method: "PATCH", body: payload }).then((raw) => {
      const rec = record(pick(raw, ["preferences"])) ?? {};
      const theme = rec.theme === "DARK" || rec.theme === "SYSTEM" ? rec.theme : "LIGHT";
      return {
        theme,
        locale: typeof rec.locale === "string" ? rec.locale : null,
        showSuggestedQuestions:
          typeof rec.showSuggestedQuestions === "boolean" ? rec.showSuggestedQuestions : true,
      } satisfies PreferencesDto;
    });
  }

  /**
   * Public auth mode (GET /api/auth/config): "dev" renders an email-only form,
   * "supabase" renders email + password (and sign-up when enabled).
   */
  async authConfig(): Promise<AuthConfigDto> {
    const raw = await this.request<unknown>("/api/auth/config");
    const rec = record(raw) ?? {};
    return {
      mode: rec.mode === "supabase" ? "supabase" : "dev",
      signupEnabled: rec.signupEnabled === true,
    };
  }

  /** Development sign-in (POST /api/auth/dev-login — src/lib/auth). Sets the httpOnly session cookie. */
  async loginDev(email: string): Promise<void> {
    await this.request<unknown>("/api/auth/dev-login", { method: "POST", body: { email } });
  }

  /** Password sign-in (Supabase mode). Session lands in the httpOnly cookie. */
  async login(email: string, password: string): Promise<void> {
    await this.request<unknown>("/api/auth/login", { method: "POST", body: { email, password } });
  }

  /**
   * Account creation. `confirmation_required` = uniform response to avoid
   * account enumeration (AC-001-4); the caller shows "check your inbox".
   */
  async signup(email: string, password: string): Promise<"signed_in" | "confirmation_required"> {
    const raw = await this.request<unknown>("/api/auth/signup", { method: "POST", body: { email, password } });
    const rec = record(raw) ?? {};
    return rec.status === "signed_in" ? "signed_in" : "confirmation_required";
  }

  /** Clears the httpOnly session cookies server-side, then returns to sign-in. */
  async logout(): Promise<void> {
    try {
      await this.request<unknown>("/api/auth/logout", { method: "POST" });
    } catch {
      // Best effort — a failed clear must still leave the client signed out.
    }
    if (typeof window === "undefined") return;
    window.location.assign("/login");
  }

  // ── Items ───────────────────────────────────────────────────────────────

  items = {
    list: async (params: Partial<ItemListQuery> = {}): Promise<ItemsListResponse> => {
      const raw = await this.request<unknown>("/api/items", {
        query: { ...params },
      });
      const pagination = asPagination(pick(raw, ["pagination"]), {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      });
      return { items: asArray<ItemDto>(pick(raw, ["items", "results"])), pagination };
    },

    get: async (id: string): Promise<ItemDto> => {
      const raw = await this.request<unknown>(`/api/items/${id}`);
      const body = record(raw);
      const item = (body ? (pick(body, ["item"]) ?? body) : raw) as ItemDto;
      return item;
    },

    create: async (payload: ItemCreate): Promise<ItemCreateResponse> => {
      const raw = await this.request<unknown>("/api/items", { method: "POST", body: payload });
      const body = record(raw);
      const item = ((body ? (pick(body, ["item"]) ?? body) : raw) ?? {}) as ItemDto;
      const warnings = asArray<unknown>(body?.warnings)
        .map((w) => {
          const rec = record(w);
          if (!rec) return null;
          const code = typeof rec.code === "string" ? rec.code : "";
          if (!code) return null;
          const message =
            typeof rec.message === "string" && rec.message
              ? rec.message
              : code === "DUPLICATE_NAME"
                ? "Barang dengan nama serupa sudah ada."
                : "Tersimpan dengan peringatan.";
          return { code, message } satisfies ItemWarning;
        })
        .filter((w): w is ItemWarning => w !== null);
      return { item, warnings };
    },

    update: async (id: string, payload: ItemUpdate): Promise<ItemDto> => {
      const raw = await this.request<unknown>(`/api/items/${id}`, { method: "PATCH", body: payload });
      const body = record(raw);
      return ((body ? (pick(body, ["item"]) ?? body) : raw) ?? {}) as ItemDto;
    },

    archive: async (id: string): Promise<ItemDto> => {
      const raw = await this.request<unknown>(`/api/items/${id}/archive`, { method: "POST" });
      const body = record(raw);
      return ((body ? (pick(body, ["item"]) ?? body) : raw) ?? {}) as ItemDto;
    },

    unarchive: async (id: string): Promise<ItemDto> => {
      const raw = await this.request<unknown>(`/api/items/${id}/unarchive`, { method: "POST" });
      const body = record(raw);
      return ((body ? (pick(body, ["item"]) ?? body) : raw) ?? {}) as ItemDto;
    },

    restore: async (id: string): Promise<ItemDto> => {
      const raw = await this.request<unknown>(`/api/items/${id}/restore`, { method: "POST" });
      const body = record(raw);
      return ((body ? (pick(body, ["item"]) ?? body) : raw) ?? {}) as ItemDto;
    },

    remove: (id: string): Promise<void> => {
      return this.request<void>(`/api/items/${id}`, { method: "DELETE" });
    },

    events: async (itemId: string, params: { limit?: number; offset?: number } = {}): Promise<EventsListResponse> => {
      const raw = await this.request<unknown>(`/api/items/${itemId}/events`, { query: { ...params } });
      return {
        events: asArray<EventDto>(pick(raw, ["events", "items"])),
        pagination: asPagination(pick(raw, ["pagination"]), { limit: params.limit ?? 20, offset: params.offset ?? 0 }),
      };
    },

    recordEvent: async (itemId: string, payload: EventCreate): Promise<EventDto> => {
      const raw = await this.request<unknown>(`/api/items/${itemId}/events`, { method: "POST", body: payload });
      const body = record(raw);
      return ((body ? (pick(body, ["event"]) ?? body) : raw) ?? {}) as EventDto;
    },
  };

  // ── Locations ───────────────────────────────────────────────────────────

  locations = {
    list: async (params: { includeArchived?: boolean } = {}): Promise<LocationsListResponse> => {
      const raw = await this.request<unknown>("/api/locations", {
        query: { includeArchived: params.includeArchived === true ? "true" : undefined },
      });
      const pagination = pick(raw, ["pagination"]);
      return {
        locations: asArray<LocationDto>(pick(raw, ["locations", "results"])),
        pagination: pagination ? asPagination(pagination, { limit: 100, offset: 0 }) : undefined,
      };
    },

    create: async (payload: LocationCreate): Promise<LocationDto> => {
      const raw = await this.request<unknown>("/api/locations", { method: "POST", body: payload });
      const body = record(raw);
      return ((body ? (pick(body, ["location"]) ?? body) : raw) ?? {}) as LocationDto;
    },

    update: async (id: string, payload: LocationUpdate): Promise<LocationDto> => {
      const raw = await this.request<unknown>(`/api/locations/${id}`, { method: "PATCH", body: payload });
      const body = record(raw);
      return ((body ? (pick(body, ["location"]) ?? body) : raw) ?? {}) as LocationDto;
    },

    archive: async (id: string): Promise<LocationDto> => {
      const raw = await this.request<unknown>(`/api/locations/${id}/archive`, { method: "POST" });
      const body = record(raw);
      return ((body ? (pick(body, ["location"]) ?? body) : raw) ?? {}) as LocationDto;
    },

    remove: (id: string): Promise<void> => {
      return this.request<void>(`/api/locations/${id}`, { method: "DELETE" });
    },
  };

  // ── Export (FR-022) ─────────────────────────────────────────────────────

  /**
   * Download the owner's data export (FR-022, API_SPEC §3.7). Unlike every
   * other call, `GET /api/export` answers the raw payload as a file download
   * (`Content-Disposition: attachment`) — the documented exception to the
   * `{ data, requestId }` envelope — so this returns the download's Blob plus
   * the server-provided filename instead of parsing a JSON envelope.
   */
  async exportData(): Promise<ExportFile> {
    const url = "/api/export";
    const send = (): Promise<Response> =>
      fetch(url, { method: "GET", credentials: "include", headers: { Accept: "application/json" } });

    let res: Response;
    try {
      res = await send();
      // Same single silent-refresh-and-retry as the normal request path.
      if (res.status === 401 && (await tryRefreshSession())) res = await send();
    } catch {
      throw new ApiError({
        code: "INTERNAL",
        message: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.",
        status: 0,
      });
    }

    if (!res.ok) {
      // Non-2xx still uses the standard error envelope (API_SPEC §2).
      const apiError = await errorFromResponse(res);
      if (apiError.code === "UNAUTHENTICATED") handleUnauthorized();
      throw apiError;
    }

    try {
      return { blob: await res.blob(), filename: exportFilename(res.headers.get("content-disposition")) };
    } catch {
      throw new ApiError({
        code: "INTERNAL",
        message: "Berkas ekspor tidak dapat dibaca. Silakan coba lagi.",
        status: res.status,
      });
    }
  }

  // ── Search & activity ───────────────────────────────────────────────────

  async search(params: SearchQuery): Promise<SearchResponse> {
    const raw = await this.request<unknown>("/api/search", { query: { ...params } });
    const pagination = asPagination(pick(raw, ["pagination"]), {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    });
    return {
      items: asArray<SearchItemDto>(pick(raw, ["items"])),
      locations: asArray<SearchLocationDto>(pick(raw, ["locations"])),
      pagination,
    };
  }

  async activity(params: Partial<ActivityQuery> = {}): Promise<ActivityResponse> {
    const raw = await this.request<unknown>("/api/activity", { query: { ...params } });
    const pagination = asPagination(pick(raw, ["pagination"]), {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    });
    return { events: asArray<EventDto>(pick(raw, ["entries", "events", "activity", "items"])), pagination };
  }

  // ── Assistant ───────────────────────────────────────────────────────────

  assistant = {
    sendMessage: async (payload: AssistantMessageInput): Promise<AssistantReplyDto> => {
      const raw = await this.request<unknown>("/api/assistant/messages", { method: "POST", body: payload });
      const body = record(raw) ?? {};
      const replyRec = record(body.reply) ?? {};
      const statusValue = replyRec.status;
      const status: ReplyStatus =
        statusValue === "PENDING_ACTION" || statusValue === "FALLBACK" || statusValue === "ERROR"
          ? statusValue
          : "COMPLETE";
      const roleValue = replyRec.role;
      const reply: ReplyDto = {
        id: typeof replyRec.id === "string" ? replyRec.id : "",
        role: roleValue === "USER" ? "USER" : "ASSISTANT",
        text: typeof replyRec.text === "string" ? replyRec.text : "",
        intent: typeof replyRec.intent === "string" ? replyRec.intent : null,
        status,
        citations: asArray<CitationDto>(replyRec.citations),
        candidates: asArray<unknown>(replyRec.candidates).map((c) => {
          const rec = record(c);
          const name =
            rec && typeof rec.name === "string"
              ? rec.name
              : typeof c === "string"
                ? c
                : "";
          return {
            id: rec && typeof rec.id === "string" ? rec.id : undefined,
            name,
            reason: rec && typeof rec.reason === "string" ? rec.reason : null,
          } satisfies CandidateDto;
        }),
        pendingAction: asDto<PendingActionDto | null>(record(replyRec.pendingAction) ?? null),
      };
      const messageRec = record(body.message) ?? {};
      const metaRec = record(body.meta) ?? {};
      return {
        conversationId: typeof body.conversationId === "string" ? body.conversationId : "",
        message: {
          id: typeof messageRec.id === "string" ? messageRec.id : "",
          role: messageRec.role === "ASSISTANT" ? "ASSISTANT" : "USER",
          content: typeof messageRec.content === "string" ? messageRec.content : "",
          createdAt: typeof messageRec.createdAt === "string" ? messageRec.createdAt : undefined,
        },
        reply,
        meta: {
          fallbackUsed: metaRec.fallbackUsed === true,
          latencyMs: typeof metaRec.latencyMs === "number" ? metaRec.latencyMs : undefined,
          model: typeof metaRec.model === "string" ? metaRec.model : undefined,
        },
      };
    },

    conversations: async (params: { limit?: number; offset?: number } = {}): Promise<ConversationsListResponse> => {
      const raw = await this.request<unknown>("/api/assistant/conversations", { query: { ...params } });
      const pagination = pick(raw, ["pagination"]);
      return {
        conversations: asArray<ConversationDto>(pick(raw, ["conversations", "items"])),
        pagination: pagination ? asPagination(pagination, { limit: params.limit ?? 20, offset: params.offset ?? 0 }) : undefined,
      };
    },

    messages: async (conversationId: string, params: { limit?: number; offset?: number } = {}): Promise<MessagesListResponse> => {
      const raw = await this.request<unknown>(`/api/assistant/conversations/${conversationId}`, {
        query: { ...params },
      });
      const messages = asArray<StoredMessageDto>(pick(raw, ["messages", "items"])).map(
        (m): StoredMessageDto => {
        const rec = record(m);
        if (!rec) return m;
        return {
          ...m,
          role: rec.role === "ASSISTANT" ? "ASSISTANT" : "USER",
          content: typeof rec.content === "string" ? rec.content : typeof rec.text === "string" ? rec.text : "",
          citations: asArray<CitationDto>(rec.citations),
          candidates: asArray<CandidateDto>(rec.candidates),
          pendingAction: asDto<PendingActionDto | null>(record(rec.pendingAction) ?? null),
        };
      });
      const pagination = pick(raw, ["pagination"]);
      return {
        messages,
        pagination: pagination ? asPagination(pagination, { limit: params.limit ?? 50, offset: params.offset ?? 0 }) : undefined,
      };
    },

    deleteConversation: (conversationId: string): Promise<void> => {
      return this.request<void>(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" });
    },

    decide: (actionId: string, payload: ActionDecision): Promise<DecisionResponseDto> => {
      return this.request<DecisionResponseDto>(`/api/assistant/actions/${actionId}/decision`, {
        method: "POST",
        body: payload,
      });
    },
  };
}

/** Singleton used by every page — raw fetch to /api lives only in `ApiClient.request`. */
export const api = new ApiClient();
