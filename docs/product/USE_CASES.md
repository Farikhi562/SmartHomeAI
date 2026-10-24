# SmartHomeAI — Use Cases

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| IDs | `UC-##` (this file owns them; stable, never reused) |
| FR authority | [FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md) |

**Structure per use case:** context table (actor, trigger, priority, FR refs) → main flow
(numbered) → alternate flows → exception flows. Flows describe *user-visible* behavior;
server-side mechanics are referenced, not re-specified. Status codes come from
[API_SPEC.md](../architecture/API_SPEC.md) §2.

---

## Index

| ID | Use case | Primary FRs |
|---|---|---|
| UC-01 | Register and log in | FR-001, FR-012 |
| UC-02 | Add an item manually | FR-002, FR-017 |
| UC-03 | Record an item's location | FR-003, FR-004 |
| UC-04 | Ask where an item is | FR-006, FR-007, FR-008, FR-010 |
| UC-05 | List contents of a container | FR-006, FR-007, FR-009 |
| UC-06 | Ambiguous ask → clarification | FR-009, FR-010 |
| UC-07 | Assistant proposes a write → user confirms | FR-024, FR-006 |
| UC-08 | Correct a record | FR-011, FR-004, FR-016 |
| UC-09 | Search with a typo | FR-005, FR-020 (P1) |
| UC-10 | Archive or delete an item | FR-016, FR-017 |
| UC-11 | View an item's location history | FR-004, FR-018 (P1) |
| UC-12 | Exit: export data / delete account | FR-022 (P1), FR-014 (P1) |

---

### UC-01 — Register and log in

| Field | Value |
|---|---|
| Actor | Anonymous visitor → authenticated user |
| Trigger | User opens the app and chooses Sign up, or returns and chooses Sign in |
| Priority | P0 (MVP) |
| FR refs | FR-001, FR-012 |

