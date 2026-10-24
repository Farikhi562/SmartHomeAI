# Task Breakdown — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Rules | Stable `T-` IDs; status changes only with recorded verification evidence (AGENT_SPEC §2.8); "done" is set by the Orchestrator |

**Status legend:** `done` = verified with evidence · `todo` = ready to start · `blocked` = waiting on dependency.
**Owner** = agent role from [AGENT_SPEC.md](../agents/AGENT_SPEC.md).
**Verification commands** run in CI unless noted local-only.

---

## Phase 0 — Repository inspection & assumptions

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-001 | Inspect repository, tooling, environment | Orchestrator | — | — | Inspection findings (index §4, this session) | Repo scan commands run; Node 24.13.0/npm 11.6.2/git 2.52.0 recorded | **done** (2026-10-15) |
| T-002 | Generate documentation set v0.1.0 | Orchestrator + all roles | T-001 | all | 63 docs + `prisma/schema.prisma` + root files | Link/structure validation script passes; `prisma validate` result recorded | **done** (2026-10-15, see report; validation results in §4) |

## Phase 1 — Documentation approval gate

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-003 | Cross-consistency review of documentation set **+ adjudication of `docs/CONTRACT.md` vs this documentation set** (index §5 item 4; conflicts: FR/US/BR/NFR numbering, API base path, auth mechanism, WCAG level, RTO, cost ceiling, region, event semantics, task ranges) | Review + SecRev + Human | T-002 | — | Findings list + adjudication record | Every finding resolved or explicitly deferred with rationale; CONTRACT.md outcome recorded | **done** (2026-10-17 — index-rooted set adjudicated authoritative; conflict table + findings F-1…F-8 recorded in CONTRACT.md §0; evidence in §4 below; stakeholder may revisit rows at T-004) |
| T-004 | Human stakeholder approval of PRD, ADRs, cost model | Human + Product | T-003 | PRD | Approval note in CHANGELOG; scope freeze | Written approval recorded | todo |
| T-005 | Countersign agent roles and permissions; also resolve the matrix carve-outs flagged by the role docs (`src/app/api/**` ownership → Backend; `src/lib/validation` joint task T-015; "mark done" = Orchestrator executes the transition, others provide sign-off evidence) | Human + Orch | T-004 | AGENT_SPEC | Signed-off AGENT_SPEC | AGENT_SPEC §7 checkbox complete | todo |
| T-006 | Docs v1.0.0 + CHANGELOG entry | Product | T-005 | — | Version bumps | Diff reviewed | todo |

## Phase 2 — Scaffolding & conventions

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-010 | Init Next.js (App Router) + TS strict + Tailwind + shadcn/ui + Lucide; pin versions | Frontend | T-004 | D1, C-6 | `package.json`, `next.config`, `tailwind`, base `src/app` | `npm run dev`, `npm run build` | todo |
| T-011 | ESLint + Prettier + import-boundary rules (layering, SYSTEM_ARCHITECTURE §2) | Frontend | T-010 | — | `.eslintrc`/flat config, `.prettierrc` | `npm run lint` (0 errors) | todo |
| T-012 | CI pipeline: lint → typecheck → test → `prisma validate` → build (+ secret/dep scan hook T-066) | AwsInfra | T-011 | — | `.github/workflows/ci.yml` | Workflow green on a PR | todo |
| T-013 | Design tokens + theme provider (light default, dark optional) per DESIGN_SYSTEM | Frontend | T-010 | D7 | `src/components/ui/*` tokens, ThemeProvider | `npm run test` (token contrast unit test) | todo |
| T-014 | App shell: sidebar, topbar (global search slot, account menu), breadcrumbs, responsive nav, empty/loading/error primitives | Frontend | T-013 | design | `src/components/layout/*` | Visual check + E2E shell test | todo |
| T-015 | Shared Zod schemas + typed API client skeleton + error envelope mapper | Front + Back | T-011 | API_SPEC §2 | `src/lib/validation`, `src/client/api` | `npm run typecheck`; unit tests for envelope mapping | todo |

