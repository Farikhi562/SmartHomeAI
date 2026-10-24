# Implementation Plan — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Source of tasks | [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) (stable `T-` IDs, dependencies, verification) |
| Traceability | [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) |

---

## 1. Phase overview

| Phase | Name | Goal | Entry criteria | Exit criteria |
|---|---|---|---|---|
| 0 | Repository inspection & assumptions | Know the ground truth; document decisions | Repo exists | Inspection recorded; assumptions documented (index §4) |
| 1 | PRD & documentation approval | Freeze MVP scope and contracts | Documentation v0.1.0 generated | Human stakeholder approval; agent roles countersigned; docs bumped to v1.0 |
| 2 | Scaffolding & conventions | Working, boring foundation | Approval (T-004) | `npm run dev/build/lint/typecheck/test` all green in CI on an empty app |
| 3 | Auth & database foundations | Identity + schema live | Phase 2 exit | Signup→login→session works against local Postgres; migrations + search SQL applied; authz middleware proven |
| 4 | Item & location management | The core CRUD memory model | Phase 3 exit | Full item/location/event flows usable in UI; ownership matrix tests green |
| 5 | Dashboard & search | Recall surface without AI | Phase 4 exit | Dashboard, inventory table, deterministic search usable and tested |
| 6 | Groq assistant | Grounded NL layer | Phase 5 exit | Assistant round-trips + confirmations + fallback + eval suite gates green |
| 7 | Security, QA, observability | Harden | Phase 6 exit | Security gate passed; coverage/risk targets met; logging/metrics live |
| 8 | AWS deployment & release | Ship | Phase 7 exit | Staging smoke recorded, restore drill done, release checklist signed |

Phases 2–5 are sequential because each layer's tests depend on the previous. Within a
phase, tasks marked parallel in [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) may run
concurrently by different agents (e.g., T-030 locations API ∥ T-032 items API).

## 2. Working agreements

1. **Task granularity:** a task = one reviewable unit with explicit verification commands.
   Nothing is "done" without recorded command results (AGENT_SPEC §2.8).
2. **Branching:** `main` is always releasable; work happens on `task/T-###-slug` branches;
   Review merges after checks + review verdict.
3. **CI is the referee:** lint, typecheck, unit/integration tests, `prisma validate`,
   production build must pass on every merge (T-012).
4. **Docs travel with code:** any behavior/schema/API change updates the corresponding doc
   in the same PR; the Review agent checks this.
5. **Environment discipline:** local only until Phase 8; no AWS resources exist before
   T-070; the Groq key is used live only from local dev by the AI agent (BR-12 caps).
6. **Scope freezes:** P0 scope (PRD §8.1) is frozen at T-004; changes require Product
   re-triage and a PRD version bump.

## 3. Phase details (what "happens" in each)

### Phase 0 — done in this documentation run
- Repository inspected: empty directory, no git repo; Node 24.13.0 / npm 11.6.2 / git 2.52.0 available.
- Documentation set v0.1.0 generated; locked decisions recorded (index §4).
- Pricing assumptions researched and labeled (COST_ESTIMATION.md).
- Remaining: T-003 (cross-consistency review), T-004 (human approval).

### Phase 1 — approval gate (human-in-the-loop)
- Review Agent + Security Review Agent run the cross-checks in
  [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) §docs.
- Stakeholder reviews PRD scope, cost model, and ADRs; approves or requests changes.
- Roles countersigned (T-005); docs versioned to v1.0; CHANGELOG entry (T-006).
- **No application code before this gate passes.**

### Phase 2 — scaffolding (T-010…T-015)
- Next.js + TypeScript strict + Tailwind + shadcn/ui + Lucide; versions pinned at scaffold time.
- ESLint (incl. import-boundary rules for the layering), Prettier, Vitest, Playwright.
- CI pipeline (lint → typecheck → test → prisma validate → build).
- Design tokens (DESIGN_SYSTEM.md) + theme provider; app shell (sidebar/topbar/breadcrumbs,
  responsive, empty/error/loading primitives).

### Phase 3 — auth & database (T-020…T-025)
- Supabase Free project, PostgreSQL 16, Prisma (pooled `DATABASE_URL` + direct `DIRECT_URL`);
  typed env loader (Zod-validated env from `.env.example`). Native/Docker local Postgres is an
  optional developer fallback (DEFINITION_OF_DONE.md records the no-Docker fallback used in practice).
- `prisma migrate dev` (V1 init, V2 search, V3 location uniques) + deterministic seed.
- Supabase project provisioned (T-020) → HS256 JWT verification module
  (`SUPABASE_JWT_SECRET`) → `requireUser()` guard → `/api/me`.
- Auth pages wired to Supabase Auth via `/api/auth/*` (email verification + recovery flows
  tested manually once).

### Phase 4 — items & locations (T-030…T-037)
- Locations + items + events APIs (Zod → service → repository; transactions where multi-write).
- UI: management pages, forms, item detail with history timeline, archive/delete/restore dialogs.
- Ownership-matrix integration tests (the FR-012 gate) — QA leads.

### Phase 5 — dashboard & search (T-040…T-044)
- `search.repo` ranking (exact → prefix → trigram → FTS) + search results UI.
- Dashboard aggregations + cards + empty states for new users.
- Inventory table hardening: filters, sort, pagination, mobile fallback.

### Phase 6 — assistant (T-050…T-057)
- LlmProvider interface + GroqProvider (bounds, JSON mode) + MockProvider.
- Prompts from docs/prompts implemented verbatim; classification + generation schemas.
- Retrieval service (reuses search.repo) → pipeline → grounding validator (FR-010).
- Assistant API + UI (conversation, confirmation cards, candidate pickers, fallback UX).
- Eval suite in CI via MockProvider; one recorded live-model run before exit.

### Phase 7 — security, QA, observability (T-060…T-066)
- Rate limiting, security headers, redaction-tested logger, audit events.
- Security review gate: threat-model refresh, findings list, fixes, sign-off.
- QA regression sweep + coverage report against TEST_PLAN targets.
- Dependency + secret scanning in CI.

### Phase 8 — AWS deployment & release (T-070…T-075)
- CDK (D4 scope): Secrets Manager, CloudWatch alarms, budget alert. No VPC/RDS/Cognito —
  database and auth are Supabase (ADR-005); the database is reached through Supabase's shared
  pooler (public IPv4 endpoint, TLS required).
- Amplify Hosting app + build spec + environment wiring (incl. `SUPABASE_JWT_SECRET` for
  staging/prod); staging deploy + recorded smoke test.
- Backup policy + one restore drill; cost actuals vs assumptions; release checklist + v1.0.0.

## 4. Risk checkpoints (explicit stop points)

| After | Checkpoint |
|---|---|
| T-004 | Cost model accepted? (MVP fixed cost ≈ $0 via Supabase Free + Amplify allowances; alternatives documented) |
| T-023 | Supabase Auth UX acceptable in a real browser? (Assumption A-7; fallback: Auth.js — documented in SECURITY.md) |
| T-053 | Grounded-answer quality ≥ eval gates? If not: prompt iteration loop, then model/config changes within Groq, then scope talk — in that order |
| T-064 | Any open high-severity security finding blocks Phase 8 |
| T-072 | Staging smoke failure blocks release regardless of schedule |

## 5. Definition of done

Per-task DoD: [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md). Phase exit = all its tasks
`done` with evidence + no open blocking review findings. MVP exit = PRD §17 release criteria.
