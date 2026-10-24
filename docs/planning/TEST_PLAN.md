# Test Plan — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | QA agent (plan) · test authorship follows the role that wrote the code (Backend/Frontend/AI), QA owns the gates |
| ID scheme | `UT/IT/E2E/AIE-###-#` where `###` is the **FR number** and `#` is the case index — canonical definition lives in this file ([../index.md §3](../index.md)) |
| Requirements source | [../requirements/FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md) (FR priorities + referenced test IDs) · Criteria: [../requirements/ACCEPTANCE_CRITERIA.md](../requirements/ACCEPTANCE_CRITERIA.md) |
| Traceability gate | [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) — every P0 FR → ≥ 1 automated test |

> **No test in this plan has been executed yet.** Nothing here is a test result. Results exist
> only when a command's real output is recorded (evidence rules: §9).

---

## 1. Strategy — the test pyramid

| Layer | What it proves | Tooling (proposed, pinned at T-010) | Count (design intent) |
|---|---|---|---|
| **Unit** (`UT`) | Pure logic: validation, derivation rules, invariants, retry policy, grounding validator, redaction | Vitest (Node environment, **no network**) | Many — cheapest, run on every change |
| **Integration** (`IT`) | API endpoints → service → repository → **real local PostgreSQL**: happy path, validation errors, **ownership scoping** | Vitest + Prisma against a local test database | One per endpoint, minimum (see §3) |
| **End-to-end** (`E2E`) | User-visible flows in a real browser against the local dev server | Playwright, **MockProvider** LLM (no live keys) | Few — critical paths only |
| **AI evaluation** (`AIE`) | Intent accuracy, grounding, no-fabrication, clarification, extraction quality | `npm run test:ai` — deterministic **MockProvider** in CI; **one recorded live-Groq run** before M-6 exit | Fixtures per evaluation cases (§4.4) |

Two hard architectural points:

1. **The database is the test partner for `IT`** — search ranking, hierarchy constraints, and
   append-only behavior cannot be proven against a mock (D6 FTS/`pg_trgm` lives in Postgres).
2. **The AI layer has two evidence modes**: CI proves *pipeline behavior* deterministically via
   MockProvider; quality percentages (accuracy/correctness) are only credible from a
   **recorded live-model run** (T-056) — see §5.

---

## 2. Environments

| Purpose | Environment | DB | LLM | Notes |
|---|---|---|---|---|
| Unit + integration (local & CI) | local Node / CI runner | **PostgreSQL 16** — dedicated test database with migrations applied; per T-020 the Supabase project is the primary dev target, but tests run on the local/native PostgreSQL 16 fallback (Docker Compose only where Docker is installed; Docker is NOT installed on the inspected machine 2026-10-15, risk R-08) so no cloud DB is touched in tests | none (network disabled) | Synthetic seed data only (BR-11) |
| E2E | local dev server (`next dev`) | same PostgreSQL 16 target as above | **MockProvider** | Playwright drives real browsers; auth flow uses `AUTH_MODE=dev` locally — E2E-001-1 additionally recorded once against Supabase Auth on the real Supabase project (T-025) |
| AI evaluation (CI) | CI runner | local PostgreSQL 16 (retrieval cases need real data) | **MockProvider** — deterministic, no network, no keys | `npm run test:ai`; part of the regression suite |
| AI evaluation (live) | local dev only | local data | **Groq live** — key used only from local dev by the AI agent (IMPLEMENTATION_PLAN §2.5, BR-12 caps) | **One recorded run before M-6 exit** (T-056); report committed |
| Staging smoke | AWS staging (after T-071) | staging Supabase (Pro if past the Free-tier limits) | Groq live (staging secret) | Not a test suite: recorded smoke script auth → item → event → search → assistant (T-072) |

No production data is ever used in tests (BR-11). No live LLM key exists in CI (§6).

---

## 3. Coverage targets (gates)

| # | Target | Gate check |
|---|---|---|
| G-1 | **Unit ≥ 70% lines** (V8 coverage) of `src/server/rules/**` + service modules (exact paths fixed at scaffold T-010; scope recorded in the coverage report) | Coverage report in CI; enforced at the QA sweep (T-065) |
| G-2 | **Every API endpoint** has ≥ 1 happy-path **and** ≥ 1 negative integration test (validation error + auth/ownership failure) | Endpoint × test audit at each phase exit |
| G-3 | **Every P0 FR** has ≥ 1 automated test (UT/IT/E2E/AIE) — **traceability gate** | Cross-check against [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) (19 P0 FRs, zero-gap rule) |
| G-4 | **AI gates:** intent accuracy **≥ 90%** · grounded-answer correctness **≥ 70%** · **fabricated records = 0** | `npm run test:ai` output + recorded live run (§5) |
| G-5 | Full regression suite green before every **phase exit** and before every merge to `main` | CI (lint → typecheck → test → `prisma validate` → build, T-012) |