## Phase 3 — Authentication & database foundations

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-020 | Local/dev Postgres 16: primary = the **Supabase Free project** (`DATABASE_URL`/`DIRECT_URL` from the Connect dialog, ADR-005); typed env loader from `.env.example`. **Note:** Docker is NOT installed on the currently inspected Windows machine — Docker Compose or a native PostgreSQL 16 install is an **optional offline fallback** only (document the choice in the task evidence) | Back | T-015 | D2 | `docker-compose.yml` (optional fallback), `src/lib/config/env.ts` | Supabase project reachable via pooled/direct URLs + env loader unit tests (optional `docker compose up -d`/native PG fallback verified) | todo |
| T-021 | Apply schema: V1 init migration, V2 search SQL (FTS+trgm), V3 location uniques; seed script | Back | T-020 | D6, schema | `prisma/migrations/*`, `prisma/seed.ts` | `npx prisma migrate dev` locally; `npm run seed`; search smoke SQL | todo |
| T-022 | Supabase project (Free) + auth settings (confirmations/SMTP), env wiring `DATABASE_URL`/`DIRECT_URL`/`SUPABASE_*` | AwsInfra | T-004 | D5, ADR-005 | Supabase project config; env wiring into Secrets Manager / Amplify | manual signup test recorded; env wiring reviewed | todo |
| T-023 | Auth module: HS256 JWT verification (`SUPABASE_JWT_SECRET`, issuer/audience checks), `requireUser()`, `/api/me`, deleted-account rejection | Back | T-021, T-022 | FR-001, FR-012 | `src/lib/auth/*`, `src/app/api/me` | IT-001-1, IT-001-2 | todo |
| T-024 | User row upsert + preferences endpoints (defaults on demand) | Back | T-023 | FR-001, FR-021 | `/api/preferences`, user sync in service | IT-021-1 | todo |
| T-025 | Auth UI: sign-up, login, logout, recovery, email confirmation (Supabase Auth via our `/api/auth/*` proxy routes) | Frontend | T-023 | FR-001 | `(auth)` route group pages | E2E-001-1 (`AUTH_MODE=dev`, recorded; one recorded run against Supabase Auth in staging) | todo |

## Phase 4 — Items & location management

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-030 | Locations API (CRUD, depth ≤ 3, sibling uniqueness, archive rules) | Back | T-021 | FR-017, BR-04/05 | `LocationService`, repo, `/api/locations` | IT-017-1, UT-017-1 | todo |
| T-031 | Locations management UI (tree picker, create/archive dialogs, errors) | Frontend | T-030, T-014 | FR-017 | location pages/components | E2E location flow | todo |
| T-032 | Items API (CRUD, soft delete/restore/archive, duplicate warning, filters) | Back | T-021 | FR-002, FR-016 | `ItemService`, repo, `/api/items` | IT-002-1, IT-016-1, UT-002-1 | todo |
| T-033 | Items UI: create/edit forms (RHF+Zod), inventory list basics, delete/archive dialogs | Frontend | T-032 | FR-002, FR-016 | inventory + item pages | E2E-002-1, E2E-016-1 | todo |
| T-034 | Location events API: record event, item timeline, last-location derivation | Back | T-030, T-032 | FR-003, FR-004 | `ItemService.recordLocation`, `/api/items/:id/events` | IT-003-1, IT-004-1, UT-003/004 | todo |
| T-035 | Item detail page with location history timeline + quick "record location" action | Frontend | T-034 | FR-004, FR-011 | item detail components | E2E location history flow | todo |
| T-036 | Correction flows: edit + append-event path, restore UX | Back + Front | T-034 | FR-011 | service + UI wiring | IT-011-1, E2E-011-1 | todo |
| T-037 | Ownership-matrix integration test suite (every endpoint × cross-user negative) | QA | T-036 | FR-012 | `tests/integration/authorization.matrix.test.ts` | IT-012-1 green; matrix table in test output | todo |

## Phase 5 — Dashboard & deterministic search

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-040 | Search repository + API with ranking (exact→prefix→trigram→FTS) | Back | T-021 | FR-005, D6 | `search.repo`, `/api/search` | IT-005-1, UT-005-1 | todo |
| T-041 | Search UI: global search bar + results page (match-type badges, empty states) | Frontend | T-040 | FR-005 | search components/pages | E2E search flow | todo |
| T-042 | Dashboard aggregation endpoints (counts, recent items/events) | Back | T-034 | FR-015 | dashboard service + `/api` routes | IT-015-1 | todo |
| T-043 | Dashboard page: cards, quick actions, AI entry point, new-user empty state | Frontend | T-042, T-014 | FR-015 | dashboard page | E2E-015-1 (populated + empty) | todo |
| T-044 | Inventory table hardening: filters, sort, pagination, responsive fallback | Frontend | T-033 | FR-005 | TanStack Table integration | E2E inventory interactions | todo |

