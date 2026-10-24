# SmartHomeAI — Business Rules

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| IDs | `BR-##` (this file owns them; referenced by FRs, API contracts, schema constraints, and tests) |
| FR authority | [FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md) |

**Structure per rule:** the rule (normative), why it exists, *where* it is enforced (service
layer / DB constraint / UI — a rule with no enforcement point is not a rule), and the FRs it
governs. The UI is never the *only* enforcement point for a rule that protects data or
privacy; UI mentions below are the user-visible companion of a server-side control.

---

## Index

| ID | Rule (one line) | Related FRs |
|---|---|---|
| BR-01 | One owner per record; `ownerId` comes only from the verified token | FR-001, FR-012 |
| BR-02 | Assistant writes require explicit user confirmation and expire after 24 h | FR-024, FR-006 |
| BR-03 | Duplicate item names are allowed per owner, with a warning | FR-002 |
| BR-04 | Location hierarchy depth ≤ 3; sibling names unique per owner (case-insensitive) among non-archived | FR-017, FR-003 |
| BR-05 | A location referenced by items/events cannot be archived (409 with counts) | FR-017, FR-016 |
| BR-06 | Location events are append-only; corrections append new events | FR-004, FR-011 |
| BR-07 | Soft-deleted items are restorable for 30 days, then purged by the retention job | FR-016 |
| BR-08 | Account deletion: immediate soft-delete + sign-in block, 7-day grace, then full purge; audit events retained 12 months anonymized | FR-014 |
| BR-09 | Conversation content is never logged; user-initiated conversation deletion hard-deletes messages immediately | FR-023, FR-006 |
| BR-10 | Item images (P1): ≤ 1 per item, ≤ 5 MB, jpeg/png/webp only, never sent to the LLM in MVP | FR-025 |
| BR-11 | No production data in non-production environments | FR-014, FR-022 (context), all |
| BR-12 | Assistant usage caps: 20 requests/min and 100 messages/day per user, enforced server-side | FR-006, FR-024 |

---

### BR-01 — One owner per record; `ownerId` from the verified token

| Field | Value |
|---|---|
| Rule | Every user-scoped record has exactly one owner. The `ownerId` used in any operation is derived **only** from the server-verified JWT (`sub`) — never from request bodies, query parameters, or client state. |
| Rationale | Identity is the isolation boundary of the product (BO-1); trusting a client-supplied owner ID would make cross-tenant writes trivial (risk R-04). |
| Enforcement point | **Service layer** — JWT verification (JWKS) in the request guard, `ownerId` injection into every repository query. **DB constraint** — `owner_id` NOT NULL FK on every user-scoped table (DATABASE_SCHEMA §3). **UI** — never receives or sends owner IDs for scoping. |
| Related FRs | FR-001, FR-012 (AC-012-1, AC-012-2) |

### BR-02 — Assistant writes require confirmation and expire after 24 h

| Field | Value |
|---|---|
| Rule | The assistant never writes directly. A write intent (`record_memory`, `correct_record`) produces a persisted `pendingAction` + confirmation card; the write executes only after explicit user Confirm through the same validated services as UI writes, with a fresh ownership check at confirmation time. Pending actions expire after 24 hours and are **never** auto-executed. |
| Rationale | Users must see exactly what will be stored (D7 write rule, product principle 1); limits blast radius of extraction errors and prompt-injection attempts (risk R-02); assumption A-6 accepts the extra tap. |
| Enforcement point | **Service layer** — confirmation endpoint re-validates ownership, entity rules, and expiry (confirm on expired/unknown → 409 `CONFLICT`). **DB** — `pendingAction.expiresAt` stored on the message row; no write path exists that skips validation. **UI** — confirmation card with Confirm/Cancel and optional overrides (FR-024.3). |
| Related FRs | FR-024, FR-006, FR-011 (AC-024-1..3) |

### BR-03 — Duplicate item names allowed per owner, with a warning

| Field | Value |
|---|---|
| Rule | Two items for the same owner may share the same normalized name. Creation proceeds, but the UI surfaces a duplicate-name warning (suggesting the existing item) before the user commits. |
| Rationale | Households genuinely have repeats ("Charger" × 2); hard uniqueness would block legitimate records — unlike locations, where ambiguity actively breaks recall. Warning preserves the disambiguation nudge without a blocking rule. |
| Enforcement point | **Service layer** — normalized-name duplicate check feeding a non-blocking warning flag on the create/validate response. **DB** — index `(owner_id, name)` supports the check; **no** unique constraint on item names. **UI** — inline warning with a link to the existing item. |
| Related FRs | FR-002 (AC-002-1) |

