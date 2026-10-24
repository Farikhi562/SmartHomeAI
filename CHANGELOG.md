# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Decided — UI language & three P1 features in progress (2026-10-24, product-owner decision)
- **UI in Bahasa Indonesia** for all user-visible text (audience: family members /
  elderly parents); English retained for code, logs, documentation prose, and API error
  `code` fields.
- **Three features in progress** (implementation in flight; documentation updated, no
  completion claimed): **ekspor data** (FR-022 → `GET /api/export` JSON file download),
  **label cetak** (`/labels` print page), and **riwayat & saran pencarian** (`/search`
  query chips + suggestions).
- New IDs allocated: FR-031, FR-032 · US-030, US-031 · AC-031-1..2, AC-032-1..2 ·
  T-089, T-090, T-091 (all `todo`) · planned tests E2E-031-1, UT-032-1, E2E-032-1.
  FR-022 / AC-022-1 / US-021 / API_SPEC §3.7 aligned to the agreed export payload
  `{ items, locations, events, preferences, exportedAt }` (conversations excluded by default).
- `node tools/validate-docs.mjs` after these doc changes — **ALL CHECKS PASSED**
  (62 files, 714 relative links, 23 Mermaid, 32 FRs / 18 P0, 56 AC, 31 US, 0 warnings);
  evidence row in `docs/planning/TASK_BREAKDOWN.md` §4. Feature code itself is **not**
  claimed verified — tasks T-089…T-091 remain `todo`.

### Changed — platform decision amendments (2026-10-17, product-owner decision)
- **D2 → Supabase:** PostgreSQL 16 + Prisma now runs on **Supabase** (Free tier, $0) —
  pooled runtime `DATABASE_URL` (`?pgbouncer=true`) + direct `DIRECT_URL` for migrations;
  local Docker Compose demoted to *optional* fallback; Amazon RDS dropped.
  New **ADR-005**; ADR-002/ADR-004 carry "Amended by ADR-005" status notes.
- **D5 → Supabase Auth:** email + password on GoTrue; access JWT verified server-side
  (HS256, `SUPABASE_JWT_SECRET`, issuer/audience checks); login/signup/logout/refresh are
  proxied through `/api/auth/*` so the session cookie stays `httpOnly`. Amazon Cognito
  dropped; `AUTH_MODE=dev` (local email-only login, refused in production) retained.
- **D4 scope narrowed:** AWS CDK provisions only Secrets Manager / CloudWatch alarms /
  Budgets (no Cognito, no RDS, no VPC). Amplify Hosting unchanged.
- Documentation swept for the change (SECURITY, AWS_ARCHITECTURE, COST_ESTIMATION,
  RISKS, TEST_PLAN, planning/tasks, flows); `docs/CONTRACT.md` retained as the
  **Adjudication Record** — T-003 (2026-10-17) declared the index-rooted set authoritative
  and marked its registry sections SUPERSEDED (CONTRACT.md §0).

### Added — application implementation (Phase 2+, in progress)
- Next.js 15 App Router scaffold: TypeScript strict, Tailwind v4, ESLint 9 flat config,
  Vitest 3, docker-compose (optional fallback), pinned dependency set (`npm install` ✓).
- Foundation modules: typed env config (placeholder-aware), error envelope, structured
  logger with redaction, token-bucket rate limiter, Prisma client singleton, Supabase/dev
  auth module + `/api/auth/{config,login,signup,logout,refresh}` routes, shared Zod
  validation schemas, pure domain rules (locations/items/events/retention), assistant
  core (prompt builders, grounding validator, Groq + Mock providers with retry policy).
- **Schema defect fixed before any database existed:** user-referencing FK columns were
  `UUID` while `users.id` is `TEXT` (opaque provider `sub`) → Postgres would reject the
  foreign keys (SQLSTATE 42804); all 8 columns corrected + `DATABASE_SCHEMA.md` synced.