## Phase 6 — Groq assistant

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-050 | LlmProvider interface + GroqProvider (JSON mode, timeout, bounded retries) + MockProvider | AI | T-015 | FR-013, ADR-003 | `src/lib/providers/llm/*` | UT-013-1 (retry/backoff with mocks) | todo |
| T-051 | Implement prompts from docs/prompts + Zod output schemas (classification, generation) | AI | T-050 | FR-006 | `src/server/assistant/schemas.ts`, prompt loader | Schema round-trip unit tests | todo |
| T-052 | Assistant retrieval service (reuse `search.repo`, top-K, bounded context serialization) | Back | T-040 | FR-007 | `retrieval.ts` | IT-007-1, IT-007-2 | todo |
| T-053 | Pipeline orchestration + grounding validator (FR-010) + clarification logic (FR-009) | AI | T-051, T-052 | FR-009, FR-010 | `src/server/assistant/pipeline.ts` | UT-010-1; AIE-009/010 (mock) | todo |
| T-054 | Assistant API: messages, conversations, action decision endpoint (pendingAction lifecycle) | Back | T-053 | FR-006, FR-023, FR-024 | `/api/assistant/*` | IT-006-1, IT-023-1, IT-024-1/2 | todo |
| T-055 | Assistant UI: conversation view, confirmation cards, candidate pickers, citations links | Frontend | T-054 | FR-006, FR-008, FR-009, FR-024 | assistant pages/components | E2E assistant round-trip (mocked provider) | todo |
| T-056 | AI evaluation suite: fixtures per EVALUATION_CASES + CI hook + recorded live run | AI + QA | T-053 | FR-006…FR-010 | `tests/ai-evaluation/*` | `npm run test:ai` green; live-run report committed | todo |
| T-057 | Degradation UX: fallback search on 503, retry button, pending-action expiry handling | Frontend | T-055 | FR-013, FR-024 | UI states | E2E fallback flow (mocked outage) | todo |

## Phase 7 — Security, QA & observability

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-060 | Rate limiting, security headers (CSP, HSTS…), CSRF posture review, input fuzz tests | Back | T-054 | NFR/security | middleware + tests | IT rate-limit tests; header checks | todo |
| T-061 | Audit events for sensitive ops (deletion, export, assistant writes, anomalies) | Back | T-054 | SECURITY §7 | `AuditService` + hooks | IT audit coverage test | todo |
| T-062 | Observability: structured logger with redaction, operational metrics, CloudWatch alarms (staging) | AwsInfra + Back | T-054 | NFR, OBSERVABILITY | `src/lib/observability`, alarm constructs | Redaction unit tests (UT-023-1); alarm in staging | todo |
| T-063 | Dependency + secret scanning in CI | AwsInfra | T-012 | SECURITY §9 | workflow steps | CI run recorded (e.g., `npm audit`, gitleaks) | todo |
| T-064 | Security review gate: threat model refresh, prompt-injection tests, findings + fixes | SecRev | T-063 | SECURITY | Findings report + verdict | Zero open high/critical findings | todo |
| T-065 | QA regression sweep: coverage vs TEST_PLAN targets, flaky-test triage | QA | T-057 | TEST_PLAN | Coverage + quality report | Targets met, recorded | todo |
| T-066 | PR/branch protection + review checklist automation | AwsInfra | T-012 | — | repo settings + checklist | Verified on a test PR | todo |

## Phase 8 — AWS deployment & release readiness

| ID | Task | Owner | Depends | FR/ADR | Deliverables | Verification | Status |
|---|---|---|---|---|---|---|---|
| T-070 | CDK stack: Secrets Manager, CloudWatch alarms, AWS Budget, KMS defaults (**no VPC, RDS, or Cognito after ADR-005** — DB + auth live on Supabase) | AwsInfra | T-004 | ADR-004/005, AWS_ARCH | `infrastructure/` stacks | `cdk diff` reviewed; staging deploy recorded | todo |
| T-071 | Amplify Hosting app + build spec + env wiring (secrets from Secrets Manager) | AwsInfra | T-070 | ADR-004, DEPLOYMENT | app config, `amplify.yml` | Build green in staging | todo |
| T-072 | Staging deploy + recorded smoke test (auth → item → event → search → assistant) | AwsInfra + QA | T-071 | release criteria | Smoke report (real run) | Test report file in repo | todo |
| T-073 | Backups (scheduled `supabase db dump` exports; Supabase Pro daily backups at launch) + one restore drill | AwsInfra | T-070 | DISASTER_RECOVERY | Backup policy + drill report | Restore drill executed & timed | todo |
| T-074 | Budget alarms + cost actuals vs COST_ESTIMATION assumptions | AwsInfra | T-070 | C-4 | Budget construct + updated doc | Alarm active; doc updated | todo |
| T-075 | Release readiness: DoD checklists, CHANGELOG v1.0.0, prod deploy (human-approved) | Orch + Human | T-072…T-074 | PRD §17 | Release checklist | All PRD §17 boxes checked with evidence | todo |

