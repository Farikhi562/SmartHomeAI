# ADR-005: Supabase Platform — Managed PostgreSQL + Supabase Auth

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | **Accepted** (user decision, 2026-10-17) |
| Date | 2026-10-17 |
| Decision IDs | D2, D4, D5 — amended ([index.md §4](../../index.md)) |
| Supersedes | ADR-002 hosting choice (local Docker dev + Amazon RDS); ADR-004 auth provision (Amazon Cognito) |
| Deciders | User (product owner), Principal Architect |

## Context

The original documentation set (2026-10-15) chose PostgreSQL on local Docker / Amazon RDS
with Amazon Cognito for auth. On 2026-10-17 the product owner directed a platform change:

1. **Database → Supabase**, keeping **Prisma** as the ORM.
2. **Authentication → Supabase Auth** (GoTrue), replacing Amazon Cognito (D5).
3. **Tier → Supabase Free ($0)** for the MVP (within cost ceiling C-4 ≤ USD 25/mo).

Constraints that shaped the decision:

- Prisma's `datasource` already separates `url` (`DATABASE_URL`) and `directUrl`
  (`DIRECT_URL`) — a perfect fit for Supabase's pooled vs. direct connection strings.
- Supabase exposes standard PostgreSQL; `pg_trgm`, `tsvector`, partial unique indexes and
  generated columns (D6, `000002_search`, `000003_location_uniques`) all work unchanged.
- No Docker exists on the inspected dev machine (R-08) — a hosted database removes the
  local-DB blocker entirely.
- One vendor for database **and** auth reduces integration surface (issuer/key wiring,
  console hops) at MVP scale.

Verified pricing/limits (supabase.com/pricing, checked 2026-10-15/17):

| Plan | Price | Database | Auth MAU | Backups | Pause |
|---|---|---|---|---|---|
| Free | $0/mo | 500 MB, 2 active projects, shared compute (Nano) | 50,000 free | **None** (manual `supabase db dump` recommended) | Auto-pauses after 1 week of inactivity |
| Pro | from $25/mo (org) + compute per project; first Micro instance covered by the $10/mo credit | 8 GB included ($0.125/GB after) | 100,000 included ($0.00325 after) | Daily backups, 7-day retention (PITR is a paid add-on) | Never |

## Considered options

| Option | Pros | Cons |
|---|---|---|
| **(A) Supabase Free — managed Postgres + Supabase Auth** *(chosen)* | $0 MVP cost; pooled (`DATABASE_URL`) + direct (`DIRECT_URL`) strings map 1:1 onto the existing Prisma config; auth included (50k MAU); removes Docker/RDS blocker; standard Postgres (no dialect risk) | No automatic backups on Free; auto-pause after 7 days idle (demo sites may wake cold); direct connection is IPv6 (IPv4 via shared pooler or paid add-on); vendor coupling; connection caps on shared compute |
| (B) Supabase Pro from day one | Never pauses; daily backups 7-day retention; dedicated pooler | $25/mo consumes the entire C-4 ceiling before any Groq usage — rejected for MVP; documented upgrade path instead |
| (C) Keep Amazon RDS + Cognito (status quo) | Single cloud (AWS); PITR backups | Fixed ~$11.7–14/mo; **no Docker and no AWS access on the dev machine** → cannot verify locally at all; 2 vendors for data+auth; slower setup |
| (D) Neon + Auth.js | Postgres branching; vendor-neutral auth | Auth becomes self-built (password reset/verification/email deliverability — ADR-004 option B, explicitly rejected earlier); two vendors again |

## Decision

1. **Database:** PostgreSQL 16 on Supabase, accessed by Prisma 6:
   - `DATABASE_URL` = Supavisor **transaction-mode pooler** (`…:6543/postgres?pgbouncer=true`)
     for runtime queries (serverless/auto-scaling friendly, IPv4).
   - `DIRECT_URL` = direct connection (`db.<ref>.supabase.co:5432`) for Prisma Migrate /
     Studio; fallback when IPv6 is unavailable: shared-pooler **session mode** (`…:5432`).
2. **Tier:** **Free tier for MVP development and demos**; upgrade to Pro only at
   production launch (trigger documented in RISKS.md and COST_ESTIMATION.md).
3. **Auth:** **Supabase Auth** — email + password; access tokens are JWTs verified
   **server-side** with `SUPABASE_JWT_SECRET` (HS256, `iss = <SUPABASE_URL>/auth/v1`,
   `aud = authenticated`). `ownerId` remains the token `sub` (FR-012/BR-01 unchanged).
   `AUTH_MODE=dev` (local email-only login, refused in production) is retained for
   offline development. Password login/refresh/logout are proxied through our API routes
   so the session cookie stays `httpOnly` (SECURITY.md session rules unchanged).
4. **CDK scope shrinks:** `infrastructure/` no longer provisions Cognito or RDS —
   remaining: Secrets Manager entries, CloudWatch alarms, AWS Budgets (ADR-004 amended).
5. **Region default:** Supabase `US East (Iowa)` (`aws-us-east-1`) to co-locate with
   Amplify `us-east-1` (documented default; changeable at project creation).

## Consequences

**Positive**

- $0 fixed database/auth cost during MVP (C-4 ceiling kept for Groq usage + growth).
- Local development works without Docker: point `DATABASE_URL`/`DIRECT_URL` at the
  Supabase project (network reachability is the only requirement).
- Single vendor for data + auth; simpler environment wiring and onboarding.

**Negative / accepted risks** (cross-references are this repo's canonical register)

- **R-14 (data loss):** Free tier has **no automatic backups** — mitigation: scheduled
  `supabase db dump` exports (task added), upgrade to Pro at launch (daily backups).
- **R-16 (availability):** Free projects **pause after 7 days idle** (cold start on first
  request); demo environments must be exercised or pinned to Pro.
- **R-05 (cost/quota):** Free-tier caps (500 MB, 2 projects, shared compute connection
  limits, IPv6 direct) — always connect through the pooler; Pro upgrade trigger documented.
- **Vendor coupling:** Supabase-specific auth (GoTrue) and platform features are now
  load-bearing; exit = standard Postgres export + replacing the auth module behind
  `src/lib/auth` (the only auth touchpoint in app code).
- **Email confirmation:** Supabase Auth requires email verification by default; MVP
  environments either disable confirmations (dev) or configure SMTP (staging/prod).

**Neutral / unchanged**

- Prisma schema, migrations, and all SQL stay as written (no Supabase-specific changes).
- API contract: `Authorization: Bearer <JWT>`; error envelope; `ownerId` from `sub`.
- Groq (D3), Next.js modular monolith (D1), search (D6), design (D7) untouched.

## Verification

- [ ] Supabase project created; `DATABASE_URL`/`DIRECT_URL` set from the Connect dialog
- [ ] `prisma migrate deploy` applies `000001_init` … `000003_location_uniques` (T-021)
- [ ] `AUTH_MODE=supabase`: sign-up → confirm → login → protected route verified (T-023)
- [ ] Free-tier pause behavior exercised; export/dump task scheduled (R-06)
