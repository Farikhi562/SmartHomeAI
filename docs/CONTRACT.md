# SmartHomeAI — Documentation Consistency Contract

**Status:** **Adjudicated 2026-10-17 (T-003)** · **Owner:** Orchestrator + Review · **Last updated:** 2026-10-17

> This file was created 2026-10-15 20:24 by a parallel documentation run while a second run was
> generating the rest of the set. It is **no longer a competing registry**. §0 below records the
> adjudication (T-003) that resolved the conflict; §9 remains the **live open-decisions register**
> referenced by ADRs and `AWS_ARCHITECTURE.md`. Every other section is retained only as a
> historical draft and is marked **SUPERSEDED** with a pointer to its canonical document.

---

## 0. Adjudication record (T-003 — 2026-10-17)

**Context.** On 2026-10-15 two parallel generation runs wrote to this repository. Run B produced the
complete documentation set rooted in `docs/index.md` (63 documents + `prisma/schema.prisma` +
`tools/validate-docs.mjs`) and began Phase 2 scaffolding. This file (`docs/CONTRACT.md`, run A)
held an earlier, partially overlapping registry. `index.md` §5 item 4 froze the conflict as a
blocking Phase 1 item pending adjudication (task T-003).

**Decision.** The **index-rooted set is authoritative** for every conflict point. This file is
retained as the adjudication record and the live `D-OPEN-*` register. Stakeholders may overturn any
row below at the T-004 approval gate; overturning a row means editing the canonical document and
this table in the same change.

**Conflict-by-conflict rationale:**

| # | Conflict | Losing value (this file) | Winning value → canonical source | Why it wins |
|---|---|---|---|---|
| 1 | FR/US/BR/NFR/UC ID semantics | draft numbering | set numbering → `requirements/FUNCTIONAL_REQUIREMENTS.md`, `USER_STORIES.md`, `BUSINESS_RULES.md`, `NON_FUNCTIONAL_REQUIREMENTS.md` | All 63 docs, the traceability matrix, prompts, and planned tests already cross-reference it; product substance is identical |
| 2 | API base path | `/api/v1` | **`/api/*`** → `architecture/API_SPEC.md` | Single deployable, breaking-deploy versioning; no consumer benefits from `v1` yet |
| 3 | Auth mechanism | Auth.js cookie sessions | **Cognito JWT (JWKS verification, `jose`)** → index D5, ADR-004, `src/lib/auth` | Closer to the master spec's Cognito mandate; scaffold already implements it |
| 4 | Accessibility level | WCAG 2.2 AA | **WCAG 2.1 AA** → `requirements/NON_FUNCTIONAL_REQUIREMENTS.md` NFR-001 | Set-wide consistent; upgrading to 2.2 is a scoped future revision, not a silent drift |
| 5 | RTO / RPO | 24 h / 24 h | **RTO ≤ 4 h, RPO ≤ 24 h** → NFR-008, `DISASTER_RECOVERY.md` | Stricter target, already written end-to-end |
| 6 | Cost ceiling | ≤ €250/mo | **≤ USD 25/mo** → PRD C-4/BO-3, NFR-011 | Tighter and traced to a PRD constraint; `COST_ESTIMATION.md` honestly flags it as at-risk |
| 7 | AWS Region | `eu-central-1` | **`us-east-1` (proposed default)** → `AWS_ARCHITECTURE.md` §8, still **D-OPEN-002** | All price research is basis-priced there; stakeholder confirms at T-004 |
| 8 | Event correction semantics | void/replace | **pure append (corrections append new events)** → BR-06, `DATABASE_SCHEMA.md` | Strictly matches the master spec's "append-oriented" history; simpler invariant |
| 9 | Task ID ranges | draft `T-0xx` anchors | **set ranges (T-001…T-088)** → `planning/TASK_BREAKDOWN.md` | Matrix, milestones, and role docs all use them |
| 10 | AI evaluation test IDs | `AI-EVAL-*` | **`AIE-###-#`** → `planning/TEST_PLAN.md` | Set-wide convention |
| 11 | Traceability artifact | section inside IMPLEMENTATION_PLAN | **`planning/TRACEABILITY_MATRIX.md`** | Dedicated, complete, validated artifact |
| 12 | Design tokens | §13 draft palette | **aligned** — set's `DESIGN_SYSTEM.md` adopted the same values (`#0B1E34`, `#1769E0`) and cites §13 as drafted baseline | No conflict remains; `DESIGN_SYSTEM.md` is canonical |

