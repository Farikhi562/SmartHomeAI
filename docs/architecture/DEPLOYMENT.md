# Deployment — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Hosting / IaC | AWS Amplify Hosting (SSR) + AWS CDK TypeScript in `infrastructure/` (Secrets Manager, alarms, budget only) — D4, [ADR-004](adr/ADR-004-deployment.md); database + auth on Supabase — D2/D5, [ADR-005](adr/ADR-005-supabase.md) |
| Tasks | T-070 … T-075 — [TASK_BREAKDOWN](../planning/TASK_BREAKDOWN.md) |

> No environment exists yet: every pipeline, stack, and check below is **proposed design**,
> not a record of a successful run. Deploy evidence (smoke reports, `cdk diff` reviews) is
> only claimed when tasks T-070–T-075 actually execute.

---

## 1. Environments

| | `local` | `dev` (optional shared) | `staging` | `production` |
|---|---|---|---|---|
| **Purpose** | Feature development, unit/integration tests | Ephemeral experiment/preview | Pre-prod validation of the full stack | Real users |
| **AWS account strategy** | none | Single account (same as staging) | **Single AWS account**, env separation via stacks + mandatory tags (AWS_ARCHITECTURE §5). Multi-account is a documented *future* option, not MVP | Same single account, separate stack namespace + tags |
| **Database** | Supabase project (`DATABASE_URL`/`DIRECT_URL`), seeded (dev seed only); optional fallback: Docker `postgres:16` or native PG (Docker not installed on the inspected machine) | Supabase Free project (shared) or local container when offline | Supabase Free tier (pooled URL) — no automatic backups, scheduled dumps (see [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md)) | Supabase Free for MVP → **Pro at launch** (daily backups, 7-day retention, never pauses) |
| **Config source** | `.env` (from `.env.example`) | `.env` / SSM params | SSM Parameter Store (non-secret) + Amplify env settings | SSM Parameter Store + Amplify env settings |
| **Secrets source** | `.env` (gitignored) | Secrets Manager (`smarthomeai-dev-*`) | **Secrets Manager** (`GROQ_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_JWT_SECRET`) | **Secrets Manager** (`smarthomeai-production-*`) |
| **Deploy trigger** | `npm run dev` (manual) | `cdk deploy` (manual, AwsInfra) | Merge to `main` → CI deploys staging; Amplify Git-based build | **Manual approval** + version tag trigger (§2) |
| **Who can deploy** | Any developer, locally | AwsInfra agent/owner | AwsInfra (via merged PR to `main`) | Human approver + Orchestrator (T-075); never auto |
| **Auth (Supabase Auth)** | Supabase Auth dev project, or `AUTH_MODE=dev` email-only login when offline (refused in production) | Supabase Auth (same dev project) | **staging Supabase project** Auth (custom SMTP or confirmations disabled, per environment) | **production Supabase project** Auth (separate project, real SMTP) |
| **Data rule** | Never production data | Never production data (BR-11) | Synthetic data only (BR-11) | Source of truth |

---

## 2. CI/CD pipeline (GitHub Actions)

**PR pipeline** (every pull request, `.github/workflows/ci.yml` — T-012/T-063):

```text
lint → typecheck → unit + integration tests
        (integration jobs run against a local Postgres 16 —
         native install; Docker is not installed on the inspected machine, T-020) → prisma validate
        → next build                        → secret scan (T-063)
        → dependency audit (T-063)          → ✅ merge gate (+ review, T-066)
```

**Merge to `main` → staging:**

1. Deploy staging (Amplify Git-based build triggered by branch, or an explicit workflow step
   — chosen at T-071; both satisfy the design).
2. Run migrations (`prisma migrate deploy`, §5) as a release step before traffic.
3. **Smoke test (T-072)**: `GET /api/health` → sign-in → create item → record event → search
   → assistant turn. Result written to a report file in the repo. **A failing smoke test
   blocks release regardless of schedule** (IMPLEMENTATION_PLAN release criteria).

**Production:**

1. Human approval (manual gate in the workflow / console).
2. Deploy from a **version tag** (`v*`) built from the reviewed `main` commit.
3. `prisma migrate deploy` → app rollout → post-deploy checklist (§9) → smoke test.
4. CHANGELOG entry required before the tag (§8).

