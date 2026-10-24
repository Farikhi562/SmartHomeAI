# API Specification — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Style | REST over Next.js Route Handlers (`app/api/**/route.ts`) — D1, no separate API service |
| Consumers | The SmartHomeAI Next.js client (same deployable). No third-party API consumers in MVP. |

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/*` on the app origin |
| Auth | `Authorization: Bearer <Supabase access token>`; verified server-side (HS256, `SUPABASE_JWT_SECRET`, issuer `<SUPABASE_URL>/auth/v1`, audience `authenticated`) — login/signup/logout/refresh are proxied through our `/api/auth/*` routes (D5, ADR-005). The `ownerId` is **always** derived from the verified token (`sub`) — never from the payload (FR-012) |
| Content type | `application/json; charset=utf-8` (except export: `application/json` download) |
| Validation | Zod schemas per endpoint; invalid body/query → 400 `VALIDATION_ERROR` with field paths |
| IDs | UUID v4 strings in URLs and bodies |
| Timestamps | RFC 3339 UTC strings (e.g. `2026-10-15T20:30:00.000Z`) |
| Pagination | `?limit=&offset=` (default 20, max 100) → response `pagination: { limit, offset, total }` (personal-scale data; cursor pagination is a documented future change if needed) |
| Request ID | Server generates `x-request-id` per request; echoed in response headers and included in every error body and log line |
| Resource envelope | Single-resource responses wrap under a singular key (`{ item }`, `{ location }`, `{ user }`, `{ event }`, `{ preferences }`); list responses use plural keys plus `pagination`; success bodies also echo `requestId` |
| Rate limits | Token bucket per user+route class (in-memory, best-effort on shared hosting): assistant 20/min, writes 60/min, reads 120/min → 429 `RATE_LIMITED` with `Retry-After` |
| Versioning | None for MVP (single first-party client). Breaking changes require a documented migration note in CHANGELOG |
| Idempotency | All create endpoints generate server-side UUIDs; client retries may duplicate records — the assistant write path uses the `pendingAction` id as an idempotency guard (FR-024) |

## 2. Error envelope (all non-2xx JSON responses)

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",     // machine-readable, stable
    "message": "Human-readable summary, safe to display",
    "details": [                     // optional, field-level
      { "path": "name", "issue": "Required, 1-120 chars" }
    ],
    "requestId": "01JB..."
  }
}
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod/schema violation |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token; deleted account |
| 404 | `NOT_FOUND` | Resource missing **or not owned** (indistinguishable by design) |
| 409 | `CONFLICT` | Uniqueness/rule conflict (duplicate sibling location, archive-with-references, expired pending action) |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 32 KB (images excluded; they use presigned uploads) |
| 429 | `RATE_LIMITED` | Per-user rate limit; includes `Retry-After` seconds |
| 503 | `AI_UNAVAILABLE` | LLM provider failed after bounded retries; body includes `fallback` object with deterministic search results when possible (FR-013) |
| 500 | `INTERNAL` | Unexpected server error (no stack traces, no provider messages leaked) |

## 3. Endpoint catalog

Legend: **FR** = functional requirement served.

### 3.1 Health & identity

| Method & path | FR | Auth | Description |
|---|---|---|---|
| `GET /api/health` | — | none | Liveness: `{ status, version, db: "up"|"down" }`; used by deploy smoke tests |
| `GET /api/me` | FR-001 | required | `{ user: { id, email, displayName, createdAt, deletedAt }, requestId }` — the `User` row is created at sign-in; soft-deleted sessions are rejected before this runs (FR-014) |
| `PATCH /api/me` | FR-002 | required | Update `displayName`; same `{ user, requestId }` shape |
| `DELETE /api/me` | FR-014 (P1) | required | Start account deletion: soft-delete + 7-day grace → purge (BR-08). Idempotent |
| `GET /api/preferences` | FR-021 (P1) | required | `{ preferences, requestId }` (defaults created on demand) |
| `PATCH /api/preferences` | FR-021 (P1) | required | `{ theme?, locale?, showSuggestedQuestions? }` → same `{ preferences, requestId }` shape |

### 3.2 Items — FR-002, FR-016

| Method & path | FR | Description |
|---|---|---|
| `GET /api/items` | FR-002, FR-005 | List with filters `q`, `locationId`, `category`, `status=active|archived|all`, `sort=name|updatedAt|lastRecordedAt`, `order`, `limit`, `offset`. Response items include derived `lastLocation: { locationId, name, path, occurredAt } | null` |
| `POST /api/items` | FR-002 | `{ name, description?, category?, locationId? }` → 201 with created item (creates an initial event if `locationId` given) |
| `GET /api/items/:id` | FR-002 | Full item + `lastLocation` + aliases (P1) |
| `PATCH /api/items/:id` | FR-002, FR-011 | `{ name?, description?, category? }` — never touches events |
| `DELETE /api/items/:id` | FR-016 | Soft delete (confirmation is a UI concern) |
| `POST /api/items/:id/restore` | FR-016 | Undo soft delete within retention window (BR-07) |
| `POST /api/items/:id/archive` · `POST /api/items/:id/unarchive` | FR-016 | Archive lifecycle |

Example — `POST /api/items` request/response:

```jsonc
// request
{ "name": "Motorcycle keys", "category": "keys", "locationId": "3f0c…" }
// 201 response
{
  "item": {
    "id": "a91d…",
    "name": "Motorcycle keys",
    "category": "keys",
    "createdVia": "USER",
    "lastLocation": { "locationId": "3f0c…", "name": "Living room shelf", "path": "Home / Living room / Shelf", "occurredAt": "2026-10-15T18:30:00.000Z" },
    "createdAt": "2026-10-15T18:31:02.000Z",
    "updatedAt": "2026-10-15T18:31:02.000Z"
  },
  "requestId": "01JB…"
}
```

### 3.3 Location events (the memory) — FR-003, FR-004

| Method & path | FR | Description |
|---|---|---|
| `GET /api/items/:id/events` | FR-004 | Timeline, newest first, paginated. Each event: `{ id, location: { id, name, path }, occurredAt, recordedAt, source, confidence, note }` |
| `POST /api/items/:id/events` | FR-003 | Record a location: `{ locationId, occurredAt?, note? }`. `source` is set server-side (`MANUAL` for this endpoint; assistant writes go through `/api/assistant/actions`). 201 with the event |

### 3.4 Locations — FR-017

| Method & path | FR | Description |
|---|---|---|
| `GET /api/locations` | FR-017 | Flat list with `parentId` + computed `depth` and `path`; `includeArchived` flag |
| `POST /api/locations` | FR-017 | `{ name, description?, parentId? }` → 201; enforces depth ≤ 3 and sibling uniqueness (409) |
| `PATCH /api/locations/:id` | FR-017 | `{ name?, description?, parentId? }` — re-parenting re-validates depth |
| `POST /api/locations/:id/archive` | FR-017 | 409 `CONFLICT` with `{ referencedByItems, referencedByEvents }` counts when blocked (BR-05) |
| `DELETE /api/locations/:id` | FR-017 | Only when unreferenced and childless (P1 convenience); otherwise 409 |

### 3.5 Search & activity — FR-005, FR-018 (P1)

| Method & path | FR | Description |
|---|---|---|
| `GET /api/search` | FR-005 | `q` (≥2 chars), `type=items|locations|all`, `limit`, `offset`. Response: `{ items: [{ id, name, category, score, matchType: "exact"|"prefix"|"fuzzy"|"fulltext"|"contains", lastLocation }], locations: [...], pagination }` — `contains` marks the degraded ILIKE ranking used when the pg_trgm extension is unavailable |
| `GET /api/activity` | FR-018 | Recent events across items, `since` (default 30 days) → `{ entries, pagination }`; each entry links item + location |
| `GET /api/dashboard` | FR-015 | Stored-data aggregates for the dashboard cards → `{ totalActiveItems, recentlyUpdatedItems, recentEvents, locationCount, requestId }`. Added during implementation (2026-10-21); clients may also compose the page from the list endpoints above |

### 3.6 Assistant — FR-006, FR-007, FR-008, FR-009, FR-010, FR-023, FR-024

| Method & path | FR | Description |
|---|---|---|
| `POST /api/assistant/messages` | FR-006 | `{ conversationId?, message }` (message ≤ 2000 chars). Returns the assistant reply (below). Creates a conversation when `conversationId` is absent |
| `GET /api/assistant/conversations` | FR-023 | List with `lastMessageAt`, paginated |
| `GET /api/assistant/conversations/:id` | FR-023 | Messages newest-safe ordered, paginated |
| `DELETE /api/assistant/conversations/:id` | FR-023 | Hard delete conversation + messages (privacy) |
| `POST /api/assistant/actions/:actionId/decision` | FR-024 | `{ decision: "confirm" \| "cancel", overrides? }` where `overrides` may adjust `locationId`/`occurredAt` before confirming. Executes the write through the same validated services as UI writes |

`POST /api/assistant/messages` response shape:

```jsonc
{
  "conversationId": "c7e2…",
  "message": { "id": "m1", "role": "USER", "content": "Where did I last put my motorcycle keys?" },
  "reply": {
    "id": "m2",
    "role": "ASSISTANT",
    "text": "Your last recorded entry says the keys were placed on the living room shelf yesterday at 8:30 PM. This is the last recorded location, so they may have been moved since then.",
    "intent": "lookup_location",
    "status": "COMPLETE",            // COMPLETE | PENDING_ACTION | FALLBACK | ERROR
    "citations": [                    // record references the UI links to detail pages
      { "type": "item", "id": "a91d…", "label": "Motorcycle keys" },
      { "type": "event", "id": "e5b1…", "occurredAt": "2026-10-14T20:30:00.000Z" }
    ],
    "candidates": [],                 // clarification options when intent is ambiguous (FR-009)
    "pendingAction": null             // present when status == PENDING_ACTION (FR-024)
  },
  "meta": { "fallbackUsed": false, "latencyMs": 812, "model": "llama-3.3-70b-versatile" }
}
```

`pendingAction` (when present):

```jsonc
{
  "id": "pa_01JB…",                  // used by /api/assistant/actions/:actionId/decision
  "type": "record_location",         // record_location | create_item | correct_location
  "payload": {
    "item": { "existingId": "a91d…", "name": "Wallet" },   // existingId or proposed name
    "location": { "existingId": "8b2c…", "name": "Bedroom drawer", "path": "Home / Bedroom / Drawer" },
    "occurredAt": "2026-10-15T19:00:00.000Z"
  },
  "expiresAt": "2026-10-16T19:00:00.000Z"                 // 24 h; never auto-executed (FR-024)
}
```

Provider failure response (FR-013):

```jsonc
// 503 AI_UNAVAILABLE
{
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "The assistant is temporarily unavailable. Your records are safe.",
    "fallback": {
      "searchQuery": "motorcycle keys",
      "results": [ { "id": "a91d…", "name": "Motorcycle keys", "lastLocation": { "name": "Living room shelf", "occurredAt": "2026-10-14T20:30:00.000Z" } } ]
    },
    "requestId": "01JB…"
  }
}
```

### 3.7 Export (P1) — FR-022

| Method & path | FR | Description |
|---|---|---|
| `GET /api/export` | FR-022 | Streams `{ user, items, aliases, locations, events, conversations?, preferences }` as JSON for the authenticated owner only; records an audit event. `includeConversations=false` by default (content minimization) |

### 3.8 Images (P1) — FR-025

| Method & path | FR | Description |
|---|---|---|
| `POST /api/items/:id/image` | FR-025 | Returns a presigned S3 PUT URL (≤ 5 MB, jpeg/png/webp) + required headers; the client uploads directly to S3. A follow-up `PATCH` confirms the attachment |
| `DELETE /api/items/:id/image` | FR-025 | Removes the object + reference |

## 4. DTO ↔ model mapping (summary)

| DTO | Model(s) | Notes |
|---|---|---|
| `ItemDto` | `items` + derived `lastLocation` | Derived via newest `item_location_events` row (`occurred_at DESC`) |
| `LocationDto` | `locations` | Server computes `path` and `depth`; never trusts client-supplied parentage beyond `parentId` |
| `EventDto` | `item_location_events` | Read-only projection; no update payload exists anywhere in the API |
| `ConversationDto` / `MessageDto` | `conversations` / `messages` | `pendingAction` and metadata fields pass through; content never logged |
| `SearchResultDto` | `items`/`locations` via `search.repo` | `matchType` exposes ranking provenance for UI badges |

**Server-side enrichment:** `citations[].label` and event `occurredAt` on citations are added
by the server when mapping model output (which cites only `{ type, id }`, per
ANSWER_GENERATION.md) to the DTO; the model never authors labels or timestamps.

## 5. Explicit non-goals (MVP)

- No public/third-party API, no API keys for machines (Supabase Auth M2M not needed).
- No GraphQL, no gRPC, no WebSocket (assistant is request/response; polling not needed).
- No bulk import endpoint (P1 may add CSV import behind the same service rules).
- No server-sent events; the assistant reply is a single bounded response.
