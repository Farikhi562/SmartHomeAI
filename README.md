# SmartHomeAI

**AI-powered personal belongings memory platform.** Record where you last placed your
things; ask in plain language; get grounded answers from your own records.

> *"Where did I last put my motorcycle keys?"*
> "Your last recorded entry says the keys were placed on the living room shelf yesterday at
> 8:30 PM. This is the last recorded location, so they may have been moved since then."

SmartHomeAI is a **memory and record-retrieval system** — it does not track objects in
real time. Answers are grounded in what you recorded, and the system says so.

## Status

**Phase 1 — documentation & planning.** The application is not implemented yet. This
repository currently contains the complete specification: product, requirements, design,
architecture, security, agent roles, and an executable implementation plan.

| | |
|---|---|
| Documentation | v0.1.0 (draft for review) — see [docs/index.md](docs/index.md) |
| Next milestone | M-1: documentation approval gate ([T-004](docs/planning/TASK_BREAKDOWN.md)) |
| Implementation start | Phase 2, after approval |

## The product in five bullets

- Items (keys, wallet, chargers, documents…) with categories and optional aliases.
- Locations with a simple home hierarchy (depth ≤ 3) and **append-only location history**.
- Deterministic search (PostgreSQL full-text + trigram fuzzy matching).
- A Groq-powered assistant that answers questions **grounded in your records**, asks
  clarifying questions on ambiguity, and only writes after explicit confirmation.
- A single-owner, private-by-default dashboard with an AWS-inspired enterprise design.

## Stack (locked decisions — details in [docs/index.md](docs/index.md) §4)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript strict, Tailwind CSS, shadcn/ui, Lucide |
| Backend | Modular monolith — Next.js Route Handlers, layered services/repositories |
| Database | PostgreSQL (local Docker; Amazon RDS for cloud), Prisma, versioned migrations |
| Auth | Amazon Cognito; server-side JWT verification on every protected operation |
| AI | Groq (default `llama-3.3-70b-versatile`, configurable) behind a provider abstraction |
| Cloud | AWS Amplify Hosting (SSR) + AWS CDK (TypeScript) for Cognito/RDS/Secrets/alarms |
| Quality | Vitest, Playwright, AI-evaluation suite, GitHub Actions CI |

## Repository layout

```text
SmartHomeAI/
├── docs/                  # ← start here: docs/index.md
│   ├── product/           # PRD, personas, stories, roadmap
│   ├── requirements/      # FR/NFR/AC/business rules/glossary
│   ├── design/            # design spec, tokens, IA, flows, a11y
│   ├── architecture/      # system, DB, API, AI, AWS, security, ops + ADRs
│   ├── agents/            # coding-agent roles, permissions, workflows
│   ├── planning/          # implementation plan, tasks, risks, costs, tests
│   └── prompts/           # assistant prompt specifications
├── prisma/                # normative schema + versioned SQL migrations + dev seed
│   ├── schema.prisma      # design artifact (docs/architecture/DATABASE_SCHEMA.md mirrors it)
│   ├── migrations/        # 000001_init, 000002_search, 000003_location_uniques
│   └── seed.ts            # deterministic demo data (local/dev only)
├── src/                   # Next.js App Router application code
│   ├── app/               # pages + API route handlers (thin)
│   ├── lib/               # config, auth, db, errors, validation, providers
│   └── server/            # repositories, services, rules, assistant pipeline
├── infrastructure/        # (Phase 8) AWS CDK
├── tools/validate-docs.mjs # documentation validator (T-002 evidence tool)
└── tests/                 # unit / integration / e2e / ai-evaluation
```

## Getting started

```bash
npm install            # dependencies
cp .env.example .env   # local values (template placeholders are treated as unset)
docker compose up -d   # local PostgreSQL 16 — or use a native Postgres and set DATABASE_URL
npm run db:migrate     # apply prisma/migrations (first run needs a reachable DB)
npm run db:seed        # deterministic demo data (optional)
npm run dev            # http://localhost:3000
```

Authentication runs in **dev mode** locally (any email signs you in via
`POST /api/auth/dev-login`, guarded to non-production — see `src/lib/config/env.ts`);
production uses Amazon Cognito (D5). Without a `GROQ_API_KEY` the assistant falls back to a
deterministic mock provider, so every flow works offline.

Useful checks:

```bash
npm run validate:docs  # docs: links, diagrams, FR/AC/US cross-references
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint (next/core-web-vitals + typescript)
npm test               # Vitest unit tests (integration tests need a DB: IT_PG=1)
npm run build          # production build
```

**No Docker on your machine?** Docker is unavailable on the currently inspected dev
machine (risk R-08); a native PostgreSQL 16 install with matching `DATABASE_URL` is the
documented fallback (docs/planning/TASK_BREAKDOWN.md T-020).

Also worth reading:

1. [docs/index.md](docs/index.md) — the map of everything.
2. [docs/product/PRD.md](docs/product/PRD.md) — what we are building and why.
3. [docs/planning/IMPLEMENTATION_PLAN.md](docs/planning/IMPLEMENTATION_PLAN.md) — how
   it is built, phase by phase.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Humans and AI agents follow the same rules:
documentation is the contract, verification evidence is mandatory, and secrets never touch
the repo.

## License

TBD (choose before public release — tracked as a release-checklist item).