**Never:** deploy from developer laptops; push directly to a protected branch; run secrets in
log-echoing steps (secret values are fetched from Secrets Manager at deploy/runtime, not
pasted into workflow YAML).

---

## 3. Build specification (`amplify.yml` outline)

```yaml
version: 1
applications:
  - appRoot: .
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
            - npx prisma generate          # client matches this build
        build:
          commands:
            - npm run lint && npm run typecheck
            - npm test -- --ci             # unit (+ integration via service container if enabled here)
            - npm run build                # next build (SSR output)
      postBuild:
        commands:
          - npx prisma migrate deploy      # expand phase BEFORE new traffic (uses DIRECT_URL)
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```

Notes:
- The migrate step placement (before traffic shift) is the "expand" half of
  expand-contract (§5); if the platform's exact hook ordering differs, migrations run as an
  explicit pipeline step instead — decided at T-071 with the real console behavior.
- `DIRECT_URL` (Supabase direct connection, port 5432) is required for migrations;
  `DATABASE_URL` (pooled transaction mode, `?pgbouncer=true`, port 6543) serves the app
  pool. Both come from Secrets Manager (T-071); the Supabase project + auth settings are
  provisioned in T-022.
- Exact hook names/order are an **assumption until T-071 verifies them against the live
  Amplify build console.**

---

## 4. Infrastructure as code

- `infrastructure/` — AWS CDK (TypeScript): Secrets Manager secrets, SSM parameters,
  CloudWatch log groups/alarms, SNS topic, AWS Budgets (T-070, T-074).
  **No VPC, RDS, or Cognito after ADR-005** — the database and auth live on Supabase
  (provisioned in T-022; env wiring into Amplify/Secrets Manager stays an AwsInfra
  responsibility, T-071).
- One stack per environment (`smarthomeai-staging-*`, `smarthomeai-production-*`), all
  tagged (AWS_ARCHITECTURE §5).
- Changes ship as PRs: review `cdk diff` output before `cdk deploy` (T-070 evidence).
- The Amplify app itself is bootstrapped once (console or CDK) and then updated by Git-based
  CI/CD; console-coupled settings are documented step-by-step (ADR-004 consequence) —
  anything reusable later moves into CDK.
- **Config drift rule:** anything not expressible in `infrastructure/` or app config files is
  a defect to fix, not a console click to remember.

---

## 5. Database migration procedure

Follows [DATABASE_SCHEMA.md §6](DATABASE_SCHEMA.md) (expand-contract, forward-only):

1. **Author:** `prisma migrate dev` locally → numbered migration files committed and
   reviewed in the same PR as the code that depends on them.
2. **Classify:** additive (safe, single release) vs breaking (needs **expand → migrate →
   contract** across two releases: add new column/table + dual write/backfill → switch reads
   → drop old in a later release).
3. **Apply:** `prisma migrate deploy` executed **in the pipeline only**, before the new app
   version receives traffic, using `DIRECT_URL` (the Supabase direct connection). **Never
   from a laptop** against staging or
   production (DATABASE_SCHEMA §6.1).
4. **Verify:** CI runs `prisma validate` + migration drift check
   (`prisma migrate diff --from-schema-datamodel --to-migrations`, T-021); post-deploy smoke
   proves the app works against the migrated schema.
5. **Rollback stance:** migrations are **not auto-reversed** in production. Rollback = redeploy
   the previous app build (which is compatible with the *expanded* schema). If a migration
   itself is broken/irreversible → **forward-fix** migration; if data is damaged → restore
   from backup ([DISASTER_RECOVERY.md](DISASTER_RECOVERY.md)).
6. **Seeds** run only on `local`/`dev` — never against staging/production.

---

## 6. Rollback strategy