### BR-04 — Location hierarchy depth ≤ 3; sibling uniqueness per owner

| Field | Value |
|---|---|
| Rule | The location hierarchy is capped at depth 3. Among non-archived locations of the same owner sharing the same parent (including root), names must be unique case-insensitively. |
| Rationale | Assumption A-5: three levels covers most homes ("Home / Bedroom / Drawer"); deeper trees invite inconsistent naming and slow pickers. Sibling uniqueness is what makes "the drawer" resolvable — hence it conflicts (409) where item duplicates merely warn (BR-03). |
| Enforcement point | **Service layer** — depth re-validated on create *and* re-parent, inside a transaction with the uniqueness check (400 `VALIDATION_ERROR` for depth, 409 `CONFLICT` for duplicate sibling). **DB constraint** — partial unique indexes `ux_locations_sibling_named` / `ux_locations_sibling_root` on `(owner_id, parent_id, lower(name)) WHERE archived_at IS NULL` (DATABASE_SCHEMA §3.4). **UI** — picker shows depth and sibling names. |
| Related FRs | FR-017, FR-003 (AC-017-1, AC-017-2) |

### BR-05 — Referenced locations cannot be archived

| Field | Value |
|---|---|
| Rule | A location referenced by any active item or location event cannot be archived. The attempt returns 409 `CONFLICT` including `referencedByItems` and `referencedByEvents` counts, with an explicit user-facing message; nothing is archived. |
| Rationale | Archiving a referenced location would silently break pickers, history display, and "last recorded" derivations — destroying the memory's coherence. The counts tell the user *what to fix* (move items, or unarchive). |
| Enforcement point | **Service layer** — reference check before archiving (transaction). **DB** — FK `item_location_events.location_id` (CASCADE on purge) and `locations.parent_id` (RESTRICT) make references durable; the archive guard itself is application-enforced. **UI** — archive action surfaces the 409 message with counts. |
| Related FRs | FR-017, FR-016, FR-003 (AC-017-3, AC-003-2) |

### BR-06 — Location events are append-only

| Field | Value |
|---|---|
| Rule | `ItemLocationEvent` rows are never updated or deleted by application features. Corrections append a **new** event; the history is the record. (Retention/purge jobs for soft-deleted items and account purge are the only exception, governed by BR-07/BR-08.) |
| Rationale | History *is* the memory: overwriting destroys recall and makes the system untrustworthy (FR-004 rationale, JTD-4). Append-only also makes the audit story simple — no update path to secure. |
| Enforcement point | **Service layer** — no update/delete methods exist for events; corrections call the same append path as first-time records. **DB** — schema has no mutation endpoint in the API (`EventDto` is a read-only projection; API_SPEC §3.4); invariants asserted by UT-004-1 (append-only invariant) and code review. **UI** — timeline is read-only; "correct" actions create new events. |
| Related FRs | FR-004, FR-011 (AC-004-1, AC-004-2, AC-011-1) |

### BR-07 — Soft-deleted items restorable 30 days, then purged

| Field | Value |
|---|---|
| Rule | Deleting an item sets `deletedAt` (soft delete). The item is excluded from lists, search, and assistant retrieval immediately, but restorable within **30 days**; after the window the retention job hard-deletes it (cascading its events). Restore attempts after purge → 404. |
| Rationale | Destructive actions must be cheap to reverse (reduces fear of recording) while data cannot accumulate forever. Immediate *exclusion* honors the user's intent to remove it from view without lying about deletion semantics. |
| Enforcement point | **Service layer** — soft-delete flag set on confirm; all read paths filter `deleted_at`; restore validates the 30-day window. **DB** — `items.deleted_at` column + list-scoping index `(owner_id, deleted_at, archived_at)`; hard delete only from the retention job. **UI** — confirmation dialog, "Restore" affordance within the window. |
| Related FRs | FR-016 (AC-016-1, AC-016-2) |

### BR-08 — Account deletion lifecycle and audit retention

