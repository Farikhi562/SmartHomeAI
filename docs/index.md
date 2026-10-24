# SmartHomeAI — Documentation Index

**Version:** 0.1.0 (documentation phase)
**Status:** Draft for review — Phase 0/1 documentation complete (2026-10-15); Phase 2 scaffolding started 2026-10-15 (partial: tooling + `src/lib`/`src/server` foundations, no `app/` yet); T-003 registry adjudication resolved 2026-10-17 (see [CONTRACT.md](CONTRACT.md) §0).
**Last updated:** 2026-10-17

SmartHomeAI is an AI-powered personal belongings memory platform: users record where they
placed their belongings, and a natural-language assistant answers questions grounded in
those records. This repository is documentation-first: the system is specified here before
application code is written.

---

## 1. How to read this documentation

| If you are... | Start here |
|---|---|
| A product stakeholder | [PRD](product/PRD.md) → [Roadmap](product/ROADMAP.md) |
| A designer | [Design Spec](design/DESIGN_SPEC.md) → [Design System](design/DESIGN_SYSTEM.md) |
| An application developer | [System Architecture](architecture/SYSTEM_ARCHITECTURE.md) → [API Spec](architecture/API_SPEC.md) → [Implementation Plan](planning/IMPLEMENTATION_PLAN.md) |
| A database engineer | [Database Schema](architecture/DATABASE_SCHEMA.md) → `prisma/schema.prisma` |
| An AI engineer | [AI Architecture](architecture/AI_ARCHITECTURE.md) → [prompts](prompts/SYSTEM_PROMPT.md) |
| A cloud/DevOps engineer | [AWS Architecture](architecture/AWS_ARCHITECTURE.md) → [Deployment](architecture/DEPLOYMENT.md) |
| A coding agent | [Agent Spec](agents/AGENT_SPEC.md) → [Agent Workflow](agents/AGENT_WORKFLOW.md) → [Task Breakdown](planning/TASK_BREAKDOWN.md) |
| A QA engineer | [Test Plan](planning/TEST_PLAN.md) → [Acceptance Criteria](requirements/ACCEPTANCE_CRITERIA.md) |

## 2. Document map

### Product
- [product/PRD.md](product/PRD.md) — Product requirements document (canonical scope).
- [product/PRODUCT_VISION.md](product/PRODUCT_VISION.md) — Vision, principles, positioning.
- [product/PERSONAS.md](product/PERSONAS.md) — User personas.
- [product/USER_STORIES.md](product/USER_STORIES.md) — User stories with `US-` IDs.
- [product/USE_CASES.md](product/USE_CASES.md) — Use cases with `UC-` IDs.
- [product/ROADMAP.md](product/ROADMAP.md) — P0/P1/P2 roadmap.

### Requirements
- [requirements/FUNCTIONAL_REQUIREMENTS.md](requirements/FUNCTIONAL_REQUIREMENTS.md) — `FR-` IDs (canonical).
- [requirements/NON_FUNCTIONAL_REQUIREMENTS.md](requirements/NON_FUNCTIONAL_REQUIREMENTS.md) — `NFR-` IDs.
- [requirements/ACCEPTANCE_CRITERIA.md](requirements/ACCEPTANCE_CRITERIA.md) — `AC-` IDs, Given/When/Then.
- [requirements/BUSINESS_RULES.md](requirements/BUSINESS_RULES.md) — `BR-` rules (retention, uniqueness, hierarchy).
- [requirements/GLOSSARY.md](requirements/GLOSSARY.md) — Shared terminology.

### Design
- [design/DESIGN_SPEC.md](design/DESIGN_SPEC.md) — Pages, layouts, states, responsive behavior.
- [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) — Tokens, components, themes.
- [design/INFORMATION_ARCHITECTURE.md](design/INFORMATION_ARCHITECTURE.md) — Navigation and hierarchy.
- [design/USER_FLOWS.md](design/USER_FLOWS.md) — Key flows.
- [design/WIREFRAMES.md](design/WIREFRAMES.md) — ASCII wireframes.
- [design/ACCESSIBILITY.md](design/ACCESSIBILITY.md) — Accessibility requirements (WCAG 2.1 AA target).