## P1 backlog (ordered by value; T-089…T-091 pulled into progress 2026-10-24)

*Decided 2026-10-24 (product owner): T-089…T-091 are the three features in active
implementation; their status stays `todo` here until verification evidence is recorded
(AGENT_SPEC §2.8 — no "done" without a recorded run).*

| ID | Task | Owner | Depends | FR | Verification | Status |
|---|---|---|---|---|---|---|
| T-080 | Item aliases: schema applied, API + UI, retrieval integration | Back + Front | Phase 6 | FR-019 | IT-019-1, AIE-019 | todo |
| T-081 | Fuzzy-search tuning + "did you mean" | Back + QA | T-080 | FR-020 | IT-020-1, AIE-020 | todo |
| T-082 | Activity timeline page | Front | T-042 | FR-018 | IT/E2E-018 | todo |
| T-083 | Preferences UI (theme toggle, suggestions switch) | Front | T-024 | FR-021 | E2E theme persistence | todo |
| T-084 | Account deletion: settings flow + confirmation, 7-day grace + purge job (export offered first per FR-014; the export endpoint itself is tracked as T-089) | Back + Front | T-061 | FR-014 | IT-014-1 | todo |
| T-085 | Item images: presigned S3 upload, display, cleanup | Back + Front | T-070 | FR-025 | IT-025-1 | todo |
| T-086 | Guided onboarding flow | Front | T-043 | FR-030 | E2E-030-1 | todo |
| T-087 | First-party analytics events (privacy-limited, §15 PRD) | Back | T-054 | PRD §15 | Event schema tests | todo |
| T-088 | Retention jobs: 30-day item purge, audit 12-month trim | Back + AwsInfra | T-084 | BR-07/08 | Job dry-run report | todo |
| T-089 | **Ekspor data (F1, in progress):** `GET /api/export` JSON file download — owner-scoped payload `{ items, locations, events, preferences, exportedAt }`, `Content-Disposition: attachment; filename="smarthomeai-ekspor-<date>.json"`, conversations excluded by default, `DATA_EXPORTED` audit event; existing session middleware, `ownerId` from verified token; Settings → Export trigger downloads the file (FR-022) | Back + Front | T-023, T-061 | FR-022 | `npm run typecheck` · `npm test` (IT-022-1 runs only with a DB; guarded skip otherwise) · manual: signed-in browser downloads `smarthomeai-ekspor-<date>.json` with `Content-Disposition: attachment`, payload keys exactly `{ items, locations, events, preferences, exportedAt }`, no conversations, `GET` without session → 401 | todo |
| T-090 | **Label cetak (F2, in progress):** `/labels` page — printable labels (item name + location path + category) from existing `GET /api/items` / `GET /api/locations`, print-only CSS (app chrome excluded), linked from the UI navigation (FR-031) | Front | T-033, T-041 | FR-031 | `npm run typecheck` · `npm test` · manual: `/labels` lists labels for known items; browser print preview shows labels only (no sidebar/topbar/buttons); empty state with no items; items-API failure shows inline retry | todo |
| T-091 | **Riwayat & saran pencarian (F3, in progress):** `/search` enhancements — last 10 queries as removable chips in `localStorage` (most-recent-first, deduped, clear-all) + quick suggestion chips from recent items/locations via existing APIs; purely client-side (FR-032) | Front | T-041 | FR-032 | `npm run typecheck` · `npm test` (UT-032-1) · manual: run >10 queries → exactly 10 chips remain, newest first; removing a chip survives reload; corrupt/absent `localStorage` degrades to empty history; suggestion chips render and run a search | todo |

## P2 (explicitly not planned)

FR-026 voice · FR-027 QR/NFC · FR-028 shared households · FR-029 smart-home integrations.
Each requires a new ADR + PRD scope revision before any task is created.

## 4. Verification evidence — documentation phase (T-002) and adjudication re-run (T-003)

