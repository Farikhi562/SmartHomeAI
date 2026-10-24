# Functional Requirements — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Canonical | Yes — FR IDs defined here are referenced by stories, acceptance criteria, API contracts, tasks, and tests |

**Template:** each FR states priority, rationale, dependencies, preconditions, expected
behavior, error conditions, acceptance-criteria IDs (full text in
[ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)), and planned automated test IDs (defined
in [TEST_PLAN.md](../planning/TEST_PLAN.md)).

**Priority legend:** P0 = MVP blocker · P1 = fast-follow · P2 = future (roadmap only).

---

## P0 — MVP

### FR-001 — A user can authenticate securely

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | All data is private per user; identity is the isolation boundary |
| Dependencies | Supabase Auth / GoTrue (D5, ADR-005), AUTH_* / SUPABASE_* env config |

**Preconditions:** The user has a valid email address; the Supabase project with Auth (GoTrue) enabled exists for the target environment.
**Expected behavior:**
1. User can register with email + password; email confirmation is required before first login (configurable per environment — Supabase's built-in email by default, custom SMTP or disabled confirmations where documented per environment).
2. User can log in, log out, and refresh sessions via Supabase Auth (proxied through our `/api/auth/*` routes so the session cookie stays httpOnly); sessions expire per Supabase Auth policy.
3. User can complete password recovery via email link/code.
4. On first authenticated request, the app verifies the JWT server-side (HS256, `SUPABASE_JWT_SECRET`, issuer/audience checks) and resolves the user identity (`sub`); a `User` row is created idempotently.
5. Account deletion is available per FR-014 (P1).
**Error conditions:** invalid credentials → generic error (no account enumeration); expired/invalid token → 401 `UNAUTHENTICATED`; email already registered → Supabase Auth standard response (no account enumeration, no leak beyond necessity).
**Acceptance criteria:** AC-001-1, AC-001-2, AC-001-3, AC-001-4
**Test coverage:** IT-001-1 (JWT verification middleware), IT-001-2 (user row upsert), E2E-001-1 (signup→login→logout with mocked auth in e2e env)

### FR-002 — A user can create, view, and edit an item

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Core record type; without items there is no product |
| Dependencies | FR-001; DB `Item` (DATABASE_SCHEMA.md) |

**Preconditions:** Authenticated user.
**Expected behavior:**
1. Create item with required `name` (1–120 chars) and optional `description`, `category`.
2. View own items in a filterable inventory list and on an item detail page.
3. Edit any editable field; edits update `updatedAt` and never alter historical location events.
4. Duplicate names are allowed but warned (same owner, same normalized name).
5. Items created via the assistant (FR-024) are marked with source `ASSISTANT`.
**Error conditions:** validation failure → 400 `VALIDATION_ERROR` with field details; not found / not owner → 404 (never leak existence across users).
**Acceptance criteria:** AC-002-1, AC-002-2, AC-002-3
**Test coverage:** UT-002-1 (validation), IT-002-1 (CRUD + ownership), E2E-002-1 (create/edit via UI)

### FR-003 — An item can be associated with a known location

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | "Where is X" requires the item→location link |
| Dependencies | FR-017 (locations), FR-004 |

**Preconditions:** Authenticated user; at least one non-archived location (onboarding provides defaults).
**Expected behavior:**
1. User can record an item's location (from item page or quick action), creating an `ItemLocationEvent`.
2. Locations are chosen from the user's location hierarchy; free-text new locations are offered as a create-inline flow.
3. The item's "last recorded location" is derived from its most recent event (`occurredAt`), not stored redundantly.
**Error conditions:** location not owned → 404; archived location → blocked with "unarchive or pick another" message.
**Acceptance criteria:** AC-003-1, AC-003-2
**Test coverage:** IT-003-1 (association + derivation), UT-003-1 (derivation logic)

### FR-004 — Location changes preserve historical events

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | History is the memory; overwriting destroys recall and trust |
| Dependencies | DB `ItemLocationEvent` |

**Preconditions:** An item-location association is recorded (FR-003).
**Expected behavior:**
1. Every location record is an append-only event with `occurredAt` (when the item was placed there) and `recordedAt` (when the system stored it), plus `source` (`MANUAL`|`ASSISTANT`) and `confidence` (`CONFIRMED`|`INFERRED`).
2. Events are never updated or deleted by application features; corrections append a new event.
3. Item detail shows the event timeline, newest first.
4. `occurredAt` may be backdated by the user (e.g., "since yesterday"); defaults to now.
**Error conditions:** invalid `occurredAt` (future beyond +5 min skew) → `VALIDATION_ERROR`.
**Acceptance criteria:** AC-004-1, AC-004-2, AC-004-3
**Test coverage:** UT-004-1 (append-only invariant), IT-004-1 (history preserved across edits)

### FR-005 — A user can search items and locations deterministically

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Recall without AI; also the AI fallback path (FR-013) |
| Dependencies | PostgreSQL FTS + `pg_trgm` indexes (D6) |

**Preconditions:** Authenticated user with ≥ 0 records.
**Expected behavior:**
1. Global search over item name/description/category/aliases and location names, scoped to the owner.
2. Ranking: exact > prefix > fuzzy (trigram) > full-text rank; archived items ranked below active.
3. Results distinguish items and locations and show last recorded location/time for items.
4. Empty result set → helpful empty state with suggestions (create item / refine query).
**Error conditions:** query < 2 chars → treated as no-op prompt; extremely long query (> 200 chars) → truncated or rejected with message.
**Acceptance criteria:** AC-005-1, AC-005-2, AC-005-3
**Test coverage:** IT-005-1 (ranking + scoping), UT-005-1 (query normalization)

### FR-006 — A user can ask questions in natural language

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Core differentiator: conversational recall |
| Dependencies | FR-001, FR-007, Groq provider (D3) |

**Preconditions:** Authenticated user.
**Expected behavior:**
1. User sends a message (≤ 2000 chars) in the assistant panel or dedicated page.
2. The system classifies intent, extracts entities, and responds conversationally.
3. Supported intents (MVP): `lookup_location`, `list_contents`, `search_fuzzy`, `record_memory`, `correct_record`, `chit_chat`, `help`, `unknown`.
4. Messages and replies are persisted in a conversation (FR-023).
**Error conditions:** empty/whitespace message → `VALIDATION_ERROR`; provider failure → FR-013 fallback UX.
**Acceptance criteria:** AC-006-1, AC-006-2
**Test coverage:** IT-006-1 (endpoint + persistence), AIE-006-* (intent classification suite)

### FR-007 — The assistant retrieves authorized records before generating answers

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Grounding: the LLM explains retrieved facts; it never supplies them |
| Dependencies | FR-005 retrieval service |

**Preconditions:** Authenticated request; intent classified as data-dependent.
**Expected behavior:**
1. Retrieval runs server-side, scoped to the authenticated owner, before any LLM call.
2. Retrieved context is bounded (≤ 20 records, ≤ ~4k tokens) and serialized with stable record IDs.
3. Records are never fetched for another user, under any prompt content (FR-012).
**Error conditions:** retrieval error → 503 `AI_UNAVAILABLE`-class response with deterministic search link; no matches → generation proceeds with an explicit "no records" context.
**Acceptance criteria:** AC-007-1, AC-007-2
**Test coverage:** IT-007-1 (scoping), IT-007-2 (bounded context), AIE-007-* (grounded answer suite)

### FR-008 — Answers identify the last recorded location and timestamp when relevant

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | The user needs "where + when" plus the honesty caveat |
| Dependencies | FR-007 |

**Preconditions:** A location event exists for the asked item.
**Expected behavior:**
1. Answers reference the last recorded location, the `occurredAt` timestamp, and the caveat that the item may have moved since.
2. Answers cite the source records (item/location/event IDs) which the UI links to detail pages.
3. Recorded facts and inferred suggestions are visually distinguished in the UI.
**Error conditions:** none recordable — generation always must obey ANSWER_GENERATION.md rules.
**Test coverage:** AIE-008-* (citations + caveat present), E2E-008-1 (citation links resolve)
**Acceptance criteria:** AC-008-1, AC-008-2

### FR-009 — Ambiguous matches trigger a clarification question

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Wrong guesses destroy trust; asking is cheap |
| Dependencies | FR-007 retrieval scoring |

**Preconditions:** Retrieval returns ≥ 2 comparably-ranked candidate items or an unclear location.
**Expected behavior:**
1. The assistant asks a targeted clarification (e.g., listing candidate items) instead of answering or writing.
2. Clarification offers tappable options in the UI; user selection continues the flow.
3. Thresholds: if the top candidate's score is not meaningfully above the runner-up (configurable margin), treat as ambiguous.
**Error conditions:** user answers with new ambiguous input → re-classify; max 2 clarification rounds → offer deterministic search link.
**Acceptance criteria:** AC-009-1, AC-009-2
**Test coverage:** AIE-009-* (ambiguity suite), IT-009-1 (threshold logic)

### FR-010 — Unavailable records are not fabricated

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Zero-fabrication is a release gate (PRD §17) |
| Dependencies | FR-007, prompt rules (ANSWER_GENERATION.md) |

**Preconditions:** Any data-dependent answer.
**Expected behavior:**
1. If no record matches, the assistant says so explicitly and suggests next steps (record it / refine).
2. The model is instructed to use only provided context; outputs are validated — answer claims must map to retrieved record IDs or be flagged as inference.
3. No invented names, locations, timestamps, or IDs may appear in a reply.
**Error conditions:** validation detects ungrounded claim markers → reply is replaced with a safe fallback answer + logged metric `ai.ungrounded_detected`.
**Test coverage:** AIE-010-* (negative suite), UT-010-1 (grounding validator)
**Acceptance criteria:** AC-010-1, AC-010-2

### FR-011 — Users can correct incorrect records

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Trust requires easy correction |
| Dependencies | FR-002, FR-004, FR-024 |

**Preconditions:** Authenticated owner.
**Expected behavior:**
1. Item fields editable at any time (FR-002).
2. A wrong location record is corrected by recording a new location event (history preserved); assistant `correct_record` intent does the same via confirmation.
3. Assistant answers always link to the relevant item so correction is one click away.
**Error conditions:** same as FR-002/FR-003.
**Test coverage:** IT-011-1 (correction appends), E2E-011-1 (assistant correction flow)
**Acceptance criteria:** AC-011-1, AC-011-2

### FR-012 — Every protected operation enforces server-side authorization

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Cross-tenant exposure is the top privacy risk (R-04) |
| Dependencies | FR-001 |

**Preconditions:** Any request touching user data.
**Expected behavior:**
1. Every API handler verifies the JWT and derives `ownerId` from it — never from request bodies/queries.
2. All repository queries are scoped by `ownerId`; "not mine" behaves identically to "not found" (404).
3. Assistant retrieval and write paths use the same scoping.
4. Authorization is enforced in the service layer, independent of UI state.
**Error conditions:** missing/invalid token → 401; wrong owner → 404; no partial data leakage in error payloads or timing-observable ways (best effort, documented).
**Test coverage:** IT-012-1 (per-endpoint ownership matrix), E2E-012-1 (cross-user negative path)
**Acceptance criteria:** AC-012-1, AC-012-2

### FR-013 — LLM failures do not disable basic inventory operations

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | The dashboard must never depend on the AI provider |
| Dependencies | FR-005, FR-006 |

**Preconditions:** Groq outage, timeout, or rate limit.
**Expected behavior:**
1. CRUD, search, dashboard, and history work fully without the LLM.
2. Assistant request failure → clear error state with retry and a link to deterministic search results for the same query (best-effort extraction).
3. Timeouts (default 15 s) and bounded retries (2, exponential backoff, retry only on 429/5xx/network) before surfacing failure.
4. Degradation is observable (`ai.fallback` metric/log) without logging message content.
**Error conditions:** provider 429/5xx/timeout → fallback UX; malformed provider response → treated as failure.
**Test coverage:** IT-013-1 (timeout/retry/fallback with mocked provider), UT-013-1 (retry policy)
**Acceptance criteria:** AC-013-1, AC-013-2

### FR-015 — A user sees a useful dashboard overview

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Dashboard is the product's home surface (design constraint C-6) |
| Dependencies | FR-002, FR-004 |

**Preconditions:** Authenticated user.
**Expected behavior:**
1. Shows: total active items, recently updated items (last 7 days), recently recorded location events, quick search, AI assistant entry point, quick actions (add item, record location).
2. New users get an onboarding empty state with guided first steps.
3. No invented metrics — only counts derivable from stored data.
**Error conditions:** data load failure → inline error state with retry; partial failure → render remaining cards.
**Test coverage:** IT-015-1 (aggregation queries), E2E-015-1 (dashboard states incl. empty)
**Acceptance criteria:** AC-015-1, AC-015-2

### FR-016 — A user can delete (soft) and archive an item

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Users must remove clutter without destroying history instantly |
| Dependencies | FR-002; retention rules BR-07 |

**Preconditions:** Authenticated owner.
**Expected behavior:**
1. Delete asks for confirmation (destructive-action dialog), then soft-deletes (`deletedAt` set); the item disappears from all lists/search/assistant retrieval.
2. Archived items are hidden from default views but restorable; deleted items restorable within the retention window (30 days, BR-07).
3. History events remain intact for restore.
**Error conditions:** already deleted → 404; restore after window → gone (purged by retention job).
**Test coverage:** IT-016-1 (soft delete + restore + retrieval exclusion), E2E-016-1 (confirm dialog flow)
**Acceptance criteria:** AC-016-1, AC-016-2

### FR-017 — A user can create and manage locations

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Locations are the other half of the memory model |
| Dependencies | FR-001; BR-04 hierarchy rules |

**Preconditions:** Authenticated user.
**Expected behavior:**
1. Create/edit locations with name (1–80 chars), optional description, optional parent (depth ≤ 3).
2. Archive a location (hidden from pickers) — blocked if active items/events reference it, with an explicit message (BR-05).
3. Rename/re-parent allowed; unique per owner among siblings (BR-04).
**Error conditions:** depth exceeded → `VALIDATION_ERROR` with rule; duplicate sibling name → 409 `CONFLICT`; archive with references → 409 with count.
**Test coverage:** IT-017-1 (CRUD + constraints), UT-017-1 (depth/uniqueness rules)
**Acceptance criteria:** AC-017-1, AC-017-2, AC-017-3

### FR-023 — Conversations persist and can be reset

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | Continuity ("what did I just record?") + privacy control |
| Dependencies | FR-006; DB `Conversation`, `Message` |

**Preconditions:** Authenticated user.
**Expected behavior:**
1. Assistant exchanges persist per conversation; a conversation list with last-activity timestamps is available.
2. User can start a new conversation and delete an existing one (hard delete of its messages — privacy, BR-09).
3. Only message metadata (intent, model, latency, token counts) may appear in logs — never content.
**Error conditions:** deletion of unknown conversation → 404.
**Test coverage:** IT-023-1 (persistence + delete), UT-023-1 (log redaction guard)
**Acceptance criteria:** AC-023-1, AC-023-2

### FR-024 — Assistant write operations require explicit confirmation

| Field | Value |
|---|---|
| Priority | P0 |
| Rationale | The LLM must never write directly; users must see exactly what will be stored |
| Dependencies | FR-006, FR-002/FR-003 services |

**Preconditions:** Classified intent is `record_memory` or `correct_record` with sufficient entities.
**Expected behavior:**
1. The assistant responds with a structured confirmation card (item, location, occurredAt, action type) and persists a `pendingAction`.
2. Confirm executes the write through normal validated services (same rules as UI writes) and returns record references; Cancel discards.
3. Pending actions expire (24 h) and are never auto-executed.
4. Insufficient entities → the assistant asks a targeted question instead of proposing a write.
**Error conditions:** confirm on expired/unknown pending action → 409; validation failure on confirm → error shown, nothing written.
**Test coverage:** IT-024-1 (pending → confirm → persisted event), IT-024-2 (cancel/expiry), AIE-024-* (extraction quality)
**Acceptance criteria:** AC-024-1, AC-024-2, AC-024-3

## P1 — Fast follow

### FR-014 — Users can delete their records according to the retention policy

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Privacy/exit promise (JTD-5); required for trust |
| Dependencies | BR-07/BR-08 retention; Supabase Auth admin deletion (GoTrue admin API / SQL delete path) |

**Preconditions:** Authenticated user.
**Expected behavior:**
1. Settings → Delete account: confirmation → account soft-deleted (sign-in blocked, data hidden), 7-day grace period, then full purge (items, aliases, locations, events, conversations, messages, preferences, audit events anonymized).
2. Export (FR-022) offered before deletion.
3. Deletion request and completion emit audit events.
**Error conditions:** repeated requests idempotent; purge failure → retried job + alarm (OBSERVABILITY.md).
**Test coverage:** IT-014-1 (grace + purge script), E2E-014-1 (request flow)
**Acceptance criteria:** AC-014-1, AC-014-2

### FR-018 — A user can browse a recent activity timeline

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Cross-item "what changed" view; MRU recall pattern |
| Dependencies | FR-004 events feed |

**Expected behavior:** Chronological feed of location events + item changes (last 30 days), paginated, filterable by type.
**Test coverage:** IT-018-1, E2E-018-1
**Acceptance criteria:** AC-018-1

### FR-019 — Items support aliases

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | People use many names for one thing ("bike lock" = "U-lock") |
| Dependencies | FR-002; DB `ItemAlias` |

**Expected behavior:** Add/remove aliases (normalized, unique per owner); aliases included in search + assistant retrieval; alias collisions warn but allow.
**Test coverage:** IT-019-1 (search via alias), AIE-019-* (retrieval with alias phrasing)
**Acceptance criteria:** AC-019-1

### FR-020 — Search improves with fuzzy matching quality

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Typos and colloquialisms are common |
| Dependencies | FR-005, `pg_trgm` |

**Expected behavior:** Typo tolerance (trigram ≥ threshold), "did you mean" suggestions, ranking weights tunable; measured against the search eval set.
**Test coverage:** IT-020-1 (typo cases), AIE-020-* (retrieval ranking eval)
**Acceptance criteria:** AC-020-1

### FR-021 — Users can set preferences (theme, suggestions)

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Comfort + accessibility; dark theme optional per design direction |
| Dependencies | DB `UserPreference` |

**Expected behavior:** Theme (light/dark/system), toggle for suggested questions; persisted server-side and applied on login across devices.
**Test coverage:** IT-021-1
**Acceptance criteria:** AC-021-1

### FR-022 — Users can export their data

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Data portability + exit path |
| Dependencies | All user tables |

**Expected behavior:** Settings → Export downloads a JSON file (items, aliases, locations, events, conversations) as the authenticated owner only; audit event recorded; size-limited (≤ 10 MB, then paginated export).
**Test coverage:** IT-022-1 (contents + scoping)
**Acceptance criteria:** AC-022-1

### FR-025 — Items support optional images

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Visual recall helps ("the blue bag") |
| Dependencies | S3 presigned upload (P1 infra), BR-10 |

**Expected behavior:** Upload ≤ 1 image (≤ 5 MB, jpeg/png/webp) per item via presigned S3 URL; thumbnails via CloudFront; images never sent to the LLM in MVP; delete cascades object removal.
**Test coverage:** IT-025-1 (presign + ownership)
**Acceptance criteria:** AC-025-1

### FR-030 — New users receive guided onboarding

| Field | Value |
|---|---|
| Priority | P1 |
| Rationale | Activation metric (PRD §14) |
| Dependencies | FR-015 empty states |

**Expected behavior:** ≤ 3-step onboarding: create first locations (pre-filled suggestions), add first item, try an example question; skippable; not repeated.
**Test coverage:** E2E-030-1
**Acceptance criteria:** AC-030-1

## P2 — Future (roadmap only; no implementation in this plan)

| ID | Requirement | Notes |
|---|---|---|
| FR-026 | Voice interaction (speech in/out) | Uses P1 images? No — separate integration; Groq Whisper candidate |
| FR-027 | QR/NFC label scan to open item | Requires camera flows + label printing |
| FR-028 | Shared household inventories | Data-model change: spaces/roles/membership; security review required |
| FR-029 | External smart-home / IoT tracking integrations | Would introduce automated `INFERRED` events; explicit user opt-in and provenance display |

## Traceability

Every FR above appears in
[TRACEABILITY_MATRIX.md](../planning/TRACEABILITY_MATRIX.md) mapped to US, AC, API
endpoints, DB models, tasks, and tests. P0 rows must have zero gaps.