| Field | Value |
|---|---|
| Rule | Account deletion: (1) confirmed request → immediate **soft-delete** of the user (`deletedAt`) + **sign-in blocked**, data hidden; (2) **7-day grace period**; (3) then **full purge** — items, aliases, locations, events, conversations, messages, preferences; (4) **audit events are retained 12 months, anonymized** (not purged with the user). Requests are idempotent; deletion request and completion emit audit events. |
| Rationale | Immediate blocking honors the user's request even before irreversible destruction; the grace period protects against mistaken/burner-triggered deletions and gives failed purge jobs a retry runway; anonymized audit retention keeps the security trail intact without keeping personal data (JTD-5, FR-014). |
| Enforcement point | **Service layer** — deletion request endpoint (idempotent) + middleware sign-in block for soft-deleted users; purge as a scheduled job with retry + alarm. **DB** — `users.deleted_at`; purge via `users` row deletion (FK CASCADE); `audit_events` excluded from purge and anonymized. **UI** — Settings deletion flow with confirmation and export offered first. |
| Related FRs | FR-014, FR-001, FR-022 (AC-014-1, AC-014-2) |

### BR-09 — Conversation content is never logged; user deletion is immediate

| Field | Value |
|---|---|
| Rule | Conversation/message **content** never appears in application logs, metrics, or traces — only metadata (intent, model, latency, token counts, IDs, status). When the user deletes a conversation, its messages are **hard-deleted immediately** (no retention window). |
| Rationale | Message text is the most sensitive free-form data in the product (item names, whereabouts, routines). Logging it would recreate the privacy leak the product promises to avoid (R-02/PRD §14 privacy stance). Immediate hard delete makes the privacy control real rather than nominal. |
| Enforcement point | **Service layer** — redaction-tested logger that accepts structured metadata only; delete endpoint removes conversation + messages in one transaction (events created from those messages keep `message_id = NULL`). **DB** — deletion by FK CASCADE from conversation. **UI** — conversation list exposes Delete with confirmation. |
| Related FRs | FR-023, FR-006, FR-007 (AC-023-2, AC-007-1); NFR-007 |

### BR-10 — Item image constraints (P1)

| Field | Value |
|---|---|
| Rule | When images ship (P1): at most **1 image per item**, max **5 MB**, formats **jpeg/png/webp** only, uploaded via presigned S3 URL; images are **never sent to the LLM** in the MVP; deleting the image deletes the object. |
| Rationale | Visual recall is the goal ("the blue bag"), not an asset-management feature — one image bounds storage cost (BO-3) and cognitive load; type/size caps bound attack surface; excluding images from the LLM keeps the grounding contract simple (text-only context) and cost predictable. |
| Enforcement point | **Service layer** — presigned-URL issuance validates size/type constraints and ownership; follow-up `PATCH` confirms attachment. **DB** — single image reference per item row. **UI** — upload widget enforces the same limits for fast feedback (server remains authoritative). *Note: image bytes go client → S3 directly; the presign endpoint is the enforcement point.* |
| Related FRs | FR-025 (AC-025-1) |

### BR-11 — No production data in non-production environments

| Field | Value |
|---|---|
| Rule | Production data must never exist in local, dev, or staging environments. Non-production datasets are synthetic/seeded only. |
| Rationale | Cheapest possible breach prevention: a leaked staging DB or a laptop copy contains nothing real; also keeps backup/cost accounting clean. |
| Enforcement point | **Operational policy** enforced by **service layer/deploy** — environment-scoped configuration, seed-only databases, no prod→staging data copies; verified at the security review gate and by inspection of seed scripts. **UI** — environments visibly labeled. |
| Related FRs | Context for all FRs (esp. FR-014, FR-022); NFR-006, NFR-013 |

### BR-12 — Assistant usage caps

| Field | Value |
|---|---|
| Rule | Per user: **20 assistant requests per minute** and **100 assistant messages per day**, enforced **server-side**. Exceeding a cap returns 429 `RATE_LIMITED` with `Retry-After`. (General endpoint rate limits — writes 60/min, reads 120/min per API_SPEC §1 — are complementary, not a substitute.) |
| Rationale | Protects the budget and the LLM provider quota (BO-3, R-03/R-05): unbounded assistant traffic is the main cost driver, and server-side enforcement is the only kind that counts (client-side limits are advisory). |
| Enforcement point | **Service layer** — token-bucket limiter keyed by user + route class, checked before any provider call; counters carry **no content**. **DB** — not involved (ephemeral counters). **UI** — friendly throttle message on 429. |
| Related FRs | FR-006, FR-024 (AC-006-2 context, 429 `RATE_LIMITED`); NFR-011 |

---

## Cross-references

- FR ↔ rule mapping beyond this file: [../planning/TRACEABILITY_MATRIX.md](../planning/TRACEABILITY_MATRIX.md)
- Status codes referenced above: [../architecture/API_SPEC.md](../architecture/API_SPEC.md) §2
- Retention jobs and purge mechanics: [../architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) §4, [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md)
- Behavior expressed as testable checks: [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)