---

## 4. Test catalog

IDs below are the tests **referenced by FUNCTIONAL_REQUIREMENTS.md** (each with a one-line
description), with wildcard IDs expanded into explicit ranges. P1 FR tests are planned but not
release-blocking.

### 4.1 Unit tests (`UT`)

| ID | FR | One-line description |
|---|---|---|
| UT-002-1 | FR-002 | Item validation: `name` 1–120 chars, optional fields, duplicate-name warning flag (non-blocking) |
| UT-003-1 | FR-003 | "Last recorded location" derivation = newest `occurredAt`; no redundant stored field |
| UT-004-1 | FR-004 | Append-only invariant: no update/delete path for events; corrections only append; future `occurredAt` (> +5 min skew) rejected |
| UT-005-1 | FR-005 | Search query normalization (trim, case fold, < 2 chars no-op, > 200 chars truncate/reject) |
| UT-010-1 | FR-010 | Grounding validator: answer claims must map to retrieved record IDs or be flagged; ungrounded → safe fallback + `ai.ungrounded_detected` |
| UT-013-1 | FR-013 | Retry policy: max 2 retries, exponential backoff, retry only on 429/5xx/network, within 15 s timeout |
| UT-017-1 | FR-017 | Location rules: depth ≤ 3, case-insensitive sibling uniqueness among non-archived siblings |
| UT-023-1 | FR-023 | Log-redaction guard: message/content fields never reach log output (metadata only) |
| UT-032-1 | FR-032 (P1) | Client-side search history: cap at 10 (oldest dropped), most-recent-first + dedupe, chip removal/clear-all, corrupt or absent `localStorage` degrades to empty history |

### 4.2 Integration tests (`IT`) — real endpoint → service → local PostgreSQL

| ID | FR | One-line description |
|---|---|---|
| IT-001-1 | FR-001 | JWT verification middleware: valid token resolves `sub`; expired/tampered/missing → 401 `UNAUTHENTICATED`; `ownerId` never taken from the payload |
| IT-001-2 | FR-001 | `User` row upsert on first authenticated request is idempotent |
| IT-002-1 | FR-002 | Item CRUD + ownership: cross-user read/edit → 404 (indistinguishable from missing) |
| IT-003-1 | FR-003 | Record location → event created; item's last recorded location derived; archived/not-owned location refused |
| IT-004-1 | FR-004 | History preserved across item edits and new recordings; timeline newest-first |
| IT-005-1 | FR-005 | Search ranking order (exact > prefix > trigram > FTS), archived demoted, owner scoping (no cross-user results) |
| IT-006-1 | FR-006 | `POST /api/assistant/messages`: classification + reply persisted; empty/oversized → 400 with no row written |
| IT-007-1 | FR-007 | Retrieval runs server-side scoped to `ownerId` before any LLM call — other users' records never enter context |
| IT-007-2 | FR-007 | Context bounded (≤ 20 records, ≈ 4k tokens, stable IDs); retrieval error → `AI_UNAVAILABLE`-class response with deterministic search link |
| IT-009-1 | FR-009 | Clarification threshold logic: top candidate not meaningfully above runner-up → ambiguous (configurable margin) |
| IT-011-1 | FR-011 | Correction appends a new event; item edits never alter history; assistant correction persists only via confirmation |
| IT-012-1 | FR-012 | **Ownership matrix:** every protected endpoint × cross-user request → 404; token-only `ownerId` (T-037 suite, matrix printed in test output) |
| IT-013-1 | FR-013 | Simulated provider outage (429/5xx/timeout) → inventory unaffected; assistant returns 503 + fallback object + `ai.fallback` metric |
| IT-014-1 | FR-014 (P1) | Account deletion: idempotent request, 7-day grace, purge script completeness, audit events |
| IT-015-1 | FR-015 | Dashboard aggregation queries match stored data exactly (counts, 7-day recents, recent events) |
| IT-016-1 | FR-016 | Soft delete/restore/archive: `deletedAt` set, excluded from lists/search/retrieval, restore window (30 d, BR-07) |
| IT-017-1 | FR-017 | Location CRUD + constraints: 201 with depth/path, 400 depth, 409 sibling duplicate, 409 archive-with-references (counts) |
| IT-018-1 | FR-018 (P1) | Activity timeline: 30-day window, newest-first, paginated, filterable |
| IT-019-1 | FR-019 (P1) | Aliases found by search and assistant retrieval; normalization + per-owner uniqueness; removal drops both paths |
| IT-020-1 | FR-020 (P1) | Typo tolerance: trigram threshold met → fuzzy `matchType` + "did you mean" |
| IT-021-1 | FR-021 (P1) | Preferences endpoints: defaults on demand, persistence across sessions/devices |
| IT-022-1 | FR-022 (P1) | Export: owner's records only, size cap/pagination, `DATA_EXPORTED` audit event |
| IT-023-1 | FR-023 | Conversation persistence, listing, new-conversation isolation; delete = immediate hard delete; unknown ID → 404 |
| IT-024-1 | FR-024 | `pendingAction` → confirm executes the write through the validated service path → event persisted with references (+audit) |
| IT-024-2 | FR-024 | Cancel writes nothing; 24 h expiry / unknown action → 409 with nothing executed |
| IT-025-1 | FR-025 (P1) | Presigned image upload: ownership, size/type constraints, single-image replace, delete cascades object |