| Failure | Action | Expected speed (assumption) |
|---|---|---|
| Bad app build (runtime errors, failed smoke) | Redeploy the previous successful build (Amplify rollback / redeploy prior commit tag) | Minutes |
| Bad migration shipped with the build | Redeploy previous build (schema still compatible per expand-contract); write a forward-fix migration | Minutes + fix cycle |
| Migration damaged data | Stop; restore per [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) (latest scheduled dump; Supabase Free has no PITR) | Within RTO ≤ 4 h target |
| Assistant behaves badly in prod | **Feature-flag disable** via env/SSM Parameter Store config (assistant off; CRUD unaffected — FR-013 design) | Minutes, no rebuild |
| Config/secret wrong | Fix value in Secrets Manager / SSM, restart/redeploy app | Minutes |
| Infra stack bad | `cdk deploy` with corrected construct; CloudFormation rollback on failure | Minutes–tens of minutes |

Rollback authority: any contributor may halt a release; only the human approver promotes
production (T-075).

---

## 7. Configuration management

| Kind | Mechanism | Examples |
|---|---|---|
| Secrets | **Secrets Manager** (staging/prod), `.env` locally | `GROQ_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_JWT_SECRET` |
| Non-secret config | **SSM Parameter Store** (standard) + typed env loader (`src/lib/config`, Zod-validated) | `GROQ_MODEL`, feature flags (assistant on/off) |
| Build-time config | Amplify app environment settings (sourced from the above at deploy) | node version, branch → env mapping |
| Platform constants | Code (validated env schema with defaults) | timeouts (15 s), retries (2), page sizes |

Rules: env is validated on boot (fail fast on missing/invalid config); no silent defaults for
secrets; every new config key is documented in `.env.example` with a placeholder; changing a
value in the console alone is drift — the source of truth is CDK/app config (§4).

---

## 8. Release process

1. **CHANGELOG** entry (`Keep a Changelog` style) for the release.
2. **Version tag** `vX.Y.Z` from reviewed `main`; semver: breaking API/DB change → major,
   features → minor, fixes → patch.
3. **Definition-of-Done gate** ([DEFINITION_OF_DONE](../planning/DEFINITION_OF_DONE.md)):
   tests green, T-072 smoke report current, T-064 security review zero open high/critical,
   migration reviewed, rollback plan stated in the PR.
4. **Human approval** for production (never fully automated — T-075).
5. Record the release: tag, approver, smoke result. No release is "done" without recorded
   evidence (index.md §6.3).

---

## 9. Static assets and caching

- Static assets (JS/CSS/images/fonts) served through Amplify's CDN with its default cache
  policy — **no custom cache policies in MVP** (revisit only with measured stale-asset or
  TTFB problems; NFR-008/LCP feedback loop).
- Content hashing in Next.js builds gives safe long-TTL static caching; HTML/SSR responses
  use the platform's default behavior.
- No separate CloudFront distribution (AWS_ARCHITECTURE §3).

---

## 10. Post-deploy verification checklist

Run after every staging deploy and every production release:

1. `GET /api/health` → 200, `db: "up"` (deploy smoke, T-072).
2. Sign-in works (Supabase Auth flow completes via our `/api/auth/*` proxy; `GET /api/me` returns the user).
3. Create item → record location event → event appears on timeline.
4. Search returns the seeded/new item (`matchType` present).
5. Assistant turn succeeds; **and** forced-failure path returns `AI_UNAVAILABLE` fallback
   (FR-013) rather than a 500.
6. 404-for-not-owned spot check (request another owner's id → 404).
7. Logs show the request with `requestId`, redacted content, correct status codes
   ([OBSERVABILITY.md](OBSERVABILITY.md) §1).
8. Alarms show OK state; no new billing surprises (budget dashboard glance, T-074).
9. Migration status: `prisma migrate status` reports up to date.
10. Record the run (checklist checked into the release evidence — never assumed).

---

## Related documents

- [AWS_ARCHITECTURE.md](AWS_ARCHITECTURE.md) — services, naming, IAM, network
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — migration strategy (§6), environments (§7)
- [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) — restore when rollback is not enough
- [SECURITY.md](SECURITY.md) — CI scanning gates, secrets handling
- [OBSERVABILITY.md](OBSERVABILITY.md) — health checks, alarms used as deploy signals
- [adr/ADR-004-deployment.md](adr/ADR-004-deployment.md) — hosting decision
- [adr/ADR-005-supabase.md](adr/ADR-005-supabase.md) — database + auth platform (Supabase)
- [COST_ESTIMATION.md](../planning/COST_ESTIMATION.md) — build-minute/SSR cost assumptions
