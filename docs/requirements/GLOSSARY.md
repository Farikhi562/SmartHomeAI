# SmartHomeAI — Glossary

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Scope | Shared terminology for all SmartHomeAI documents; alphabetical — when a term here conflicts with a canonical document, the canonical document wins and this entry is corrected |

**Related column** points to functional requirements
([FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md)), business rules
([BUSINESS_RULES.md](BUSINESS_RULES.md)), or other documents by relative path from this
file. Terms are listed case-insensitively alphabetically.

---

| Term | Definition | Related FR / docs |
|---|---|---|
| **Alias** | An alternative name a user attaches to an item so search and the assistant recognize the item under a different phrasing ("U-lock" → "Bike lock"). Normalized (lowercase/trimmed), unique per owner, included in search and assistant retrieval. | FR-019 (P1); `item_aliases` in [../architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) §3.3 |
| **Append-only event** | A record that can only ever be created, never updated or deleted by application features. SmartHomeAI's location events are append-only: corrections append a *new* event instead of editing the old one. | FR-004; BR-06; [../architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) §3.5 |
| **Archived item** | An item flagged `archivedAt`: hidden from default views and pickers but retained in full (including events) and restorable. Distinct from a soft-deleted item, which is excluded from search/retrieval too. | FR-016; BR-07 (deletion), BR-05 (locations) |
| **Assistant (AI memory assistant)** | The natural-language interface of the product: classifies intent, retrieves the user's authorized records server-side, and generates a reply that explains those records. It never invents facts and never writes without user confirmation. | FR-006–FR-010, FR-024; [../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) |
| **CONFIRMED** | The `confidence` value marking a location event recorded as a direct user statement ("I put it there"). The counterpart `INFERRED` marks machine-derived placement assumptions; the UI must display them distinctly. | FR-004; `confidence` enum in [../architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) §3.5 |
| **Conversation** | A persisted thread of user and assistant messages belonging to one owner, with a last-activity timestamp. Users can start a new one or delete one — deletion hard-deletes its messages immediately. | FR-023; BR-09 |
| **Grounding** | The principle that every factual claim in an assistant reply maps to records retrieved from the database for the authenticated owner — the LLM explains retrieved facts, it never supplies them. | FR-007, FR-008; product principle 1 in [../product/PRD.md](../product/PRD.md) §3 |
| **Grounding validation** | The automated post-generation check that each cited record ID exists in the retrieved set; violations are intercepted and the reply is replaced with a safe fallback (metric `ai.ungrounded_detected`). | FR-010; [../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) (validate step) |
| **INFERRED** | The `confidence` value for an automatically derived placement (reserved for future auto-tracking in MVP terms). No MVP feature writes `INFERRED` events; if shown, they are visually distinguished from `CONFIRMED` ones. | FR-004, FR-029 (P2); product principle 2 |
| **Item** | The core record: a personal belonging owned by exactly one user, with `name` (1–120 chars), optional description/category, plus lifecycle flags (archived, soft-deleted) and provenance (`createdVia: USER`/`ASSISTANT`). | FR-002, FR-016 |
| **Last recorded location** | The location of an item's **newest event by `occurredAt`** — derived at read time, never stored on the item. The answer format for "where is X". | FR-003, FR-008; derivation rule in [../architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) §3.5 |
| **Last recorded location caveat (disclaimer)** | The mandatory statement that an answer reflects the last *recorded* placement and the item **may have moved since** — the product never claims real-time physical position. | FR-008; [../product/PRODUCT_VISION.md](../product/PRODUCT_VISION.md) §6 |
| **Location** | A place in the user's hierarchy (name 1–80 chars, optional parent, depth ≤ 3), e.g. "Home / Bedroom / Drawer". Sibling names are unique per owner (case-insensitive) among non-archived locations; locations are archived, not deleted, while referenced. | FR-017; BR-04, BR-05 |
| **Location event** | An `ItemLocationEvent`: the append-only fact "item X was placed at location Y", carrying `occurredAt`, `recordedAt`, `source`, `confidence`, optional note. The atomic unit of memory. | FR-003, FR-004; BR-06 |
| **Memory (product sense)** | The product's meaning of memory: the accumulated, queryable set of a user's recorded facts (items, locations, events) plus the ability to recall them — not model training, not background observation, not a chatbot's context window. | [../product/PRODUCT_VISION.md](../product/PRODUCT_VISION.md) §1; PRD §1 |
| **MVP** | The minimum viable product = all **P0** functional requirements (FR-001–FR-013, FR-015–FR-017, FR-023, FR-024) plus the release criteria in PRD §17. P1/P2 are explicitly outside it. | [../product/PRD.md](../product/PRD.md) §8; [../product/ROADMAP.md](../product/ROADMAP.md) §1 |
| **occurredAt** | *When the user says the placement happened* — user-truth, may be backdated (e.g. "since yesterday"), rejected if beyond now + 5 min skew. | FR-004; BR-06 context |
| **Owner / ownerId** | The single user a record belongs to; always derived from the verified JWT `sub`, never from request payloads. Every query is scoped by it. | FR-012; BR-01; [../architecture/API_SPEC.md](../architecture/API_SPEC.md) §1 |
| **pendingAction** | A structured write proposal created by the assistant (type, item, location, occurredAt, `expiresAt` +24 h) that exists **before** any write; executes only on explicit user confirm, never automatically. | FR-024; BR-02; API_SPEC §3.6 |
| **Prompt injection** | An attempt to manipulate the LLM via stored or typed text (e.g. a hostile item name) to leak data or force writes. Mitigations: untrusted-content delimiters, authorization outside the LLM, bounded context, and user-confirmed writes. | R-02; FR-012, FR-024; [../architecture/SECURITY.md](../architecture/SECURITY.md) |
| **recordedAt** | *When the system stored the record* — server-set at insert, never updated; distinct from `occurredAt`. Both timestamps appear on every location event. | FR-004; DATABASE_SCHEMA §3.5 |
| **Retrieval** | The server-side, owner-scoped step that gathers matching records (≤ 20 records, ~4k tokens) **before** any LLM call, using deterministic search (FTS + `pg_trgm`), and serializes them with stable IDs as the only allowed source of facts. | FR-005, FR-007; D6 |
| **Soft delete** | Setting `deletedAt` instead of removing a row: the record disappears from lists, search, and assistant retrieval immediately, but stays restorable for a defined window (items: 30 days, BR-07; users: 7-day grace, BR-08). | FR-016, FR-014; BR-07, BR-08 |
| **Source (MANUAL / ASSISTANT)** | Provenance of a location event: `MANUAL` when recorded through the UI, `ASSISTANT` when written via a confirmed assistant action (or item `createdVia`). Stored server-side — never client-supplied. | FR-004, FR-024; API_SPEC §3.3 |
| **Traceability matrix** | The PRD → FR → US → AC → API → DB → task → test mapping that proves every P0 requirement reaches an automated test with zero gaps. | [../planning/TRACEABILITY_MATRIX.md](../planning/TRACEABILITY_MATRIX.md); PRD §17 |
| **Zero-fabrication** | The hard rule and release gate that assistant replies contain no invented item names, locations, timestamps, or IDs; if no record matches, the assistant says so. Fabrication rate target: 0%. | FR-010; PRD §14, §17; product principle 1 |

---

*Terms are added here only when they are shared across three or more documents; everything
else is defined where it is used.*