### 4.3 End-to-end tests (`E2E`) — Playwright, local dev server, MockProvider

| ID | FR | One-line description |
|---|---|---|
| E2E-001-1 | FR-001 | Sign-up → verify/login → logout; `AUTH_MODE=dev` in the routine e2e env, **one recorded run** against Supabase Auth on the real Supabase project (T-025) |
| E2E-002-1 | FR-002 | Create + edit an item through the UI; duplicate warning appears; list updates |
| E2E-008-1 | FR-008 | Assistant answer citations render and each link **resolves to the item/event detail page** |
| E2E-011-1 | FR-011 | Assistant correction flow: answer → item link → correct via confirmation → new event visible |
| E2E-012-1 | FR-012 | Cross-user negative path in the UI: a second session cannot see or open the first user's records |
| E2E-014-1 | FR-014 (P1) | Settings → export offered → delete-account request flow (confirmation, sign-in blocked after) |
| E2E-015-1 | FR-015 | Dashboard states: populated cards + new-user onboarding empty state |
| E2E-016-1 | FR-016 | Destructive-action dialog → delete → restore within window; archived hidden from defaults |
| E2E-018-1 | FR-018 (P1) | Activity timeline page: feed, filter, pagination |
| E2E-030-1 | FR-030 (P1) | Guided onboarding ≤ 3 steps, skippable, one-time |
| E2E-031-1 | FR-031 (P1) | `/labels` page: one label per item with name + location path + category from the existing items API; print preview contains labels only (app chrome hidden); API failure → inline retry |
| E2E-032-1 | FR-032 (P1) | `/search` page: last-10 query chips persist across reload and are removable (clear-all too); suggestion chips from recent items/locations run a search when tapped |

**Supplemental E2E (defined here; TASK_BREAKDOWN names the flow, FRs did not cite an ID):**

| ID | FR | One-line description |
|---|---|---|
| E2E-002-2 | FR-005 | Inventory table interactions: filters, sort, pagination, responsive fallback (T-044) |
| E2E-004-1 | FR-004 | Item detail: location history timeline renders newest-first; quick "record location" action (T-035) |
| E2E-005-1 | FR-005 | Global search bar → results page: match-type badges, recall context, empty state (T-041) |
| E2E-006-1 | FR-006 | **Assistant round-trip with MockProvider:** message → reply → conversation persisted (T-055) |
| E2E-013-1 | FR-013 | Degradation UX on mocked outage: 503 state, retry button, link to deterministic search results (T-057) |
| E2E-017-1 | FR-017 | Locations management: tree picker, create/re-parent/archive dialogs, 409 messages (T-031) |

### 4.4 AI evaluation tests (`AIE`)

Wildcard IDs cited by FUNCTIONAL_REQUIREMENTS.md are **expanded to explicit ranges** below.
Ranges are *floors*: the canonical fixture list (`prompts/EVALUATION_CASES.md`, listed in
[../index.md §2](../index.md)) may add cases — new IDs continue sequentially
(`AIE-006-9`, …); existing IDs are never renumbered or reused. Reconcile ranges at T-056.