**Cross-consistency review findings (T-003, executed 2026-10-17):**

| # | Finding | Resolution |
|---|---|---|
| F-1 | `eslint.config.mjs` could never run: legacy `eslint-config-next` objects spread as flat config; import of nonexistent `eslint-config-next/typescript-eslint` | **Fixed** — FlatCompat rewrite + narrow `no-console` overrides (logger/CLI) + `no-html-link-for-pages` off (App Router only). `npm run lint` → **0 problems, exit 0** (2026-10-17) |
| F-2 | `prisma validate` failed in a fresh checkout: schema needs `env("DIRECT_URL")` but `.env` is gitignored and absent | **Fixed** by documented setup step: `.env` created from `.env.example` (2026-10-17). `prisma validate` → **schema valid** (Prisma CLI 6.19.3) |
| F-3 | `TRACEABILITY_MATRIX.md` claimed "19/19" P0 coverage; actual P0 headings = 18 (FR-001…013, 015, 016, 017, 023, 024) = 18 rows | **Fixed** → "18/18" |
| F-4 | `DISASTER_RECOVERY.md` cited RTO/RPO as "NFR-006 in CONTRACT.md"; canonical set numbers it **NFR-008** (NFR-006 = encryption at rest) | **Fixed** — citation corrected to NFR-008 |
| F-5 | `index.md` stale: "implementation has not started", "`src/` not created", "adjudication pending" | **Fixed** in `index.md` (status, §5.3, §5.4) |
| F-6 | `npm test` exits 1: no test files exist yet | **Deferred by design** — tests arrive with T-015/T-023+. Recommendation for T-012: add `--passWithNoTests` until Phase 3 lands the first suite |
| F-7 | Repository has no `.git` (CONTRIBUTING/CI assume Git + GitHub PRs) | **Deferred** — `git init` is a precondition of T-012 (CI) and T-066 (branch protection); recorded in the T-003 report to the stakeholder |
| F-8 | FR-026…FR-029 (P2) exist as summary rows, not full FR templates | **Explicitly accepted** — they are roadmap-only per `TASK_BREAKDOWN.md` §P2 ("needs ADR + PRD revision before any task"); promote to the full template if ever reprioritized (T-006) |

**Verification evidence for this adjudication (all executed 2026-10-17, this machine):**

- `node tools/validate-docs.mjs` → **ALL CHECKS PASSED** (61 md files, 687 relative links, 23 Mermaid blocks, 30 FRs / 18 P0, 52 AC refs, 29 US refs) — re-run after these edits: see `TASK_BREAKDOWN.md` §4.
- `npm run typecheck` → **exit 0** · `npm run lint` → **exit 0, 0 problems** · `prisma validate` → **valid** · `npm test` → exit 1 (*no test files — expected, F-6*).

**Post-adjudication amendment — same day, 2026-10-17:** the product owner then directed a
platform change, recorded as **ADR-005 (Supabase)**: database hosting → Supabase Free tier
(still PostgreSQL 16 + Prisma; `DATABASE_URL`/`DIRECT_URL` unchanged), authentication →
**Supabase Auth replacing Amazon Cognito**; index §4 D2/D4/D5 amended accordingly. Effects on
this record: rows 1–12 resolved the *registry* question and stand; row 3's winner (Cognito
JWT) is now further superseded by Supabase Auth — the mechanism is unchanged (server-verified
JWT, `ownerId` from token `sub`, httpOnly session cookie). §9 below carries the per-entry
ADR-005 annotations (retirements/mootness) in place.

**Going forward:** edit §0 and §9 of this file only through a T-003-style adjudication. All other sections are frozen history; never implement from them.

---

## 1. Repository state and environment facts — *historical snapshot (2026-10-15)*