- Prisma migrations committed: `000001_init` (generated from schema),
  `000002_search` (pg_trgm + generated tsvector + GIN), `000003_location_uniques`
  (partial unique sibling indexes); `prisma validate` ✓ after fixes.
- Documentation validator `tools/validate-docs.mjs` (links, Mermaid, FR/AC/US
  cross-references) — run results recorded in `docs/planning/TASK_BREAKDOWN.md` §4.

### Verified — full local verification suite (2026-10-22, all exit 0)
- `npm run typecheck` — PASSED (`tsc --noEmit`; converged over 4 rounds: 24 → 13 → 1 → 0 errors).
- `npm run lint` — PASSED (0 errors **and 0 warnings**; 2 `react-hooks/exhaustive-deps`
  warnings fixed properly, not suppressed).
- `npm test` — PASSED: **221 passed / 70 skipped** across 15 files (skips = DB-gated
  integration tests + live-Groq evaluation cases, each with a documented guard). Real bug
  found & fixed during the run: the rate limiter's initial refill window was computed
  negative (env parse between the two `Date.now()` calls), making fresh buckets start a
  fraction below capacity and tripping 429 one request early — `getBucket` now stamps
  `lastRefill` with the caller's captured timestamp.
- `npm run build` — PASSED (`next build`: 26 API routes + 10 pages + middleware; shared
  First Load JS 103 kB).
- `node tools/validate-docs.mjs` — ALL CHECKS PASSED (62 files, 713 links, 23 Mermaid,
  30 FRs / 18 P0, 52 AC, 29 US).
- Risk-ID drift audit closed: 9 three-digit `R-###` references from the competing-draft
  numbering corrected to canonical two-digit IDs; historical annotations left intact.
- **Not runnable here (pending, not claimed green):** DB migrations/seed/integration/e2e
  (no Docker; Supabase project not yet created) · live-Groq evaluation T-056 (no
  `GROQ_API_KEY`; guarded skips) · CI (no git remote yet).

## [0.1.0] — 2026-10-15

### Added — documentation-first foundation (Phase 0–1 input)
- **Repository inspection (T-001):** empty greenfield repo; toolchain recorded (Node 24.13.0, npm 11.6.2, git 2.52.0).
- **Documentation index** with locked architectural decisions (D1–D7) and ID conventions — `docs/index.md`.
- **Product:** PRD, product vision, personas, user stories (US-), use cases (UC-), roadmap.
- **Requirements:** functional requirements FR-001–FR-030 with priorities, error conditions, AC and test references; non-functional requirements (NFR-), acceptance criteria (AC-), business rules (BR-), glossary.
- **Design:** design spec (14 pages + states), design system (semantic tokens, light/dark), information architecture, user flows, ASCII wireframes, accessibility (WCAG 2.1 AA target).
- **Architecture:** system architecture (layering + request flows + Mermaid), database schema (9 entities, ERD, search indexes, migration strategy), API specification (REST contracts, error envelope, DTOs), AI architecture (Groq pipeline, grounding, safety rules S-1–S-10, no-vector evaluation), AWS architecture (service justifications), security, observability, deployment, disaster recovery, and ADR-001…ADR-004.
- **Agents:** agent specification with permissions matrix, 10 role documents, workflow, coding standards.
- **Planning:** implementation plan (phases 0–8), task breakdown (T-001…T-088 with dependencies and verification), traceability matrix, milestones, risks, cost estimation (labeled assumptions, us-east-1 + Groq 2026 rates), test plan, definition of done.
- **Prompts:** system prompt, intent classification, memory extraction, answer generation, evaluation cases.
- **Schema:** `prisma/schema.prisma` as the normative design artifact (validated with `prisma validate`).
- Root files: README, CONTRIBUTING, `.env.example`, `.gitignore`.

### Known limitations of this release
- Documentation is a **draft for review**; Phase 1 approval gate (T-004) is open.
- No application code exists yet (`src/`, `tests/`, `infrastructure/` arrive in Phases 2–8).
- Pricing figures are labeled assumptions (2026-09/10 research) and must be re-verified at purchase time.