| Check | Result | Date |
|---|---|---|
| All documented files written to disk | 63 docs + `prisma/schema.prisma` + `tools/validate-docs.mjs` (+ preserved `docs/CONTRACT.md`, see index §5) | 2026-10-15 |
| Relative Markdown links resolve | **PASSED** — `node tools/validate-docs.mjs`: 61 md files, 687 links, 0 broken (2 real defects found & fixed: DATABASE_SCHEMA relative link; validator ERD crow's-foot false positive) | 2026-10-15 |
| `prisma validate` on `prisma/schema.prisma` | **PASSED** — Prisma CLI 6.19.3 (1 real defect found & fixed: missing `AuditEvent` back-relation; placeholder env URLs supplied) | 2026-10-15 |
| Mermaid diagrams structurally valid | **PASSED** — 23 blocks: known diagram type + fence termination + bracket balance (ERD glyph exception documented in tool) | 2026-10-15 |
| FR ↔ matrix ↔ AC ↔ US cross-check | **PASSED** — 30 FRs (18 P0) all present in matrix; every P0 row has test IDs; 52 AC refs all defined; 29 US refs all defined | 2026-10-15 |
| `node tools/validate-docs.mjs` (re-run after T-003 edits) | **PASSED — ALL CHECKS PASSED** (61 files, 687 links, 23 Mermaid, 30 FRs / 18 P0, 52 AC, 29 US) | 2026-10-17 |
| `npm run typecheck` | **PASSED** — `tsc --noEmit`, exit 0 (scaffolded code, Phase 2 partial) | 2026-10-17 |
| `npm run lint` | **PASSED** — 0 problems, exit 0 (after finding F-1: `eslint.config.mjs` rewritten with FlatCompat — the original config had never successfully run) | 2026-10-17 |
| `prisma validate` | **PASSED** — schema valid, Prisma CLI 6.19.3 (after finding F-2: `.env` created from `.env.example`; fresh checkouts must run this documented setup step first) | 2026-10-17 |
| `npm test` | **EXPECTED FAIL** — "No test files found", exit 1 (suites arrive with T-015+; finding F-6: add `--passWithNoTests` to interim CI at T-012) | 2026-10-17 |
| Cross-document corrections from T-003 review | F-3 matrix "19/19"→"18/18" · F-4 DISASTER_RECOVERY cites canonical NFR-008 · F-5 index status/§5.3/§5.4 refreshed · F-7 no `.git` recorded as precondition of T-012 · F-8 FR-026…029 as P2 rows explicitly accepted | 2026-10-17 |
| `node tools/validate-docs.mjs` — final run after the ADR-005 doc sweep (T-003 owner) | **PASSED — ALL CHECKS PASSED** (62 files, 711 links, 23 Mermaid, 30 FRs / 18 P0, 52 AC, 29 US) | 2026-10-17 23:46 |
| Implementation-workstream state (other session, in flight — recorded, not owned by docs) | `npm run typecheck` exit 2 on `src/server/services/locations.ts` (in-progress code; last green run 21:10) · `npm test` 193 passed / 4 skipped, 1 failing file (newly added AIE doc-regex test) · `npm run lint` exceeded 3 min mid-sweep | 2026-10-17 23:47 |
| **Implementation verification suite (T-010…T-066 code complete)** | | 2026-10-22 |
| `npm run typecheck` (full app) | **PASSED** — `tsc --noEmit`, exit 0 (converged over 4 fix rounds: 24 → 13 → 1 → 0 errors) | 2026-10-22 |
| `npm run lint` (full app) | **PASSED** — 0 errors **and 0 warnings**, exit 0 (2 `react-hooks/exhaustive-deps` warnings fixed, not suppressed) | 2026-10-22 |
| `npm test` (vitest run) | **PASSED** — exit 0: 14 files passed / 1 skipped, **221 tests passed / 70 skipped** (skips = DB-gated ITs + live-Groq eval cases, each with a documented guard reason; 1 real bug found & fixed during this run: rate-limiter first-window off-by-one from a negative initial refill window) | 2026-10-22 |
| `npm run build` (next build) | **PASSED** — exit 0: 26 API routes + 10 pages + middleware compiled; First Load JS shared 103 kB | 2026-10-22 |
| `node tools/validate-docs.mjs` (re-run after API_SPEC harmonization) | **PASSED — ALL CHECKS PASSED** (62 files, 711 links, 23 Mermaid, 30 FRs / 18 P0, 52 AC, 29 US) | 2026-10-22 |
| Not runnable in this environment (reported pending, **not** claimed green) | `prisma migrate dev` / seed / integration tests / e2e — require Postgres (no Docker; Supabase project not yet created) · live-Groq AIE run (T-056) — requires `GROQ_API_KEY`; guarded `describe.skip` in suite · CI workflow — no `.git`/remote yet (T-012) | 2026-10-22 |
| `node tools/validate-docs.mjs` (re-run after the 2026-10-24 docs changes: FR-031/032, US-030/031, AC-031/032, T-089…T-091, export-payload alignment) | **PASSED — ALL CHECKS PASSED** (62 files, 714 relative links, 23 Mermaid, 32 FRs / 18 P0, 56 AC, 31 US, 0 warnings) | 2026-10-24 |