Valid as of the Phase 0 inspection: repository was **empty** (no files, no `.git`); Node v24.13.0,
npm 11.6.2, git 2.52.0.windows.1, Python 3.13.7; **Docker not installed** (D-OPEN-005); no external
network validation of AWS/Groq documentation was possible (all such claims are labeled ASSUMPTION).
*Update 2026-10-17:* scaffolding now exists (`package.json`, `tsconfig.json`, `src/lib`,
`src/server`, generated Prisma client) — still no `.git`, no `app/`, no `tests/`.

## 2. Binding decisions — **SUPERSEDED** → `docs/index.md` §4 (D1–D7) + ADR-001…004

(Where this draft's D-1…D-8 differ — notably D-5 auth — the index/ADR values win. See §0 row 3.)

## 3. Functional requirement registry — **SUPERSEDED** → `requirements/FUNCTIONAL_REQUIREMENTS.md`

Canonical: 30 `FR-###` (18 P0). Same identifier *scheme*, set-defined *semantics* (note: identical
IDs do **not** always denote the same requirement as this draft — always resolve against the
canonical file). Per-FR field template unchanged: priority · rationale · preconditions · expected
behavior · error conditions · acceptance criteria · dependencies · test coverage.

## 4. User story registry — **SUPERSEDED** → `product/USER_STORIES.md` (`US-###` ↔ FR mapping lives there)

## 5. Business rule registry — **SUPERSEDED** → `requirements/BUSINESS_RULES.md` (`BR-##`, 2-digit: e.g. BR-06 append-only events)

## 6. Non-functional requirement registry — **SUPERSEDED** → `requirements/NON_FUNCTIONAL_REQUIREMENTS.md`

Canonical `NFR-001…NFR-015`. Citation trap recorded in §0 F-4: this draft's `NFR-006` slot is not
the set's `NFR-006`; RTO/RPO = **NFR-008** in the canonical file.

## 7. Task ID ranges — **SUPERSEDED** → `planning/TASK_BREAKDOWN.md`

Canonical ranges: Phase 0 `T-001…T-002` · Phase 1 `T-003…T-006` · Phase 2 `T-010…T-015` ·
Phase 3 `T-020…T-025` · Phase 4 `T-030…T-037` · Phase 5 `T-040…T-044` · Phase 6 `T-050…T-057` ·
Phase 7 `T-060…T-066` · Phase 8 `T-070…T-075` · P1 backlog `T-080…T-088`. Status vocabulary:
`todo | blocked | done (verified <date>)`.

## 8. Risk seed — **SUPERSEDED** → `planning/RISKS.md` (canonical `R-##`, 2-digit)

This draft's seed informed the canonical register (e.g. WAF-at-edge = this `R-010` ≡ canonical
`R-10`; Amplify↔RDS = this `R-002` ≡ canonical `R-09`; bus-factor = `R-013` ≡ `R-12`).

## 9. Open decisions register — **LIVE** (canonical `D-OPEN-*`; cited by ADR-002/003/004, `AWS_ARCHITECTURE.md`, `DEPLOYMENT.md`)

