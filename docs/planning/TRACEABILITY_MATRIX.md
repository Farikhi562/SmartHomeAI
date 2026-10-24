# Traceability Matrix — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Chain | PRD → FR → US → AC → API → DB model → Task(s) → Automated tests |
| Rule | Every P0 row must have **no gaps** in any column (release gate, PRD §17) |

Test ID conventions: `UT` unit · `IT` integration · `E2E` end-to-end · `AIE` AI evaluation
(defined in [TEST_PLAN.md](TEST_PLAN.md)). `—` = not applicable; `(P1)` items are not
release-blocking.

---

## P0 requirements

| FR | US | AC | API contract | DB model | Task(s) | Tests |
|---|---|---|---|---|---|---|
| FR-001 Auth | US-001 | AC-001-1..4 | `GET/PATCH /api/me`, Supabase Auth flows (`/api/auth/*`) | `users` | T-022, T-023, T-025 | IT-001-1, IT-001-2, E2E-001-1 |
| FR-002 Item CRUD | US-002, US-003 | AC-002-1..3 | `/api/items` CRUD | `items` | T-032, T-033 | UT-002-1, IT-002-1, E2E-002-1 |
| FR-003 Item↔location | US-004 | AC-003-1..2 | `POST /api/items/:id/events` | `item_location_events` | T-034 | IT-003-1, UT-003-1 |
| FR-004 History append-only | US-005 | AC-004-1..3 | `GET /api/items/:id/events` | `item_location_events` | T-034, T-035 | UT-004-1, IT-004-1 |
| FR-005 Deterministic search | US-006 | AC-005-1..3 | `GET /api/search` | `items`, `locations`, (`item_aliases`) + search indexes | T-040, T-041 | IT-005-1, UT-005-1 |
| FR-006 NL questions | US-007 | AC-006-1..2 | `POST /api/assistant/messages` | `conversations`, `messages` | T-050, T-051, T-054 | IT-006-1, AIE-006-* |
| FR-007 Retrieval before generation | US-007 | AC-007-1..2 | (pipeline, same endpoint) | `item_location_events` via retrieval | T-052, T-053 | IT-007-1, IT-007-2, AIE-007-* |
| FR-008 Location + time + caveat | US-007 | AC-008-1..2 | reply DTO `citations` | `item_location_events` | T-053, T-055 | AIE-008-*, E2E-008-1 |
| FR-009 Clarification on ambiguity | US-008 | AC-009-1..2 | reply DTO `candidates` | retrieval scoring | T-053, T-055 | AIE-009-*, IT-009-1 |
| FR-010 No fabrication | US-009 | AC-010-1..2 | grounding validator | — (validator) | T-053 | AIE-010-*, UT-010-1 |
| FR-011 Corrections | US-010 | AC-011-1..2 | `PATCH /api/items/:id`, `POST …/events`, assistant actions | `items`, `item_location_events` | T-036, T-054 | IT-011-1, E2E-011-1 |
| FR-012 Server-side authz | US-011 | AC-012-1..2 | all endpoints | all (owner scoping) | T-023, T-037 | IT-012-1, E2E-012-1 |
| FR-013 Graceful degradation | US-012 | AC-013-1..2 | 503 `AI_UNAVAILABLE` + fallback | — | T-050, T-057 | IT-013-1, UT-013-1 |
| FR-015 Dashboard | US-014 | AC-015-1..2 | dashboard routes | aggregation over `items`, `item_location_events` | T-042, T-043 | IT-015-1, E2E-015-1 |
| FR-016 Delete/archive item | US-015 | AC-016-1..2 | `DELETE /api/items/:id`, restore/archive | `items.deleted_at/archived_at` | T-032, T-033 | IT-016-1, E2E-016-1 |
| FR-017 Location management | US-016 | AC-017-1..3 | `/api/locations` CRUD + archive | `locations` | T-030, T-031 | IT-017-1, UT-017-1 |
| FR-023 Conversation persistence/reset | US-022 | AC-023-1..2 | `/api/assistant/conversations*` | `conversations`, `messages` | T-054 | IT-023-1, UT-023-1 |
| FR-024 Confirmed writes | US-023 | AC-024-1..3 | `POST /api/assistant/actions/:id/decision` | `messages.pending_action`, `item_location_events` | T-054, T-055 | IT-024-1, IT-024-2, AIE-024-* |

## P1 requirements (tracked, not release-blocking)

| FR | US | AC | API contract | DB model | Task(s) | Tests |
|---|---|---|---|---|---|---|
| FR-014 Account deletion | US-013 | AC-014-1..2 | `DELETE /api/me` | `users.deleted_at`, purge job | T-084, T-088 | IT-014-1, E2E-014-1 |
| FR-018 Activity timeline | US-017 | AC-018-1 | `GET /api/activity` | `item_location_events` | T-082 | IT-018-1 |
| FR-019 Aliases | US-018 | AC-019-1 | item alias fields | `item_aliases` | T-080 | IT-019-1, AIE-019-* |
| FR-020 Fuzzy matching | US-019 | AC-020-1 | `GET /api/search` tuning | search indexes | T-081 | IT-020-1, AIE-020-* |
| FR-021 Preferences | US-020 | AC-021-1 | `/api/preferences` | `user_preferences` | T-024, T-083 | IT-021-1 |
| FR-022 Data export | US-021 | AC-022-1 | `GET /api/export` | all owner tables | T-084 | IT-022-1 |
| FR-025 Item images | US-024 | AC-025-1 | `/api/items/:id/image` | `items` (+S3 objects) | T-085 | IT-025-1 |
| FR-030 Onboarding | US-029 | AC-030-1 | — (UI + existing APIs) | — | T-086 | E2E-030-1 |

## P2 requirements (roadmap only — no tasks yet)

| FR | US | Status |
|---|---|---|
| FR-026 Voice | US-025 | Roadmap; needs ADR + PRD revision |
| FR-027 QR/NFC | US-026 | Roadmap; needs ADR + PRD revision |
| FR-028 Shared households | US-027 | Roadmap; data-model change + security review |
| FR-029 Smart-home integrations | US-028 | Roadmap; `INFERRED` events model reserved |

## Gap analysis (documentation phase)

- **P0 coverage:** 18/18 FRs (all P0 headings in FUNCTIONAL_REQUIREMENTS.md) have US, AC, API (or explicit "pipeline/validator" location), DB
  model, task IDs, and test IDs. No gaps.
- **Reserved columns:** AC texts are enumerated in
  [ACCEPTANCE_CRITERIA.md](../requirements/ACCEPTANCE_CRITERIA.md) with exactly the IDs used
  above; US texts in [USER_STORIES.md](../product/USER_STORIES.md); test definitions in
  [TEST_PLAN.md](TEST_PLAN.md).
- **Enforcement:** T-037 (authorization matrix) and T-056 (AI eval) are the two heaviest
  gates; both are P0-blocking tasks with explicit dependencies in TASK_BREAKDOWN.md.
