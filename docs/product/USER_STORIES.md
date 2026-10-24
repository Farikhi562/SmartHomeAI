# SmartHomeAI — User Stories

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Canonical FRs | [FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md) — stories never change FR semantics |
| Canonical ACs | [ACCEPTANCE_CRITERIA.md](../requirements/ACCEPTANCE_CRITERIA.md) |

**Conventions:** `US-###` IDs are stable (never reused). One story per FR (or FR group) as
mapped below; priority mirrors the FR priority (P0 = MVP blocker, P1 = fast-follow,
P2 = roadmap only). AC references use the exact IDs defined in
[ACCEPTANCE_CRITERIA.md](../requirements/ACCEPTANCE_CRITERIA.md).

---

## Index

| ID | Short title | Priority | FR refs | AC refs |
|---|---|---|---|---|
| US-001 | Register and sign in securely | P0 | FR-001 | AC-001-1..4 |
| US-002 | Create an item | P0 | FR-002 | AC-002-1..3 |
| US-003 | Edit an item | P0 | FR-002 | AC-002-1..3 |
| US-004 | Associate an item with a location | P0 | FR-003 | AC-003-1..2 |
| US-005 | Record location changes as history | P0 | FR-004 | AC-004-1..3 |
| US-006 | Search items and locations | P0 | FR-005 | AC-005-1..3 |
| US-007 | Ask where something is and get a grounded answer | P0 | FR-006, FR-007, FR-008 | AC-006-1..2, AC-007-1..2, AC-008-1..2 |
| US-008 | Get a clarification question when my ask is ambiguous | P0 | FR-009 | AC-009-1..2 |
| US-009 | Trust that the assistant never fabricates records | P0 | FR-010 | AC-010-1..2 |
| US-010 | Correct an incorrect record | P0 | FR-011 | AC-011-1..2 |
| US-011 | Know that only I can see my data | P0 | FR-012 | AC-012-1..2 |
| US-012 | Keep working when the AI provider is down | P0 | FR-013 | AC-013-1..2 |
| US-013 | Delete my records per the retention policy | P1 | FR-014 | AC-014-1..2 |
| US-014 | See a useful dashboard overview | P0 | FR-015 | AC-015-1..2 |
| US-015 | Soft-delete and archive items | P0 | FR-016 | AC-016-1..2 |
| US-016 | Create and manage locations | P0 | FR-017 | AC-017-1..3 |
| US-017 | Browse a recent activity timeline | P1 | FR-018 | AC-018-1 |
| US-018 | Add aliases (nicknames) to items | P1 | FR-019 | AC-019-1 |
| US-019 | Find items despite typos | P1 | FR-020 | AC-020-1 |
| US-020 | Set my preferences (theme, suggestions) | P1 | FR-021 | AC-021-1 |
| US-021 | Export my data | P1 | FR-022 | AC-022-1 |
| US-022 | Keep and reset my conversations | P0 | FR-023 | AC-023-1..2 |
| US-023 | Confirm or cancel assistant-proposed writes | P0 | FR-024 | AC-024-1..3 |
| US-024 | Add a photo to an item | P1 | FR-025 | AC-025-1 |
| US-025 | Use voice to ask and record | P2 | FR-026 | — (P2, no ACs enumerated in MVP) |
| US-026 | Scan a QR/NFC label to open an item | P2 | FR-027 | — |
| US-027 | Share an inventory with my household | P2 | FR-028 | — |
| US-028 | Connect smart-home/IoT tracking | P2 | FR-029 | — |
| US-029 | Get guided onboarding as a new user | P1 | FR-030 | AC-030-1 |

---

## P0 stories

### US-001 — Register and sign in securely

| Field | Value |
|---|---|
| Role | Authenticated user (any persona) |
| Statement | As a user, I want to register, sign in, stay signed in, and recover my password securely, so that my records are private to me and reachable only by me |
| Business value | Identity is the isolation boundary for the whole product; without it there is no trust and no data model (BO-1) |
| Priority | P0 |
| FR refs | FR-001 |
| AC refs | AC-001-1, AC-001-2, AC-001-3, AC-001-4 |
| Notes | Supabase Auth-managed flows (D5, ADR-005), proxied through our `/api/auth/*` routes (httpOnly session cookie); JWT verified server-side (HS256, `SUPABASE_JWT_SECRET`, issuer/audience checks); `ownerId` always from token `sub` (BR-01). Password recovery and email confirmation per Supabase Auth configuration; generic errors, no account enumeration |