### Architecture
- [architecture/SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md) — Components, layers, request flows.
- [architecture/DATABASE_SCHEMA.md](architecture/DATABASE_SCHEMA.md) — Entities, indexes, constraints (mirrors `prisma/schema.prisma`).
- [architecture/API_SPEC.md](architecture/API_SPEC.md) — REST contracts, DTOs, error envelope.
- [architecture/AI_ARCHITECTURE.md](architecture/AI_ARCHITECTURE.md) — Groq pipeline, grounding, safety, fallback.
- [architecture/AWS_ARCHITECTURE.md](architecture/AWS_ARCHITECTURE.md) — AWS services, justifications, topology.
- [architecture/SECURITY.md](architecture/SECURITY.md) — Threat model and controls.
- [architecture/OBSERVABILITY.md](architecture/OBSERVABILITY.md) — Logging, metrics, alarms.
- [architecture/DEPLOYMENT.md](architecture/DEPLOYMENT.md) — Environments, CI/CD, migrations, rollback.
- [architecture/DISASTER_RECOVERY.md](architecture/DISASTER_RECOVERY.md) — Backups, RTO/RPO, restore drills.
- [architecture/adr/ADR-001-application-architecture.md](architecture/adr/ADR-001-application-architecture.md) — Modular monolith on Next.js.
- [architecture/adr/ADR-002-database.md](architecture/adr/ADR-002-database.md) — PostgreSQL + Prisma (hosting amended to Supabase by ADR-005).
- [architecture/adr/ADR-005-supabase.md](architecture/adr/ADR-005-supabase.md) — Supabase platform: managed Postgres + Auth (amends D2/D4/D5).
- [architecture/adr/ADR-003-llm-provider.md](architecture/adr/ADR-003-llm-provider.md) — Groq behind a provider abstraction.
- [architecture/adr/ADR-004-deployment.md](architecture/adr/ADR-004-deployment.md) — AWS Amplify Hosting + AWS CDK.

### Agents
- [agents/AGENT_SPEC.md](agents/AGENT_SPEC.md) — Agent model, permissions matrix, rules (canonical).
- [agents/ORCHESTRATOR_AGENT.md](agents/ORCHESTRATOR_AGENT.md), [PRODUCT_AGENT.md](agents/PRODUCT_AGENT.md),
  [DESIGN_AGENT.md](agents/DESIGN_AGENT.md), [FRONTEND_AGENT.md](agents/FRONTEND_AGENT.md),
  [BACKEND_AGENT.md](agents/BACKEND_AGENT.md), [AI_AGENT.md](agents/AI_AGENT.md),
  [AWS_INFRA_AGENT.md](agents/AWS_INFRA_AGENT.md), [QA_AGENT.md](agents/QA_AGENT.md),
  [SECURITY_REVIEW_AGENT.md](agents/SECURITY_REVIEW_AGENT.md), [REVIEW_AGENT.md](agents/REVIEW_AGENT.md)
- [agents/AGENT_WORKFLOW.md](agents/AGENT_WORKFLOW.md) — Handoffs and coordination.
- [agents/CODING_STANDARDS.md](agents/CODING_STANDARDS.md) — Code style and conventions.

### Planning
- [planning/IMPLEMENTATION_PLAN.md](planning/IMPLEMENTATION_PLAN.md) — Phases 0–8 (canonical).
- [planning/TASK_BREAKDOWN.md](planning/TASK_BREAKDOWN.md) — `T-` tasks with dependencies and verification.
- [planning/TRACEABILITY_MATRIX.md](planning/TRACEABILITY_MATRIX.md) — PRD → FR → US → AC → API → DB → Task → Test.
- [planning/MILESTONES.md](planning/MILESTONES.md) — Milestones and exit criteria.
- [planning/RISKS.md](planning/RISKS.md) — Risk register with mitigations.
- [planning/COST_ESTIMATION.md](planning/COST_ESTIMATION.md) — AWS/Groq cost assumptions.
- [planning/TEST_PLAN.md](planning/TEST_PLAN.md) — Test strategy, levels, `UT/IT/E2E/AIE-` IDs.
- [planning/DEFINITION_OF_DONE.md](planning/DEFINITION_OF_DONE.md) — DoD checklists.

