# ADR-002: Database — PostgreSQL + Prisma on Amazon RDS

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | **Amended 2026-10-17** by ADR-005 — hosting moved to Supabase (Free tier); PostgreSQL + Prisma (the core of this ADR) remains in force. Superseded portion: local Docker dev DB as primary + Amazon RDS `db.t4g.micro` (now: optional Docker fallback only, no RDS) |
| Date | 2026-10-15 |
| Decision ID | D2 ([index.md §4](../../index.md)) |
| Deciders | Principal Architect, Backend Agent |

## Context

SmartHomeAI is a record system: items, aliases, locations, append-only location events,
conversations/messages, preferences, audit events
([DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)). Required properties:

- **Relational integrity:** ownership (`ownerId`) on every user-scoped table, foreign keys,
  uniqueness (sibling locations, alias normalization), append-only history (BR-06).
- **Transactions:** multi-write operations (assistant confirm: resolve/create location +
  insert event + consume pending action) must be atomic (FR-024 flow).
- **Search:** deterministic full-text + fuzzy search over names/aliases/locations must be
  evaluated **before** any vector infrastructure (D6).
- **Cost ceiling:** MVP budget ≤ USD 25/mo total (C-4) — the database is the largest fixed
  line item, so instance choice is a budget decision.
- **Managed operations:** one small team; backups/patching should be AWS-managed.

## Considered options

| Option | Pros | Cons |
|---|---|---|
| **(A) PostgreSQL 16 + Prisma on Amazon RDS `db.t4g.micro` Single-AZ** *(chosen)* | Full relational integrity + transactions; `pg_trgm` + `tsvector` search already in-engine (D6); managed backups/PITR (DR basis); ~$14/mo assumption; Prisma fits the TypeScript stack; local Docker parity | Fixed monthly cost; Single-AZ = restore-based DR; Prisma migration discipline required |
| (B) Aurora PostgreSQL Serverless v2 | Autoscaling, Data API escape hatch for network constraints | Min-ACU billing (~0.5 ACU) costs more than `db.t4g.micro` at MVP scale (**assumption**); retained only as ADR-004 network fallback path 3 |
| (C) Amazon DynamoDB | Fully managed, pay-per-request | Poor fit for relational history, joins, ad-hoc search; forces app-side joins and weakens DB-level ownership constraints |
| (D) MongoDB (DocumentDB or self-managed) | Flexible documents | Weaker schema/ownership enforcement than required; no win for this workload; extra ops surface |
| (E) SQLite (file-backed) | Zero cost/ops | No networked multi-instance access, no managed backups, no PITR — fails DR and hosting requirements |
| (F) Serverless Postgres PaaS (Neon/Supabase) | Generous free tiers, branchable DBs | Deviates from the AWS-managed requirement (spec); possible escape hatch only if the ADR-004 network open item forces it (D-OPEN-001) |
| (G) OpenSearch / external vector DB for search | Powerful relevance | Cost + operational complexity unjustified; rejected by D6 evaluation ([AI_ARCHITECTURE §8](../AI_ARCHITECTURE.md)) |

## Decision

1. **PostgreSQL 16** is the source of truth in every environment (local Docker for
   development; Amazon RDS `db.t4g.micro`, Single-AZ, 20 GB gp3, **private subnet, no public
   endpoint** for shared/production environments) — **decision D2**.
2. **Prisma ORM** with version-controlled forward-only migrations: `prisma migrate dev`
   locally, `prisma migrate deploy` from the pipeline only.
3. **Search = deterministic PostgreSQL first:** `pg_trgm` GIN trigram indexes +
   case-insensitive similarity/ILIKE, plus `tsvector` full-text search over concatenated
   name/alias/location text. **No embeddings, no pgvector, no external vector database in the
   MVP** (D6) — adding one requires a written evaluation showing deterministic search fails a
   P0 acceptance criterion.
4. **Soft delete** (`deletedAt`) on User/Item/Location/Conversation; append-only
   `ItemLocationEvent`; retention purge hard-deletes soft-deleted rows after 30 days (BR-07);
   audit retention 12 months (BR-08).
5. **Required extensions:** `pg_trgm` (SQL migration V2); full-text search uses built-in
   `tsvector`/`to_tsvector` (no extra extension).

**Migration strategy** (detail in [DATABASE_SCHEMA.md §6](../DATABASE_SCHEMA.md),
procedure in [DEPLOYMENT.md §5](../DEPLOYMENT.md)):

- Dev: `prisma migrate dev`; destructive reset allowed only on local/ephemeral DBs.
- Staging/Prod: `prisma migrate deploy` as a distinct pipeline step **before** the new app
  version receives traffic; migrations must be backward compatible with the previous app
  version (**expand/contract**); an applied migration is rolled back by **forward-fix**
  ([DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) if data is damaged).
- Baseline: no production data exists yet, so no baselining procedure is required for MVP.

## Consequences

**Positive**

- FKs/CHECK constraints enforce ownership and integrity at the data layer (defense in depth
  behind service-layer authorization).
- FTS + trigram gives a deterministic fallback for the assistant (FR-013) and powers
  `GET /api/search`.
- One database for app + conversation data keeps export/deletion simple (FR-014/FR-022).
- Managed backups underpin the RTO/RPO targets.

**Negative / accepted costs**

- ~USD 14/mo fixed cost (instance + storage, **assumption**) dominates the ≤ $25/mo budget.
- Single-AZ: instance failure means restore-based downtime (minutes–tens of minutes,
  **estimate**); Multi-AZ roughly doubles instance cost — deferred
  ([DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) §2).
- Migration discipline required; brief connection churn on deploy is accepted for MVP.
- `pg_trgm` typo tolerance is limited beyond ~2 character edits; a P1 evaluation may still
  trigger vector search (future trigger, not an MVP task).

**Neutral**

- Prisma hides SQL; unusual query plans need `prisma` logging/explain investigation.
- Local Docker parity is a dev-machine requirement (risk R-08 if Docker is unavailable —
  D-OPEN-005 covers native PostgreSQL).

## Compliance notes

- [ ] No public RDS endpoint; DB in private subnet with SG ingress 5432 from app SG only
      (T-070).
- [ ] Backups (PITR 7 d + nightly snapshots 14 d) configured in CDK and drill executed
      (T-073).
- [ ] `prisma validate` + migration drift check in CI (T-021/T-012).
- [ ] Seeds never run outside `local`/`dev` (BR-11).
- [ ] No vector/embedding infrastructure added without a superseding evaluation/ADR.

## Related

- D2 in [index.md §4](../../index.md) · D6 search decision in
  [AI_ARCHITECTURE.md §8](../AI_ARCHITECTURE.md) · [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)
- [adr/ADR-001](ADR-001-application-architecture.md) (single deployable/Prisma client) ·
  [adr/ADR-004](ADR-004-deployment.md) (network path to private RDS) ·
  [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) · [COST_ESTIMATION.md](../../planning/COST_ESTIMATION.md)