### US-002 — Create an item

| Field | Value |
|---|---|
| Role | Inventory owner (P1, P2, P3) |
| Statement | As a user, I want to record a new belonging with a name, optional description and category, so that it exists in my inventory for future recall |
| Business value | Items are the core record type — without creation there is no product; directly feeds the activation metric (≥ 1 item in 24 h) |
| Priority | P0 |
| FR refs | FR-002 (create) |
| AC refs | AC-002-1, AC-002-2, AC-002-3 |
| Notes | `name` 1–120 chars (Zod → 400 `VALIDATION_ERROR`); optional `locationId` creates the first location event; duplicate names allowed with a warning (BR-03); items created via the assistant carry source `ASSISTANT` |

### US-003 — Edit an item

| Field | Value |
|---|---|
| Role | Inventory owner (P2 especially) |
| Statement | As a user, I want to fix or update an item's details at any time, so that the inventory stays accurate without disturbing my history |
| Business value | Correction is a trust requirement (JTD-4); edits must never rewrite history — history *is* the memory |
| Priority | P0 |
| FR refs | FR-002 (edit) |
| AC refs | AC-002-1, AC-002-2, AC-002-3 |
| Notes | `PATCH /api/items/:id` never touches events (API_SPEC §3.2); `updatedAt` refreshed; not-owned → 404, never existence leak. Shares ACs with US-002 because both are governed by the same validation and ownership rules |

### US-004 — Associate an item with a known location

| Field | Value |
|---|---|
| Role | Inventory owner |
| Statement | As a user, I want to say where I just put an item by picking a location I know, so that "where is X" has an answer |
| Business value | Creates the item→location link that every recall flow depends on; the cheapest capture moment (JTD-2) |
| Priority | P0 |
| FR refs | FR-003 |
| AC refs | AC-003-1, AC-003-2 |
| Notes | Location picker shows the hierarchy; free-text offers create-inline; archived location blocked with "unarchive or pick another"; last recorded location is *derived* from the newest event, never stored |

### US-005 — Record location changes as history

| Field | Value |
|---|---|
| Role | Inventory owner (P2 especially) |
| Statement | As a user, I want each new placement to be appended to an unchangeable history with when it happened and when I recorded it, so that I can see the trail of past places |
| Business value | History preservation is the difference between a memory system and a mutable note (JTD-4, product principle 1) |
| Priority | P0 |
| FR refs | FR-004 |
| AC refs | AC-004-1, AC-004-2, AC-004-3 |
| Notes | Append-only events: `occurredAt` (user-truth, backdatable, ≤ now + 5 min skew) vs `recordedAt`; `source` MANUAL/ASSISTANT; `confidence` CONFIRMED/INFERRED; corrections append a new event (BR-06) |

### US-006 — Search items and locations

| Field | Value |
|---|---|
| Role | Inventory owner (P2 especially) |
| Statement | As a user, I want to find things quickly with search, filters, and sorting, so that I can jog my memory without AI (JTD-3) |
| Business value | Deterministic recall works even when the LLM is down — it is also the assistant fallback path, so one feature de-risks two |
| Priority | P0 |
| FR refs | FR-005 |
| AC refs | AC-005-1, AC-005-2, AC-005-3 |
| Notes | PostgreSQL FTS + `pg_trgm` (D6); ranking exact > prefix > fuzzy > full-text; archived demoted; owner-scoped; empty state with suggestions; query < 2 chars → no-op prompt |

### US-007 — Ask where something is and get a grounded answer