### AI prompts
- [prompts/SYSTEM_PROMPT.md](prompts/SYSTEM_PROMPT.md) — Base system prompt.
- [prompts/INTENT_CLASSIFICATION.md](prompts/INTENT_CLASSIFICATION.md) — Intent taxonomy + classification rules.
- [prompts/MEMORY_EXTRACTION.md](prompts/MEMORY_EXTRACTION.md) — Entity/action extraction spec.
- [prompts/ANSWER_GENERATION.md](prompts/ANSWER_GENERATION.md) — Grounded answer rules + templates.
- [prompts/EVALUATION_CASES.md](prompts/EVALUATION_CASES.md) — Evaluation fixtures.

### Cross-document registers
- [CONTRACT.md](CONTRACT.md) — **adjudication record (T-003, 2026-10-17)** + live `D-OPEN-*` open-decisions register; all other sections marked SUPERSEDED with pointers to canonical docs.

### Repository root
- [README.md](../README.md), [CONTRIBUTING.md](../CONTRIBUTING.md), [CHANGELOG.md](../CHANGELOG.md),
  [.env.example](../.env.example), [.gitignore](../.gitignore)

## 3. ID conventions

| Prefix | Meaning | Canonical definition |
|---|---|---|
| `FR-###` | Functional requirement | `requirements/FUNCTIONAL_REQUIREMENTS.md` |
| `NFR-###` | Non-functional requirement | `requirements/NON_FUNCTIONAL_REQUIREMENTS.md` |
| `BR-##` | Business rule | `requirements/BUSINESS_RULES.md` |
| `AC-###-#` | Acceptance criterion (`AC-<FR>-<n>`) | `requirements/ACCEPTANCE_CRITERIA.md` |
| `US-###` | User story | `product/USER_STORIES.md` |
| `UC-##` | Use case | `product/USE_CASES.md` |
| `ADR-00#` | Architecture decision record | `architecture/adr/` |
| `T-###` | Implementation task | `planning/TASK_BREAKDOWN.md` |
| `M-#` | Milestone | `planning/MILESTONES.md` |
| `R-##` | Risk | `planning/RISKS.md` |
| `UT/IT/E2E/AIE-###-#` | Unit / integration / e2e / AI-evaluation test | `planning/TEST_PLAN.md` |

IDs are stable forever: never reuse an ID after retirement; add a new one.

## 4. Locked architectural decisions (summary)

These decisions are binding for all agents and developers until an ADR supersedes them.