| ID range | FR | Cases covered (one line each) |
|---|---|---|
| **AIE-006-1 … AIE-006-8** | FR-006 | Intent classification — one case per MVP intent: `lookup_location`, `list_contents`, `search_fuzzy`, `record_memory`, `correct_record`, `chit_chat`, `help`, `unknown` → gate **intent accuracy ≥ 90%** |
| **AIE-007-1 … AIE-007-6** | FR-007 | Retrieval before generation: owner-scoped context only; bounded context (≤ 20 records); stable record IDs in serialization; retrieval-first ordering (no LLM call without retrieval); no-records context path; malicious message content cannot widen scope |
| **AIE-008-1 … AIE-008-5** | FR-008 | Answer where+when+caveat: last recorded location named; `occurredAt` timestamp present; "may have moved since" caveat; citation IDs present and resolvable; inferred vs recorded distinction |
| **AIE-009-1 … AIE-009-4** | FR-009 | Clarification: ambiguity → question not answer and no `pendingAction`; candidates listed as options; selection continues flow; ≥ 3rd ambiguous round → deterministic search link offered (max 2 rounds) |
| **AIE-010-1 … AIE-010-6** | FR-010 | **Negative / no-fabrication suite:** unknown item → explicit "no record" + next steps; no invented names/locations/timestamps/IDs; simulated ungrounded reply intercepted → safe fallback + `ai.ungrounded_detected`; zero-fabrication across the whole case set; no cross-user entity leakage; "no records" honesty |
| **AIE-024-1 … AIE-024-5** | FR-024 | Extraction quality: item+location+`occurredAt` extracted from phrasing; backdated time expression; insufficient entities → targeted question (no `pendingAction`); `correct_record` extraction; extraction never triggers a direct write |
| **AIE-019-1 … AIE-019-4** (P1) | FR-019 | Retrieval with alias phrasing ("U-lock" finds "Bike lock"); alias removal drops retrieval |
| **AIE-020-1 … AIE-020-4** (P1) | FR-020 | Retrieval/ranking eval on typo variants against the search eval set |

### 4.5 Task-level checks without an FR test ID

These are real required checks whose IDs are not FR-scoped; they are tracked by their task's
verification in [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md): design-token contrast unit test +
app-shell E2E (T-013/T-014), API envelope-mapping unit tests (T-015), rate-limit / security-
header checks and input fuzz tests (T-060), audit-coverage integration test (T-061),
dependency + secret scan runs (T-063), PR-protection verification on a test PR (T-066).

---

## 5. AI evaluation gates (G-4) — how they are proven

| Gate | Threshold | Proven by | Recorded in |
|---|---|---|---|
| Intent accuracy | **≥ 90%** | AIE-006-1..8 (and any added cases) | CI output + live-run report (T-056) |
| Grounded-answer correctness | **≥ 70%** (PRD BO-2 / §14) | AIE-007/008/009 suites | same |
| Fabricated records | **= 0** (PRD §14) | AIE-010 suite + UT-010-1 validator + `ai.ungrounded_detected` metric | same |
| Fallback / degradation behavior | inventory unaffected; 503 + fallback UX | IT-013-1, UT-013-1, E2E-013-1 (MockProvider) | regression suite |
| Live-model confirmation | one run before M-6 exit | Groq live from local dev, fixtures unchanged | **committed live-run report (T-056)** |

**Two-mode rule:** CI runs the AIE suite through **MockProvider** — this deterministically
proves pipeline behavior (retrieval-first, validator interception, fallback, no-fabrication
logic) but **cannot** vouch for real-model answer quality. The **percentage gates**
(≥ 90% / ≥ 70%) are therefore evaluated on the **recorded live-Groq run** before M-6 exit. A
green MockProvider CI alone never satisfies G-4.

---

## 6. Mocking policy

1. **MockProvider** is the only LLM in CI and in routine Playwright runs — deterministic
   fixture responses keyed by intent/fixture case.
2. **No live LLM keys in CI.** Live Groq usage happens only from local dev by the AI agent,
   within BR-12 caps (20 req/min, 100 msgs/day), and only for the recorded T-056 run.
3. **No network in unit/integration tests**: Vitest node environment with outbound network
   denied; a test needing the internet fails, it does not skip.