| ID | Decision | Current position | Owner · Needed by |
|---|---|---|---|
| D-OPEN-001 | How the hosted app reaches RDS in private subnets (Amplify SSR VPC attachment unverified offline) | **MOOT pending closure (ADR-005, 2026-10-17)** — no RDS remains in the topology; the database is Supabase-hosted and reached over its pooler via public HTTPS, so no VPC path is required. *Residual:* `ADR-004` status line and `RISKS.md` R-09 still record it as open — close both in the next doc sweep (the T-070/T-071 spike becomes a simple Amplify→Supabase reachability check) | AWS Infra · Phase 8 |
| D-OPEN-002 | AWS Region | **Effectively settled (ADR-005 §5):** Supabase `US East (Iowa)` co-located with Amplify `us-east-1` (price-research basis, `AWS_ARCHITECTURE.md` §8); this draft's `eu-central-1` loses — formal stakeholder confirmation still at T-004 | AWS Infra · T-004 |
| D-OPEN-003 | Credential source for Cognito admin actions (account deletion, FR-014 P1) | **Retired (ADR-005)** — Cognito is gone; account deletion uses the Supabase Auth admin path (GoTrue admin API / scoped SQL), see FR-014 and ROADMAP P1 row | ~~Security + AWS Infra~~ → closed |
| D-OPEN-004 | Groq model id + structured-output support | `GROQ_MODEL` default `llama-3.3-70b-versatile` (**ASSUMPTION**); JSON-mode + Zod + one repair retry regardless | AI Agent · Phase 6 (T-051) |
| D-OPEN-005 | Local PostgreSQL on a machine without Docker | **Resolved (ADR-005):** hosted Supabase removes the local-DB blocker — local dev points `DATABASE_URL`/`DIRECT_URL` at the Supabase project; Docker Compose remains an optional fallback only (`DEPLOYMENT.md` env table still cites the pre-ADR-005 wording — sweep pending) | Backend · T-020 |
| D-OPEN-006 | Cognito email delivery limits | **Retargeted (ADR-005):** now *Supabase* email limits — built-in email is rate-limited (~2–3/hour, PRD assumptions row); custom SMTP for staging/prod or confirmations disabled in dev. SES no longer applicable (auth left Cognito); `AWS_ARCHITECTURE.md` SES row + `RISKS.md` still carry the Cognito-era framing — sweep pending | AWS Infra · Phase 3 (T-022) |
| D-OPEN-007 | TanStack Table for the inventory table | **Resolved yes** at T-044 (task deliverable); kept here for traceability | Frontend · T-044 |
| D-OPEN-008 | License | Open — decide before any public release | Product · T-006/release |

## 10. Data model registry — **SUPERSEDED** → `architecture/DATABASE_SCHEMA.md` (normative mirror: `prisma/schema.prisma`)

## 11. API registry — **SUPERSEDED** → `architecture/API_SPEC.md` (base `/api/*`; error envelope; status↔code mapping)

## 12. UI route registry — **SUPERSEDED** → `design/INFORMATION_ARCHITECTURE.md` + `design/DESIGN_SPEC.md` (14 required pages)

## 13. Design token registry — **aligned; canonical → `design/DESIGN_SYSTEM.md`**

Set's DESIGN_SYSTEM adopted this draft's palette unchanged (`--navy-900 #0B1E34`,
`--blue-600 #1769E0`, light/dark semantic CSS variables, Inter, 14 px base, 4 px spacing,
breakpoints 640/768/1024/1280) and cites this section as the drafted baseline. Implement from
DESIGN_SYSTEM only.

## 14. AI pipeline registry — **SUPERSEDED** → `architecture/AI_ARCHITECTURE.md` + `docs/prompts/*`

Substance was identical in both drafts (authenticate → validate → classify → extract → scoped
retrieval → bounded context → Groq JSON → Zod + citation-ID validation → clarification or proposed
action → persist only after user confirmation). Safety invariants are normative in
AI_ARCHITECTURE.md.

## 15. Analytics event registry — **SUPERSEDED** → `product/PRD.md` §15 (privacy-limited events)

## 16. Verification commands — **LIVE in effect; canonical → `package.json` scripts**

Actual scripts now: `lint` · `typecheck` · `test` · `test:watch` · `test:ai` · `build` · `dev` ·
`db:migrate` · `db:deploy` · `db:seed` · `db:studio` · `validate:docs`. (`test:e2e` arrives with the
Playwright setup task.)

## 17. Cost frame — **SUPERSEDED** → `planning/COST_ESTIMATION.md`

Canonical: **USD**, `us-east-1`, budget **≤ USD 25/mo** (PRD C-4) with honest at-risk flagging.
All €/`eu-central-1` figures in this draft's history are void.

## 18. Test ID scheme — **SUPERSEDED** → `planning/TEST_PLAN.md` (`UT` / `IT` / `E2E` / `AIE`)

## 19. Writing conventions and honesty rules — **SUPERSEDED** → `docs/index.md` §3 + §6 + `CONTRIBUTING.md`

Unchanged in substance: stable IDs, relative links, Mermaid fences, no fabricated
tests/deploys/resources, ASSUMPTION labels on unverified external claims, task status only with
recorded evidence.
