# SmartHomeAI — Acceptance Criteria

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Format | Given / When / Then — each criterion is single-minded and independently testable |
| Authority | FR semantics: [FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md) · status codes & DTOs: [../architecture/API_SPEC.md](../architecture/API_SPEC.md) · rules: [BUSINESS_RULES.md](BUSINESS_RULES.md) |

**Conventions.** `AC-<FR>-<n>` IDs are stable and enumerated here in full; an FR's test IDs
(`UT/IT/E2E/AIE`) are defined in [../planning/TEST_PLAN.md](../planning/TEST_PLAN.md).
Status codes used below: 400 `VALIDATION_ERROR` · 401 `UNAUTHENTICATED` · 404 `NOT_FOUND`
(missing **or** not owned — indistinguishable by design) · 409 `CONFLICT` · 429
`RATE_LIMITED` · 503 `AI_UNAVAILABLE` · 201/200 success. P2 FRs (FR-026–FR-029) have no
enumerated ACs until they enter an implementation release.

**Enumerated total:** 56 criteria across 28 FRs.

---

## FR-001 — A user can authenticate securely

**AC-001-1 — Registration creates an unverified account**
- **Given** a visitor on the sign-up page with an email address not yet registered,
- **When** they submit a valid email + password,
- **Then** a Supabase Auth user is created, a confirmation email is sent (via Supabase's built-in email service, or confirmations disabled in that dev environment as documented per environment), and the account cannot be used to sign in until the email is confirmed (per environment configuration).

**AC-001-2 — Sign-in resolves identity server-side**
- **Given** a registered, verified user with correct credentials,
- **When** they sign in and make an authenticated request (e.g. `GET /api/me`),
- **Then** the server verifies the JWT (HS256, `SUPABASE_JWT_SECRET`, issuer/audience checks), derives `ownerId` from the token `sub` (never from the request payload), idempotently upserts the `User` row, and returns the profile (`id`, `email`, …) with a 200.

**AC-001-3 — Invalid credentials and invalid tokens fail safely**
- **Given** a login attempt with a wrong password (or an expired/tampered token on a protected route),
- **When** the request is submitted,
- **Then** the login returns a generic error that does not reveal whether the account exists, and the protected route returns 401 `UNAUTHENTICATED` with the standard error envelope (no stack traces, no provider messages).

**AC-001-4 — Password recovery restores access**
- **Given** a user who requested password recovery,
- **When** they follow the emailed link/code and set a new password,
- **Then** they can sign in with the new password and the old password no longer works.

---

## FR-002 — A user can create, view, and edit an item

**AC-002-1 — Create a valid item**
- **Given** an authenticated user on the add-item form,
- **When** they submit `name` "Motorcycle keys" (1–120 chars) with optional description/category,
- **Then** the server returns 201 with the created item (server-generated UUID, timestamps), the item appears in the inventory list, and — if an item with the same normalized name already exists for this owner — a duplicate-name **warning** is shown while creation still succeeds (BR-03).

**AC-002-2 — Validation failures are rejected with field detail**
- **Given** an authenticated user submitting an item with a blank or >120-char `name`,
- **When** the request reaches the API,
- **Then** the server responds 400 `VALIDATION_ERROR` with `details` naming the failing field path, and **no** item row is created.

**AC-002-3 — Edit never disturbs history; ownership is enforced**
- **Given** an authenticated owner viewing an item that has location events,
- **When** they edit `name`/`description`/`category`,
- **Then** the item's `updatedAt` changes, all existing location events are byte-for-byte unchanged; and a `PATCH`/`GET` for an item owned by another user returns 404 `NOT_FOUND` (identical to a nonexistent ID).

---

## FR-003 — An item can be associated with a known location

**AC-003-1 — Recording a location creates an event and derives the last location**
- **Given** an authenticated owner with ≥ 1 non-archived location and an item,
- **When** they record the item's location (`POST /api/items/:id/events`),
- **Then** a 201 returns a new `ItemLocationEvent` with `occurredAt`, `recordedAt`, `source`, `confidence`, and the item's *last recorded location* equals that event — derived from the newest `occurredAt`, not stored redundantly.

**AC-003-2 — Invalid location choices are refused**
- **Given** an owner selecting an archived location, or a `locationId` owned by another user,
- **When** they attempt to record the location,
- **Then** the archived case is blocked with an "unarchive or pick another" message (no event written), and the not-owned case returns 404 `NOT_FOUND`.

---

## FR-004 — Location changes preserve historical events

**AC-004-1 — Every record is a complete append-only event**
- **Given** an owner recording a placement (manually, defaulted `occurredAt` = now),
- **When** the event is stored,
- **Then** it contains `occurredAt` (when it happened), `recordedAt` (when stored), `source` (`MANUAL`/`ASSISTANT`), `confidence` (`CONFIRMED`/`INFERRED`), and the item timeline lists events newest-first by `occurredAt`.

**AC-004-2 — Corrections and edits do not alter past events**
- **Given** an item with two recorded location events,
- **When** the user edits the item fields or records a newer location,
- **Then** both historical events remain unchanged (no update or delete path exists for events), and a new event is appended.

**AC-004-3 — `occurredAt` may be backdated but not future-dated**
- **Given** an owner recording a placement with `occurredAt` "yesterday 20:00", or with `occurredAt` 1 hour in the future,
- **When** each request is validated,
- **Then** the backdated event is accepted with `recordedAt` = now, and the future date (> now + 5 min skew) is rejected with 400 `VALIDATION_ERROR`.

---

## FR-005 — A user can search items and locations deterministically

**AC-005-1 — Ranking and scoping**
- **Given** an owner with items "Motorcycle keys", "Motorcycle helmet" and an archived "Old keys", and another user's item named "Motorcycle keys",
- **When** the owner searches `GET /api/search?q=motorcycle keys`,
- **Then** matches are returned in the documented order (exact > prefix > fuzzy/trigram > full-text rank), the archived item is ranked below active ones, and **no** other user's item appears under any query.

**AC-005-2 — Result presentation distinguishes types and shows recall context**
- **Given** a search that matches both an item and a location,
- **When** results render,
- **Then** items and locations are visually distinguished, and each item row shows its last recorded location name and time (or an explicit empty value).

**AC-005-3 — Degenerate and empty queries behave helpfully**
- **Given** queries of 1 char, of >200 chars, and of a term with zero matches,
- **When** each is submitted,
- **Then** the 1-char query is a no-op prompt (no request), the oversized query is truncated or rejected with a message, and the zero-match query renders a helpful empty state offering "create item" / "refine query" — never an error screen.

---

## FR-006 — A user can ask questions in natural language

**AC-006-1 — Valid messages produce a classified, persisted exchange**
- **Given** an authenticated user in the assistant,
- **When** they send "Where did I last put my motorcycle keys?" (≤ 2000 chars),
- **Then** the reply returns with a classified intent (e.g. `lookup_location`), the user message and assistant reply are persisted in a conversation (created if `conversationId` was absent), and metadata (intent, model, latency) is recorded.

**AC-006-2 — Invalid messages are rejected without side effects**
- **Given** an empty or whitespace-only message, or one exceeding 2000 chars,
- **When** `POST /api/assistant/messages` is called,
- **Then** the server responds 400 `VALIDATION_ERROR` and no message row is persisted.

---

## FR-007 — The assistant retrieves authorized records before generating answers

**AC-007-1 — Retrieval runs first and is owner-scoped**
- **Given** two users each holding items with similar names, and user A asking a data-dependent question,
- **When** the pipeline runs,
- **Then** retrieval executes server-side scoped to A's `ownerId` *before* any LLM call, and the context passed to the model contains only A's records — B's records never appear, regardless of message content (FR-012).

**AC-007-2 — Context is bounded; retrieval failure degrades safely**
- **Given** an owner with hundreds of records asking a broad question,
- **When** the context is built,
- **Then** it is bounded (≤ 20 records, ~4k tokens) with stable record IDs; and a retrieval error produces an `AI_UNAVAILABLE`-class response (503) that includes a deterministic search link/results instead of an LLM answer.

---

## FR-008 — Answers identify the last recorded location and timestamp when relevant

**AC-008-1 — Location answers state where, when, and the caveat**
- **Given** an item with a recorded event at "Living room shelf, 2026-10-14 20:30",
- **When** the user asks where the item was last put,
- **Then** the answer names the last recorded location, includes the `occurredAt` timestamp, and states the caveat that the item may have moved since it was recorded.

**AC-008-2 — Citations are present, resolvable, and visually separated from inferences**
- **Given** the same grounded answer,
- **When** it renders in the UI,
- **Then** it contains citations to the underlying item/event records, each citation link opens the corresponding detail page, and recorded facts are visually distinguished from inferred suggestions.

---

## FR-009 — Ambiguous matches trigger a clarification question

**AC-009-1 — Ambiguity produces a question, not an answer or a write**
- **Given** an owner with two comparably-ranked items matching the asked name (top score not meaningfully above the runner-up),
- **When** they ask about that item,
- **Then** the reply is a targeted clarification listing the candidates as tappable options, with no location answer and no `pendingAction` created.

**AC-009-2 — Selection continues the flow; rounds are capped**
- **Given** a clarification with candidate options,
- **When** the user selects a candidate, the flow continues (answer or write proposal) for that item; if the user answers ambiguously twice (max 2 rounds),
- **Then** the assistant stops asking and offers a link to deterministic search results for the query.

---

## FR-010 — Unavailable records are not fabricated

**AC-010-1 — No record means an explicit "not found"**
- **Given** an owner asking about an item they never recorded,
- **When** the answer is generated,
- **Then** it explicitly states that no matching record exists, suggests next steps (record it / refine the question), and contains **no** invented item names, locations, timestamps, or IDs.

**AC-010-2 — Ungrounded output is intercepted before display**
- **Given** a model reply whose claims do not map to the retrieved record IDs (simulated in the eval suite),
- **When** the grounding validator runs,
- **Then** the reply is replaced with the safe fallback answer, the `ai.ungrounded_detected` metric is incremented, and the ungrounded text is never shown to the user.

---

## FR-011 — Users can correct incorrect records

**AC-011-1 — Location correction appends rather than overwrites**
- **Given** an item whose recorded location "Desk" is wrong,
- **When** the user records the correct location "Hall closet",
- **Then** a new event is appended, the "Desk" event remains visible in the timeline, and the item's last recorded location becomes "Hall closet".

**AC-011-2 — Assistant corrections follow the same rules and answers link to the item**
- **Given** an assistant answer citing an item that the user knows is wrong,
- **When** the user triggers a correction (via the item link or the `correct_record` intent),
- **Then** the answer displays a link that reaches the item in one click, and any assistant-originated correction persists only through the explicit confirmation flow (FR-024) as a new event.

---

## FR-012 — Every protected operation enforces server-side authorization

**AC-012-1 — Identity comes only from the verified token**
- **Given** an authenticated request whose body/query tries to supply another user's ID as `ownerId`,
- **When** the handler processes it,
- **Then** `ownerId` is taken exclusively from the verified JWT `sub`, the attempt has no effect on scoping, and a missing/invalid token yields 401 `UNAUTHENTICATED`.

**AC-012-2 — "Not mine" is indistinguishable from "not found"**
- **Given** user B requesting a real resource belonging to user A (by ID) on every protected endpoint,
- **When** the request is made with a valid token for B,
- **Then** each endpoint returns 404 `NOT_FOUND` with no resource payload and no signal differentiating it from a nonexistent ID; the per-endpoint ownership test matrix passes.

---

## FR-013 — LLM failures do not disable basic inventory operations

**AC-013-1 — Provider failure degrades only the assistant**
- **Given** a simulated Groq outage (429 / 5xx / timeout) while a user is working,
- **When** they use CRUD, search, dashboard, and history,
- **Then** all of those features work normally, and the assistant request returns 503 `AI_UNAVAILABLE` with a friendly message plus a `fallback` object containing deterministic search results for the query (where extractable) and a retry affordance.

**AC-013-2 — Retries are bounded and degradation is observable**
- **Given** a provider that keeps returning 429,
- **When** an assistant request is made,
- **Then** the server performs at most 2 retries with exponential backoff (only on 429/5xx/network errors) within a 15 s timeout, then surfaces the fallback; the `ai.fallback` metric/log is incremented containing no message content.

---

## FR-014 — Users can delete their records according to the retention policy

**AC-014-1 — Deletion request blocks access immediately and is idempotent**
- **Given** an authenticated user confirming account deletion in Settings (export offered first),
- **When** `DELETE /api/me` is called (once, then repeated),
- **Then** the account is soft-deleted — sign-in is blocked and data hidden — and the repeated request returns the same successful result without error (idempotent), emitting an audit event for the request.

**AC-014-2 — Grace period then full purge with anonymized audit trail**
- **Given** a soft-deleted account after the 7-day grace period,
- **When** the retention/purge job runs,
- **Then** items, aliases, locations, events, conversations, messages, and preferences are deleted, audit events are retained for 12 months in anonymized form, and a failed purge is retried and alarmed rather than dropped.

---

## FR-015 — A user sees a useful dashboard overview

**AC-015-1 — Dashboard shows only real, useful aggregates**
- **Given** an owner with known data (e.g. 12 active items, 3 updated in the last 7 days, recent events),
- **When** the dashboard loads,
- **Then** it shows total active items, recently updated items (last 7 days), recently recorded location events, quick search, the AI assistant entry point, and quick actions — each number matching the stored data exactly (no invented metrics).

**AC-015-2 — Empty, error, and partial-failure states are handled**
- **Given** (a) a brand-new user with no records, (b) a dashboard request that fails, (c) one card's aggregation that fails,
- **When** each case occurs,
- **Then** (a) an onboarding empty state with guided first steps renders, (b) an inline error state with retry renders, and (c) the remaining cards still render.

---

## FR-016 — A user can delete (soft) and archive an item

**AC-016-1 — Delete is confirmed, soft, and hides the item everywhere**
- **Given** an owner choosing Delete on an item,
- **When** they confirm in the destructive-action dialog,
- **Then** `deletedAt` is set, the item disappears from default lists, search results, and assistant retrieval, and its location events remain intact in the database.

**AC-016-2 — Restore and archive behave per the retention rules**
- **Given** a soft-deleted item (a) within 30 days, (b) after the retention job purged it, (c) and separately an archived item,
- **When** the user attempts restore / view,
- **Then** (a) restore returns the item with full history, (b) restore after the window returns 404 (gone), and (c) the archived item is hidden from default views but restorable via Unarchive with events retained.

---

## FR-017 — A user can create and manage locations

**AC-017-1 — Create a valid location**
- **Given** an authenticated owner submitting `{ name: "Office drawer" }` with an optional valid parent,
- **When** the request passes validation within the depth limit,
- **Then** 201 returns the location with server-computed `depth` and `path`, and it appears in the location picker.

**AC-017-2 — Hierarchy depth and sibling uniqueness are enforced**
- **Given** (a) a create/re-parent that would exceed depth 3, and (b) a sibling location with the same name differing only in case under the same non-archived parent,
- **When** each request is submitted,
- **Then** (a) 400 `VALIDATION_ERROR` describing the depth rule, and (b) 409 `CONFLICT` — no duplicate sibling is created.

**AC-017-3 — Archive is blocked while referenced; otherwise allowed**
- **Given** (a) a location referenced by active items/events and (b) an unreferenced location,
- **When** the owner archives each,
- **Then** (a) 409 `CONFLICT` including `referencedByItems`/`referencedByEvents` counts with an explicit message (nothing archived), and (b) the location is archived and hidden from pickers while remaining restorable.

---

## FR-018 — A user can browse a recent activity timeline

**AC-018-1 — Chronological, filterable, paginated feed**
- **Given** an owner with location events and item changes across the last 30 days,
- **When** they open the activity timeline (`GET /api/activity`),
- **Then** entries are returned newest-first covering the default 30-day window, paginated, filterable by type, and each entry links to its item and location.

---

## FR-019 — Items support aliases

**AC-019-1 — Aliases are found by search and by assistant retrieval**
- **Given** an item "Bike lock" with the alias "U-lock" added (normalized, unique per owner, collision with an existing alias or item name surfaces a warning),
- **When** the owner searches "U-lock" and the assistant is asked about "U-lock",
- **Then** the item is returned in search results and retrieved as a match for the assistant's context; removing the alias removes it from both paths.

---

## FR-020 — Search improves with fuzzy matching quality

**AC-020-1 — Typo tolerance with suggestion**
- **Given** an owner with a "Motorcycle keys" item who searches a typo variant (e.g. "motoorcycle keys"),
- **When** the trigram similarity meets the configured threshold,
- **Then** the matching item is returned with a fuzzy `matchType` (and a "did you mean" suggestion where ranking weights call for one), evaluated against the documented search eval set.

---

## FR-021 — Users can set preferences (theme, suggestions)

**AC-021-1 — Preferences persist server-side across devices**
- **Given** an owner setting theme = dark and toggling suggested questions off,
- **When** they sign in from a different device (or a new session),
- **Then** `GET /api/preferences` returns the saved values, the UI applies them (default theme remains light for users who never changed it), and the change survives logout/login.

---

## FR-022 — Users can export their data

**AC-022-1 — Export contains exactly the owner's records and is audited**
- **Given** an authenticated owner with items, locations, events, and preferences (and conversations stored),
- **When** they request export (`GET /api/export`),
- **Then** the response is a JSON file download (`Content-Type: application/json` plus `Content-Disposition: attachment; filename="smarthomeai-ekspor-<date>.json"`) whose payload is exactly `{ items, locations, events, preferences, exportedAt }` for that owner only (no other user's data, conversations excluded by default), stays within the ≤ 10 MB cap or switches to paginated export, and an audit event `DATA_EXPORTED` is recorded.

---

## FR-023 — Conversations persist and can be reset

**AC-023-1 — Conversations persist and are listed**
- **Given** an owner who has exchanged messages in one or more conversations,
- **When** they open the conversation list and a conversation,
- **Then** each conversation shows its last-activity timestamp, its messages load in order, and starting a new conversation creates one without touching previous ones.

**AC-023-2 — Deletion is an immediate hard delete; content never reaches logs**
- **Given** a conversation with messages,
- **When** the user deletes it (and separately, when an unknown conversation ID is deleted),
- **Then** its messages are hard-deleted immediately (BR-09), the unknown ID returns 404, and log output for the operation contains only metadata (intent, model, latency, counts) — never message content.

---

## FR-024 — Assistant write operations require explicit confirmation

**AC-024-1 — A write intent produces a confirmation card, not a write**
- **Given** an owner sending "I put my wallet in the bedroom drawer" with sufficient extracted entities,
- **When** the assistant classifies `record_memory`,
- **Then** the reply returns `status: PENDING_ACTION` with a structured `pendingAction` (action type, item, location, `occurredAt`, `expiresAt` = +24 h) and **no** item/event row exists yet.

**AC-024-2 — Confirm persists through the normal validated path; cancel discards**
- **Given** the pending action,
- **When** the user confirms (optionally overriding location/time) — then, in a separate trial, cancels —
- **Then** confirm executes the write via the same validated services as UI writes with a fresh ownership check, returns record references visible in the dashboard/timeline (and emits an audit event), while cancel writes nothing.

**AC-024-3 — Expiry, unknown actions, and insufficient entities fail safely**
- **Given** (a) a `pendingAction` older than 24 h or an unknown action ID, (b) a validation failure at confirm time (e.g. location archived meanwhile), (c) a write request with missing entities,
- **When** each case is submitted,
- **Then** (a) 409 `CONFLICT` with nothing executed, (b) an error is shown and nothing is written, and (c) the assistant asks a targeted question instead of creating a `pendingAction`.

---

## FR-025 — Items support optional images

**AC-025-1 — One bounded, type-checked image per item, never sent to the LLM**
- **Given** an owner requesting an image upload for an item,
- **When** they receive the presigned URL and upload (a) a valid ≤ 5 MB jpeg/png/webp file, (b) a 7 MB file or a GIF-with-`exe`-style mismatch / unsupported type,
- **Then** (a) the upload succeeds, exactly one image is attached (a second upload replaces it), and deleting the image removes the object; and (b) the upload is rejected by the presigned constraints — additionally, the image bytes are never included in any LLM context in the MVP.

---

## FR-030 — New users receive guided onboarding

**AC-030-1 — Short, skippable, one-time onboarding**
- **Given** a user who signed up within the session and has no items/locations,
- **When** they land in the app,
- **Then** an onboarding flow of ≤ 3 steps (create first locations from pre-filled suggestions → add first item → try an example question) appears, can be skipped at any step, completes against the same validated services as normal creation, and never appears again after completion or skipping.

---

## FR-031 — Users can print labels for their items (label cetak)

**AC-031-1 — Labels render item name, location path, and category from existing data**
- **Given** an authenticated owner with items assigned to locations in the hierarchy,
- **When** they open the `/labels` page (linked from the UI navigation),
- **Then** one printable label per item renders showing the item name, the full location path, and the category, sourced from the existing owner-scoped `GET /api/items` (no new endpoint), and items without a recorded location show an explicit empty location value rather than a fabricated one.

**AC-031-2 — Print output contains labels only**
- **Given** the same `/labels` page in the browser,
- **When** the user opens the print dialog / prints to PDF,
- **Then** print-only CSS excludes application chrome (navigation, buttons, page header) so only the labels are printed, labels fit the page without horizontal overflow, and a failed items request shows an inline error with retry instead of an empty print sheet.

---

## FR-032 — The search page keeps query history and offers quick suggestions (riwayat & saran pencarian)

**AC-032-1 — Last 10 queries persist as removable chips, client-side only**
- **Given** an owner who submits more than 10 searches on `/search` in the browser,
- **When** the page reloads (and when a chip is removed),
- **Then** the last 10 distinct queries are shown as chips in most-recent-first order (older entries dropped, duplicates collapsed), each chip is individually removable with a clear-all control, the history survives reload via `localStorage`, and no query history is persisted server-side.

**AC-032-2 — Suggestion chips come from the owner's recent items and locations**
- **Given** the same `/search` page with recent items and locations,
- **When** the suggestions render (and separately, when `localStorage` is missing or corrupt),
- **Then** quick suggestion chips are built from existing owner-scoped items/locations APIs (each chip runs that value as a search), and a corrupt or absent `localStorage` value is treated as empty history without breaking the page.