| Field | Value |
|---|---|
| Role | Assistant user (P1's primary flow) |
| Statement | As a user, I want to ask "where did I last put my motorcycle keys?" in plain language and get an answer grounded in my records — with the location, the time, and an honest caveat — so that I stop searching blindly (JTD-1) |
| Business value | The core differentiator: conversational recall. Every answer carries citations into the inventory, so the answer is verifiable rather than another thing to trust on faith |
| Priority | P0 |
| FR refs | FR-006 (asking), FR-007 (retrieval before generation), FR-008 (last recorded location + timestamp + caveat + citations) |
| AC refs | AC-006-1, AC-006-2, AC-007-1, AC-007-2, AC-008-1, AC-008-2 |
| Notes | Message ≤ 2000 chars; intents include `lookup_location`, `list_contents`, `search_fuzzy`, `chit_chat`, `help`, `unknown`; retrieval is server-side, owner-scoped, bounded (≤ 20 records / ~4k tokens) and runs *before* any LLM call; UI visually distinguishes recorded facts from inferences |

### US-008 — Get a clarification question when my ask is ambiguous

| Field | Value |
|---|---|
| Role | Assistant user |
| Statement | As a user with two similar items, I want the assistant to ask me which one I mean instead of guessing, so that I never act on a wrong answer |
| Business value | Wrong guesses destroy trust; asking is cheap. Tappable candidate options keep the flow fast for P1 and honest for P3 |
| Priority | P0 |
| FR refs | FR-009 |
| AC refs | AC-009-1, AC-009-2 |
| Notes | Ambiguity = top candidate not meaningfully above runner-up (configurable margin); max 2 clarification rounds → then offer deterministic search link; re-classify if the answer is itself ambiguous |

### US-009 — Trust that the assistant never fabricates records

| Field | Value |
|---|---|
| Role | Assistant user (all personas; P3's trust gate) |
| Statement | As a user, I want the assistant to say "no record found" rather than invent an item, place, or timestamp, so that I can rely on what it does say |
| Business value | Zero fabrication is an explicit release gate (BO-2, PRD §17): one invented fact collapses trust in every answer |
| Priority | P0 |
| FR refs | FR-010 |
| AC refs | AC-010-1, AC-010-2 |
| Notes | Grounding validation: answer claims must map to retrieved record IDs or be flagged as inference; ungrounded output → safe fallback answer + metric `ai.ungrounded_detected` |

### US-010 — Correct an incorrect record

| Field | Value |
|---|---|
| Role | Inventory owner (P2's trust loop) |
| Statement | As a user, I want to correct a wrong name or a wrong location — including via the assistant — while keeping what was recorded before, so that the system stays trustworthy (JTD-4) |
| Business value | Records drift out of date; correction without history loss is what makes users keep feeding the system |
| Priority | P0 |
| FR refs | FR-011 |
| AC refs | AC-011-1, AC-011-2 |
| Notes | Wrong location → append a new event (never edit the old one); assistant `correct_record` intent goes through the same confirmation path (FR-024); every assistant answer links to the item so correction is one click away |

### US-011 — Know that only I can see my data

| Field | Value |
|---|---|
| Role | Privacy-conscious user (P3, BO-1) |
| Statement | As a user, I want every protected operation checked server-side against my identity, so that my records are never readable or writable by anyone else — including via crafted URLs or payloads |
| Business value | Cross-tenant exposure is the top privacy risk (R-04); it would end the product |
| Priority | P0 |
| FR refs | FR-012 |
| AC refs | AC-012-1, AC-012-2 |
| Notes | JWT verified and `ownerId` derived from `sub` — never from body/query (BR-01); all repository queries owner-scoped; "not mine" ≡ "not found" (404); enforcement in the service layer, independent of UI state; assistant retrieval and write paths use identical scoping |

### US-012 — Keep working when the AI provider is down

| Field | Value |
|---|---|
| Role | Any authenticated user |
| Statement | As a user, I want items, locations, search, dashboard, and history to work fully even when the LLM provider fails, so that a third-party outage never blocks my inventory |
| Business value | Graceful degradation protects the core value (product principle 5) and de-risks the Groq dependency (A-4, R-03) |
| Priority | P0 |
| FR refs | FR-013 |
| AC refs | AC-013-1, AC-013-2 |
| Notes | Timeouts (15 s) + bounded retries (2, exponential, 429/5xx/network only) → clear error state with retry and a link to deterministic search results for the same query; degradation observable via `ai.fallback` metric without logging content |

---

## P1 stories

### US-013 — Delete my records per the retention policy

| Field | Value |
|---|---|
| Role | Privacy-conscious user (P3; JTD-5) |
| Statement | As a user, I want to delete my account and data according to a documented retention policy, so that I stay in control when I leave the platform |
| Business value | Exit promise is a trust prerequisite; without it privacy-sensitive users never start (BO-1) |
| Priority | P1 |
| FR refs | FR-014 |
| AC refs | AC-014-1, AC-014-2 |
| Notes | Confirmation → soft-delete + sign-in blocked → 7-day grace → full purge (items, aliases, locations, events, conversations, messages, preferences; audit events anonymized); export offered before deletion; requests idempotent; deletion emits audit events (BR-08) |

### US-014 — See a useful dashboard overview

| Field | Value |
|---|---|
| Role | Returning user (all personas) |
| Statement | As a user, I want a dashboard of counts, recently updated items, recent recorded locations, quick search, an AI entry point, and quick actions, so that I can start any task from one screen |
| Business value | The dashboard is the product's home surface (C-6, product principle 3) and the launchpad for capture and recall |
| Priority | P0 |
| FR refs | FR-015 |
| AC refs | AC-015-1, AC-015-2 |
| Notes | Only counts derivable from stored data — no invented metrics; new users get an onboarding empty state; partial card failures render remaining cards with an inline retry |

### US-015 — Soft-delete and archive items

| Field | Value |
|---|---|
| Role | Inventory owner (P2 clutter control; P3 exit-lite) |
| Statement | As a user, I want to remove clutter with confirmation and undo, so that deleting is safe and never destroys history instantly |
| Business value | Lowers the risk of recording anything — users who fear irreversible deletion record less |
| Priority | P0 |
| FR refs | FR-016 |
| AC refs | AC-016-1, AC-016-2 |
| Notes | Destructive-action dialog → `deletedAt`; excluded from lists/search/assistant retrieval; restorable ≤ 30 days (BR-07), then purged by retention job; archived items hidden from default views but restorable; history intact for restore |

### US-016 — Create and manage locations

| Field | Value |
|---|---|
| Role | Household organizer (P2's primary structure tool) |
| Statement | As a user, I want to create, rename, re-parent, and archive locations in a shallow hierarchy, so that items have a dependable address system |
| Business value | Locations are the other half of the memory model; structure is what makes recall scale past a handful of items |
| Priority | P0 |
| FR refs | FR-017 |
| AC refs | AC-017-1, AC-017-2, AC-017-3 |
| Notes | Name 1–80 chars; depth ≤ 3 and sibling uniqueness (case-insensitive, non-archived) per BR-04 → 409 `CONFLICT` on duplicate; archive blocked while referenced → 409 with counts (BR-05); pickers hide archived |

---

## P1 stories (continued)

### US-017 — Browse a recent activity timeline

| Field | Value |
|---|---|
| Role | Cross-item viewer (P2's "what changed" scan) |
| Statement | As a user, I want a chronological feed of location events and item changes over the last 30 days, so that I can see what moved without opening every item |
| Business value | Most-recently-used recall pattern; makes the append-only history (US-005) visible and useful across items |
| Priority | P1 |
| FR refs | FR-018 |
| AC refs | AC-018-1 |
| Notes | Paginated, filterable by type; each entry links item + location; served by `GET /api/activity` (API_SPEC §3.5) |

### US-018 — Add aliases (nicknames) to items

| Field | Value |
|---|---|
| Role | User with verbal recall habits (P1: "the big camera") |
| Statement | As a user, I want to attach alternative names to an item, so that search and the assistant find it however I phrased it |
| Business value | People use many names for one thing; aliases close the phrasing gap that causes "not found" answers |
| Priority | P1 |
| FR refs | FR-019 |
| AC refs | AC-019-1 |
| Notes | Normalized, unique per owner (DB unique `(owner_id, normalized_alias)`); collisions warn but allow; included in search + assistant retrieval; schema exists in MVP, feature is P1 (DATABASE_SCHEMA §3.3) |

### US-019 — Find items despite typos

| Field | Value |
|---|---|
| Role | Fast/rough typer (P1, mobile users) |
| Statement | As a user, I want fuzzy matching and "did you mean" suggestions, so that a typo does not turn into "no results" |
| Business value | Reduces false-empty results, the most common search abandonment trigger |
| Priority | P1 |
| FR refs | FR-020 |
| AC refs | AC-020-1 |
| Notes | `pg_trgm` similarity ≥ threshold (~0.3), tunable ranking weights; measured against the search eval set; builds directly on FR-005 without changing its contract |

### US-020 — Set my preferences (theme, suggestions)

| Field | Value |
|---|---|
| Role | Any user (P3 dark-theme default) |
| Statement | As a user, I want to choose light/dark/system theme and toggle suggested questions, with settings persisted server-side, so that the product feels right on every device |
| Business value | Comfort + accessibility (dark theme is a stated part of the design direction, D7) with zero per-device reconfiguration |
| Priority | P1 |
| FR refs | FR-021 |
| AC refs | AC-021-1 |
| Notes | `GET/PATCH /api/preferences`; defaults created on demand; theme default LIGHT (DATABASE_SCHEMA §3.7); locale field reserved but English-only in MVP (A-3) |

### US-021 — Export my data

| Field | Value |
|---|---|
| Role | Privacy-conscious user (P3; JTD-5) |
| Statement | As a user, I want to download a JSON file of my items, aliases, locations, events, and (optionally) conversations, so that my data is portable and my exit is real |
| Business value | Data portability is a trust feature and a regulatory-sane default; supports the deletion flow (FR-014) |
| Priority | P1 |
| FR refs | FR-022 |
| AC refs | AC-022-1 |
| Notes | `GET /api/export` for the authenticated owner only; audit event recorded; size-limited ≤ 10 MB then paginated; `includeConversations=false` by default (content minimization) |

### US-029 — Get guided onboarding as a new user

| Field | Value |
|---|---|
| Role | Brand-new user (P3's make-or-break) |
| Statement | As a new user, I want a ≤ 3-step guided first run — create first locations with suggestions, add first item, try an example question — skippable and never repeated, so that I reach value in under 2 minutes |
| Business value | Directly drives the activation metric (≥ 50% create item + location within 24 h) |
| Priority | P1 |
| FR refs | FR-030 |
| AC refs | AC-030-1 |
| Notes | Depends on FR-015 empty states; reuses the same validated services as normal creation (no separate onboarding data path) |

---

## P2 stories (roadmap only — no implementation in this plan)

### US-025 — Use voice to ask and record

| Field | Value |
|---|---|
| Role | Hands-full user (cooking, commuting) |
| Statement | As a user, I want to speak questions and placements, so that capture works when typing is impractical |
| Business value | Removes the last major capture-friction moment; separate integration (Groq Whisper candidate noted in FR-026) |
| Priority | P2 |
| FR refs | FR-026 |
| AC refs | None in MVP — ACs are minted when the FR enters an implementation release |
| Notes | Entry criteria in [ROADMAP.md](ROADMAP.md); no AC/test IDs reserved until then |

### US-026 — Scan a QR/NFC label to open an item

| Field | Value |
|---|---|
| Role | Physical-organizer user (P2's "label everything" mode) |
| Statement | As a user, I want to scan a label on a box or drawer to open its record, so that recording happens where the object lives |
| Business value | Contextual capture; requires camera flows + label printing (per FR-027 notes) |
| Priority | P2 |
| FR refs | FR-027 |
| AC refs | None in MVP |
| Notes | Enters scope only per roadmap entry criteria (ADR + PRD revision) |

### US-027 — Share an inventory with my household

| Field | Value |
|---|---|
| Role | Household manager (P2 persona's end-state wish) |
| Statement | As a household owner, I want shared inventories with roles and membership, so that the family sees one memory instead of one person's head |
| Business value | Largest potential expansion — but a data-model change with security-review implications (spaces/roles/membership per FR-028) |
| Priority | P2 |
| FR refs | FR-028 |
| AC refs | None in MVP |
| Notes | Contradicts assumption A-2 while it holds; entering scope requires PRD revision + ADR + security review |

### US-028 — Connect smart-home/IoT tracking

| Field | Value |
|---|---|
| Role | Automation enthusiast |
| Statement | As a user, I want optional integrations to suggest placements automatically, so that capture needs no effort |
| Business value | Would remove manual capture entirely — at the cost of provenance rigor: automated `INFERRED` events with explicit opt-in and provenance display (FR-029) |
| Priority | P2 |
| FR refs | FR-029 |
| AC refs | None in MVP |
| Notes | Directly stresses assumption A-1; must never weaken the recorded-vs-physical honesty rules (FR-008, product principle 2) |

---

## Traceability note

The full matrix (PRD → FR → US → AC → API → DB → task → test) lives in
[../planning/TRACEABILITY_MATRIX.md](../planning/TRACEABILITY_MATRIX.md). This file owns the
`US-###` IDs and their FR/AC mapping; any mapping change here requires the matrix to be
updated in the same change set.