| # | Decision | Rationale | ADR |
|---|---|---|---|
| D1 | **Modular monolith** on Next.js (App Router) with Route Handlers as the only HTTP layer for the MVP. No Lambda/API Gateway backend. | Simplest architecture meeting security, deployment, maintainability needs; one deployable. | ADR-001 |
| D2 | **PostgreSQL 16 + Prisma ORM**, hosted on **Supabase** — pooled runtime URL (`DATABASE_URL`) + direct migration URL (`DIRECT_URL`). MVP runs on Supabase **Free tier ($0)**; local Docker Postgres remains an optional fallback only. *(Amended 2026-10-17 by user decision: superseded "local Docker + Amazon RDS db.t4g.micro" — see ADR-005.)* | Relational data with ownership constraints; no DB operations burden; $0 at MVP scale. | ADR-002, ADR-005 |
| D3 | **Groq** is the initial LLM provider, behind a provider-agnostic interface; default model `llama-3.3-70b-versatile` (configurable via env). | Product requirement; fast + cheap; swappable later. | ADR-003 |
| D4 | **AWS Amplify Hosting** (SSR) for the web app; **AWS CDK (TypeScript)** for remaining provisionable infrastructure (Secrets Manager, CloudWatch alarms, budget). Database and auth live on Supabase (D2/D5, ADR-005), so CDK no longer provisions Cognito or RDS. *(Amended 2026-10-17.)* | Managed Next.js hosting; one language for app + IaC. | ADR-004, ADR-005 |
| D5 | **Supabase Auth** (GoTrue) for authentication: email + password registration, login, recovery, verification — sessions issued by Supabase, **JWT verified server-side** (HS256, `SUPABASE_JWT_SECRET`) on every protected operation. Never trust browser-supplied user IDs. *(Amended 2026-10-17 by user decision: superseded "Amazon Cognito Essentials" — see ADR-005. Local `AUTH_MODE=dev` remains available for offline development only, refused in production.)* | Managed auth flows; one vendor with the database; free ≤ 50k MAU. | ADR-005, SECURITY.md |
| D6 | **Search = PostgreSQL full-text search + `pg_trgm` fuzzy matching.** No embeddings/vector database in the MVP. | Evaluation of FTS shows sufficiency at personal-inventory scale. | AI_ARCHITECTURE.md |
| D7 | **AWS-inspired enterprise dashboard** design; light theme default, dark theme optional; deep navy navigation; restrained blue primary. | Spec §3; no AWS branding/assets copied. | DESIGN_SPEC.md |

## 5. Documented deviations from the target structure

1. `docs/planning/TRACEABILITY_MATRIX.md` added (structure lists no traceability file; §16 of the master spec requires a matrix).
2. `prisma/schema.prisma` is created during the documentation phase as the **normative schema artifact** (design-as-code). It defines no runtime behavior; migrations and client generation begin at Phase 3 (task `T-021`).
3. `infrastructure/` and `tests/` are still intentionally **not** created — empty directories would be noise; they arrive with Phase 8 and the test tasks. `src/`, `package.json`, and tooling configs **were** created by the partial Phase 2 scaffolding of 2026-10-15 (T-010/T-011 groundwork: TS/ESLint/Vitest/Tailwind configs, `src/lib`, `src/server`, generated Prisma client — no `app/` pages yet).
4. **`docs/CONTRACT.md` — adjudicated 2026-10-17 (T-003): this documentation set is authoritative.**
   A parallel documentation run created that file (and earlier drafts of ADR-001…004) during the
   2026-10-15 documentation phase. It conflicted with this set on FR/US/BR/NFR numbering, API base
   path (`/api/v1` vs `/api/*`), auth mechanism (Auth.js cookies vs Cognito JWT), WCAG level, RTO,
   cost ceiling, region, event-correction semantics, and task-ID ranges — and was frozen as a
   competing registry pending adjudication. The set rooted in this index (D1–D7,
   FR-001…FR-030 in `FUNCTIONAL_REQUIREMENTS.md`, `API_SPEC.md`, `prisma/schema.prisma`) is
   internally consistent and follows the master specification directly. **Resolution (T-003,
   2026-10-17): this set wins on every conflict point.** `CONTRACT.md` now holds the adjudication
   record (§0: conflict-by-conflict rationale, cross-review findings F-1…F-8, verification
   evidence) plus the live `D-OPEN-*` open-decisions register (§9); its remaining sections are
   marked SUPERSEDED with pointers to the canonical documents. The stakeholder may revisit any
   adjudicated row at the T-004 approval gate.

## 6. Ground rules for every contributor (human or agent)

1. The database is the source of truth. The LLM never invents items, locations, timestamps, or IDs.
2. Every protected operation enforces server-side authorization scoped to the authenticated user.
3. Never mark a task, test, or deployment complete unless it actually ran and its result is recorded.
4. Never commit real secrets; `.env.example` documents variables with placeholder values only.
5. Do not add AWS services, dependencies, or abstractions not justified by a documented requirement.
6. Keep P0 scope intact; new ideas become P1/P2 candidates in the roadmap, not scope creep.