4. **No external services are called in tests**: unit/integration tests touch no cloud service
   at all (no AWS, no Supabase — a dedicated local PostgreSQL 16 test database stands in for
   the Supabase project, T-020); e2e runs with `AUTH_MODE=dev` (local-only mode, refused in
   production) and MockProvider, with **one** manual recorded run against Supabase Auth
   (E2E-001-1, T-025); clock/time is injectable for
   expiry tests (pendingAction 24 h, retention windows) — no `setTimeout`-flaky waits.
5. Mocks must assert **interactions that encode the FR** (e.g., retrieval called before the
   LLM), not merely canned outputs.

---

## 7. Flaky-test policy

1. **A test that passes on retry is a failed test.** CI may surface one automatic retry for
   signal, but any test requiring it is reported as flaky.
2. Flaky tests are **quarantined with an owner and a deadline** (fixed before the next phase
   exit); quarantined tests still run locally and are listed in the QA sweep (T-065) output.
3. Common causes to fix at the source: wall-clock sleeps (use injectable clock), unseeded
   shared databases (isolate per run), unmocked network, Playwright race on async UI
   (auto-waiting + explicit locators).
4. **A quarantined test may not be deleted to make CI green** — replacement must cover the
   same FR/AC.
5. Zero known-flaky tests is a **phase-exit criterion** ([DEFINITION_OF_DONE.md §c](DEFINITION_OF_DONE.md)).

---

## 8. Regression policy

| Trigger | Suite | Defined in |
|---|---|---|
| Every PR / merge to `main` | lint → typecheck → unit + integration → `prisma validate` → production build (e2e + AIE on CI schedule or per-PR if runtime allows) | CI pipeline T-012, [IMPLEMENTATION_PLAN §2](IMPLEMENTATION_PLAN.md) |
| **Every phase exit** | **Full regression**: unit + integration + e2e + AIE (MockProvider) — mandatory before the milestone advances | [MILESTONES.md](MILESTONES.md) exit criteria |
| Before M-6 release | Full regression + **recorded live AIE run** + staging smoke (T-072) | PRD §17, [DEFINITION_OF_DONE.md §d](DEFINITION_OF_DONE.md) |
| Schema migration | `prisma validate` + migration applied on a scratch local DB + smoke queries (V1/V2/V3 + seed) | T-021, deployment doc |

Fixes for regressions ship with the test that caught them (the failing test is part of the
fix's evidence).

---

## 9. Evidence requirements

1. **Record real command output** for every test run claimed in a task or PR (task status
   changes only with recorded evidence — [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) header rule).
2. **Never claim an unrun test** ([../index.md §6](../index.md) ground rule 3): "should pass"
   and "written but not executed" are not results.
3. Artifacts to keep: CI run reference, `npm run test:ai` summary (counts per gate), the
   committed **live-run report** (T-056), coverage report (G-1), authorization-matrix output
   (T-037), staging smoke report (T-072).
4. Results are pasted into the PR/task evidence — screenshots alone are insufficient when a
   text log exists.
5. This documentation phase has **one** recorded validation result: `prisma validate` on
   `prisma/schema.prisma` **PASSED (Prisma CLI 6.19.3, 2026-10-15)** — schema validation, not
   a test run.

---

## 10. Verification commands (sample; script names finalized at T-010/T-012)

```bash
npm test -- --run              # unit + integration (Vitest) — fast local/CI run
npm test -- --run --coverage   # same + V8 coverage report (gate G-1)
npx playwright test            # e2e against the local dev server (MockProvider)
npm run test:ai                # AI evaluation suite (MockProvider in CI; live mode local-only)
npx prisma validate            # schema validation — recorded PASSED, 2026-10-15 (Prisma CLI 6.19.3)
```

CI order (T-012): `lint → typecheck → test → prisma validate → build`.
Environment note: local test DB setup follows T-020 — the Supabase project is the primary
target; a native PostgreSQL 16 (or Docker Compose where Docker is installed) fallback is
allowed for local dev only (Docker not installed on the inspected machine, 2026-10-15; R-08).

## Related documents

- [../requirements/FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md) — FR priorities + cited test IDs
- [../requirements/ACCEPTANCE_CRITERIA.md](../requirements/ACCEPTANCE_CRITERIA.md) — `AC-` texts each test must satisfy
- [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) — FR → test mapping (gate G-3)
- [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) — which task produces/wires which test
- [RISKS.md](RISKS.md) — tests as mitigations (R-01, R-03, R-04)
- [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) — when suites must be green and what counts as evidence