**Main flow:**
1. User chooses Sign up and enters email + password.
2. System creates the account via Supabase Auth (D5, ADR-005) and sends an email confirmation code/link (Supabase's built-in email service on Free; confirmations may be disabled in dev environments per environment configuration).
3. User confirms the email, then signs in.
4. System issues a session via Supabase Auth; our `/api/auth/*` proxy routes set it as an httpOnly session cookie (A-7).
5. On the first authenticated request, the server verifies the JWT (HS256, `SUPABASE_JWT_SECRET`, issuer/audience checks), derives `ownerId` from the token `sub` (BR-01), and upserts the `User` row idempotently (`GET /api/me`).
6. User lands on the dashboard (empty state / onboarding if new).

**Alternate flows:**
- A1. *Returning user:* skip steps 1–3; sign in with existing credentials → step 4.
- A2. *Password recovery:* user requests a reset link/code → sets a new password → sign in (step 4).
- A3. *Resend verification:* user requests a new verification email before step 3.

**Exception flows:**
- E1. Invalid credentials → generic error (no account enumeration); no account existence revealed.
- E2. Email already registered → Supabase Auth standard response (no leak beyond necessity).
- E3. Missing/expired/invalid token on a protected call → 401 `UNAUTHENTICATED`.
- E4. Email not confirmed (where confirmation is enabled for the environment) → sign-in blocked per Supabase Auth configuration until step 3 completes.

---

### UC-02 — Add an item manually

| Field | Value |
|---|---|
| Actor | Authenticated user (P1, P2, P3) |
| Trigger | User clicks "Add item" (dashboard quick action, inventory page, or onboarding step) |
| Priority | P0 (MVP) |
| FR refs | FR-002, FR-017 (locations must exist to pick from) |

**Main flow:**
1. User opens the create-item form.
2. User enters `name` (required, 1–120 chars) and optionally description, category, and a location.
3. System validates (Zod) and, on success, returns 201 with the created item; if a location was chosen, an initial location event is created.
4. Item appears in the inventory list; dashboard counts update.

**Alternate flows:**
- A1. *Create-inline location:* user types a location that does not exist yet → create-inline flow (FR-003) creates it → returns to the form → step 3.
- A2. *Duplicate name:* a same-normalized-name item already exists for this owner → warning is shown, user may proceed (BR-03); the item is created.

**Exception flows:**
- E1. Missing/invalid `name` (length, blank after trim) → 400 `VALIDATION_ERROR` with field path `name`.
- E2. Not authenticated → 401 `UNAUTHENTICATED`.
- E3. Chosen `locationId` not owned → 404 `NOT_FOUND` (never reveals another user's data).
- E4. Body > 32 KB → 413 `PAYLOAD_TOO_LARGE`.

---

### UC-03 — Record an item's location

| Field | Value |
|---|---|
| Actor | Authenticated user |
| Trigger | User records a placement (item page "Record location", quick action, or assistant flow via UC-07) |
| Priority | P0 (MVP) |
| FR refs | FR-003, FR-004, BR-04 |

**Main flow:**
1. User opens the record-location action for an item.
2. User picks a location from their hierarchy (path shown, e.g. "Home / Living room / Shelf") and optionally a backdated `occurredAt` and a note.
3. System validates depth/ownership/`occurredAt` skew and creates an append-only `ItemLocationEvent` (`source = MANUAL` unless via assistant, `confidence = CONFIRMED`).
4. System derives the item's *last recorded location* from the newest event by `occurredAt` (not stored redundantly).
5. Item detail timeline shows the new event at the top; dashboard "recently recorded" updates.

**Alternate flows:**
- A1. *Backdated placement:* user indicates "since yesterday" → `occurredAt` set in the past → if it becomes the newest `occurredAt`, it becomes the last recorded location.
- A2. *No locations yet:* user is offered the create-inline flow first (precondition: ≥ 1 non-archived location, provided by onboarding defaults).

**Exception flows:**
- E1. Archived location selected → blocked with "unarchive or pick another" message (no event written).
- E2. `occurredAt` in the future beyond +5 min skew → 400 `VALIDATION_ERROR`.
- E3. Location not owned → 404 `NOT_FOUND`.
- E4. Write rate limit exceeded (60/min per API_SPEC §1) → 429 `RATE_LIMITED` with `Retry-After`.

---

### UC-04 — Ask where an item is (grounded answer)

| Field | Value |
|---|---|
| Actor | Authenticated user (P1's primary flow) |
| Trigger | User types/sends "Where did I last put my motorcycle keys?" in the assistant |
| Priority | P0 (MVP) |
| FR refs | FR-006, FR-007, FR-008, FR-010 |

**Main flow:**
1. User sends a message (≤ 2000 chars).
2. System validates the message, classifies intent (`lookup_location`) and extracts entities — server-side, before any LLM answer generation.
3. System retrieves the owner's matching records (bounded: ≤ 20 records, ~4k tokens), scoped to the authenticated `ownerId`.
4. LLM generates a reply from the retrieved context only; the grounding validator checks every cited record ID against the retrieved set.
5. Reply shows: last recorded location, `occurredAt` timestamp, the "may have moved since" caveat, and citations (item/event) that link to detail pages.
6. Message and reply persist in the conversation (FR-023).

**Alternate flows:**
- A1. *Chit-chat/help/unknown intent:* conversational reply without data claims (intent `chit_chat`, `help`, `unknown`) — no retrieval required.
- A2. *No matching record:* reply states explicitly that no record was found and suggests next steps (record it / refine) — zero fabrication (FR-010).

**Exception flows:**
- E1. Empty/whitespace message → 400 `VALIDATION_ERROR`.
- E2. Retrieval error or provider failure after timeouts/bounded retries → 503 `AI_UNAVAILABLE` with `fallback` deterministic search results (FR-013); core inventory unaffected.
- E3. Grounding validation failure → reply replaced with safe fallback answer + metric `ai.ungrounded_detected`.
- E4. Assistant rate caps exceeded (20 req/min, 100 messages/day per BR-12) → 429 `RATE_LIMITED`.

---

### UC-05 — List contents of a container

| Field | Value |
|---|---|
| Actor | Authenticated user (P2's household scan) |
| Trigger | User asks "What's in the bedroom drawer?" |
| Priority | P0 (MVP) |
| FR refs | FR-006 (`list_contents` intent), FR-007, FR-009 |

**Main flow:**
1. User sends the question.
2. System classifies intent `list_contents` and extracts the container entity ("bedroom drawer").
3. Retrieval resolves the container to a location (or container item) owned by the user and fetches items whose last recorded location is within it (bounded result set).
4. Reply lists the matching items with their last recorded times; each item is cited and clickable.

**Alternate flows:**
- A1. *Nested location:* the named container is a parent → items in child locations are included, grouped by child path.
- A2. *Empty container (no records):* reply states that nothing is recorded there yet (FR-010 honesty), suggesting recording.

**Exception flows:**
- E1. Container ambiguous (e.g., two locations match) → UC-06 clarification instead of a list.
- E2. Container unknown → explicit "no such recorded location" answer + offer to create it.
- E3. Provider failure → 503 `AI_UNAVAILABLE` with deterministic search fallback (FR-013).

---

### UC-06 — Ambiguous ask → clarification

| Field | Value |
|---|---|
| Actor | Authenticated user with ≥ 2 similar items |
| Trigger | User asks about an item whose name matches multiple candidates (e.g., "charger") |
| Priority | P0 (MVP) |
| FR refs | FR-009, FR-010 |

**Main flow:**
1. User sends an ambiguous question.
2. Retrieval returns ≥ 2 comparably-ranked candidates (top score not meaningfully above runner-up, configurable margin).
3. Assistant asks a targeted clarification listing the candidate items as tappable options (`candidates` in the reply DTO) — it does **not** answer and does **not** write.
4. User selects a candidate → flow continues (answer for that item, or write proposal in UC-07).

**Alternate flows:**
- A1. *User answers in free text:* the answer is re-classified; if still ambiguous, a new clarification is issued (max 2 rounds).
- A2. *User declines:* assistant offers the deterministic search link (FR-005) to resolve it manually.

**Exception flows:**
- E1. Clarification rounds exhausted (max 2) → stop asking; offer deterministic search results for the query.
- E2. Ambiguous *write* request → same clarification behavior; no `pendingAction` is created until entities are unambiguous (FR-024.4).
- E3. Provider failure during clarification → 503 `AI_UNAVAILABLE` + fallback (FR-013).

---

### UC-07 — Assistant proposes a write → user confirms

| Field | Value |
|---|---|
| Actor | Authenticated user |
| Trigger | User says "I put my wallet in the bedroom drawer" (`record_memory` / `correct_record` intent) |
| Priority | P0 (MVP) |
| FR refs | FR-024, FR-006, BR-02 |

**Main flow:**
1. User sends the placement statement.
2. System classifies the intent, extracts item + location + `occurredAt`; if entities are insufficient → asks a targeted question (FR-024.4) instead of proposing a write.
3. System responds with a structured confirmation card (action type, item, location, `occurredAt`) and persists a `pendingAction` with `expiresAt` = now + 24 h. **Nothing is written yet.**
4. User reviews and chooses Confirm (optionally overriding `locationId`/`occurredAt` first).
5. System executes the write through the same validated services as UI writes, with a fresh ownership check; returns record references; item/event appear in the dashboard and timeline.
6. The confirmation decision is recorded as an audit event (`ASSISTANT_WRITE_CONFIRMED`).

**Alternate flows:**
- A1. *Cancel:* user discards the card → `pendingAction` cancelled, no write, audit/metric `assistant_write_cancelled`.
- A2. *Overrides:* user adjusts location or occurred time on the card before confirming → step 5 validates the adjusted values.

**Exception flows:**
- E1. Confirm on expired (> 24 h) or unknown `pendingAction` → 409 `CONFLICT`; never auto-executed (BR-02).
- E2. Validation failure at confirm time (e.g., location archived meanwhile) → error shown, nothing written.
- E3. Not owned / unauthorized → 404 `NOT_FOUND` (identical to "not found", FR-012).
- E4. Double-click/duplicate confirm → idempotency guard on `pendingAction` id (API_SPEC §1) prevents duplicate writes.

---

### UC-08 — Correct a record

| Field | Value |
|---|---|
| Actor | Authenticated user (P2's trust loop) |
| Trigger | User notices a wrong item field or a wrong location record |
| Priority | P0 (MVP) |
| FR refs | FR-011, FR-002 (edit), FR-004/BR-06 (append-only), FR-016 (replace-by-delete where applicable) |

**Main flow:**
1. User opens the item (often via a citation link on an assistant answer).
2. *Field correction:* user edits name/description/category → `PATCH /api/items/:id` → `updatedAt` refreshed; **events untouched**.
3. *Location correction:* user records the correct location as a **new** event → previous events remain in the timeline; the last recorded location updates to the new event.
4. Timeline now shows both the old and new record (newest first).

**Alternate flows:**
- A1. *Correction via assistant:* user says "No, it's in the hall closet" (`correct_record`) → UC-07 confirmation card → same append-on-confirm behavior.
- A2. *Hide an item instead of correcting:* archive or soft-delete (UC-10) rather than editing content.

**Exception flows:**
- E1. Edit validation failure → 400 `VALIDATION_ERROR`.
- E2. Archived location chosen for the correction → blocked (UC-03 E1).
- E3. Not owned → 404 `NOT_FOUND`.
- E4. Attempt to modify a historical event directly → not possible: no API mutates events (API_SPEC §3.4: read-only projection; DB invariant per DATABASE_SCHEMA §3.5).

---

### UC-09 — Search with a typo

| Field | Value |
|---|---|
| Actor | Authenticated user (any; P1 on mobile) |
| Trigger | User types a query with a typo, e.g. "motoorcycle keys", into global search |
| Priority | P0 (MVP) — fuzzy quality improvements are P1 (FR-020) |
| FR refs | FR-005, FR-020 (P1) |

**Main flow:**
1. User enters the query (≥ 2 chars).
2. System runs owner-scoped ranking: exact → prefix → fuzzy (trigram) → full-text rank; archived items ranked below active.
3. Results page distinguishes items vs. locations; item rows show last recorded location + time.
4. User opens a result → item detail (or location) page.

**Alternate flows:**
- A1. *Typo tolerated (P1):* trigram similarity ≥ threshold → match shown with a "did you mean" suggestion (FR-020).
- A2. *No results:* helpful empty state with suggestions — create the item / refine the query.
- A3. *Very short query* (< 2 chars) → no-op prompt, no request fired.
- A4. *From assistant fallback:* the same search is offered as the FR-013 fallback link for an assistant query.

**Exception flows:**
- E1. Query > 200 chars → truncated or rejected with a message.
- E2. Not authenticated → 401 `UNAUTHENTICATED`.
- E3. In MVP (before FR-020 ships), a typo may legitimately return zero results → empty state (A2) is the defined behavior, not an error.

---

### UC-10 — Archive or delete an item (and archive a location)

| Field | Value |
|---|---|
| Actor | Authenticated owner (P2 decluttering, P3 pruning) |
| Trigger | User chooses Archive or Delete on an item (or Archive on a location) |
| Priority | P0 (MVP) |
| FR refs | FR-016, FR-017, BR-05, BR-07 |

**Main flow (delete item):**
1. User chooses Delete → destructive-action confirmation dialog.
2. On confirm, the item is soft-deleted (`deletedAt` set) and disappears from lists, search, and assistant retrieval.
3. User can restore within the 30-day retention window (BR-07) → item and its history reappear intact.

**Main flow (archive item):**
1. User chooses Archive → item hidden from default views (still reachable via `status=archived` filter), restorable via Unarchive; events retained.

**Main flow (archive location):**
1. User chooses Archive on a location.
2. If active items/events reference it → **409 `CONFLICT`** with `{ referencedByItems, referencedByEvents }` counts and an explicit message (BR-05); nothing archived.
3. If unreferenced → location archived; hidden from pickers.

**Alternate flows:**
- A1. *Delete with no history:* same flow; restore still available during the window.
- A2. *Unarchive:* reversible at any time while the record exists.

**Exception flows:**
- E1. Delete/restore on an already-deleted item → 404 (API_SPEC §3.2).
- E2. Restore after the 30-day window → gone (purged by retention job) → 404.
- E3. Delete a referenced location (`DELETE /api/locations/:id`) → 409 `CONFLICT` (locations are archived, not deleted, while referenced).
- E4. Attempt to purge events of a live account via UI → impossible by design; retention jobs never touch events of live accounts (DATABASE_SCHEMA §3.5).

---

### UC-11 — View an item's location history

| Field | Value |
|---|---|
| Actor | Authenticated user (P2's "when did it move" question) |
| Trigger | User opens an item detail page, or a cross-item activity view (P1) |
| Priority | P0 (MVP) for the item timeline; P1 for the cross-item feed |
| FR refs | FR-004, FR-015 (dashboard recency), FR-018 (P1 timeline) |

**Main flow:**
1. User opens item detail.
2. System shows the event timeline, newest first: location path, `occurredAt`, `recordedAt`, `source`, `confidence`, optional note.
3. User compares entries to understand where the item has been over time.

**Alternate flows:**
- A1. *Cross-item feed (P1, FR-018):* user opens the activity timeline — location events + item changes for the last 30 days, paginated, filterable by type; each entry links item + location.
- A2. *From an assistant answer:* user clicks a citation → lands on this timeline with the cited event visible.

**Exception flows:**
- E1. Item not owned / not found → 404 `NOT_FOUND`.
- E2. Partial data load failure → inline error state with retry on the affected widget (dashboard-style degradation, FR-015).

---

### UC-12 — Exit: export data and delete account (P1)

| Field | Value |
|---|---|
| Actor | Authenticated user (P3's trust exit; JTD-5) |
| Trigger | Settings → Export, or Settings → Delete account |
| Priority | P1 (fast-follow) |
| FR refs | FR-022 (export, P1), FR-014 (deletion, P1), BR-08 |

**Main flow (export):**
1. User requests export (optionally including conversations; default excludes content).
2. System streams a JSON file of the authenticated owner's records only (items, aliases, locations, events, preferences) — ≤ 10 MB, else paginated export.
3. Audit event `DATA_EXPORTED` recorded.

**Main flow (delete account):**
1. User chooses Delete account → confirmation step, with export offered first.
2. Account soft-deleted: sign-in blocked, data hidden; repeated requests are idempotent.
3. 7-day grace period (data restorable in principle, sign-in remains blocked).
4. After grace: full purge — items, aliases, locations, events, conversations, messages, preferences deleted; audit events retained 12 months, anonymized (BR-08).
5. Audit events `ACCOUNT_DELETE_REQUESTED` / completion recorded; purge failure → retried job + alarm (per OBSERVABILITY.md).

**Alternate flows:**
- A1. *Export only:* user leaves after step 3 of export; no deletion.
- A2. *Cancel during grace:* not exposed as a product feature in MVP; the grace period exists as a safety buffer for the retention job (documented behavior of FR-014).

**Exception flows:**
- E1. Export for a deleted/blocked account → 401 `UNAUTHENTICATED`.
- E2. Export size cap exceeded → paginated export path (not an error).
- E3. Purge job failure → retried + alarmed; never silently dropped.
