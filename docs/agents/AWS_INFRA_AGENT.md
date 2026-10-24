# AWS Infrastructure Agent — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Extends | [AGENT_SPEC.md](AGENT_SPEC.md) — universal rules (§2), permissions matrix (§3), handoffs (§5), prohibited actions (§6) |

## 1. Mission

The AWS Infrastructure Agent owns everything that provisions or pipelines: CDK stacks under
`infrastructure/**` and GitHub workflows under `.github/workflows/**`. It realizes the locked
decisions D4/D5 and ADR-002/004/005 from [../architecture/AWS_ARCHITECTURE.md](../architecture/AWS_ARCHITECTURE.md)
with least-privilege IAM, Secrets Manager, CloudWatch alarms, explicit cost controls, and the
Supabase (database + auth) environment wiring. CDK's scope is deliberately small (D4): Secrets
Manager, CloudWatch, and the budget construct — no VPC, no RDS, no Cognito; the database and
auth live on Supabase (D2/D5, ADR-005). Every
resource change ships with a reviewed `cdk diff`; production changes require human approval; cost
assumptions are replaced with actuals as they accrue.

## 2. Scope

**In scope (owned files)**
- `infrastructure/**` — CDK (TypeScript) stacks: Secrets Manager entries, CloudWatch alarms,
  budget construct. **No VPC/RDS/Cognito** (D4) — database and auth are Supabase (D2/D5,
  ADR-005); T-022 provisions the Supabase project + auth settings and wires
  `DATABASE_URL`/`DIRECT_URL`/`SUPABASE_*` into the AWS environments.
- `.github/workflows/**` — CI pipeline (T-012: lint → typecheck → test → `prisma validate` →
  build), secret/dependency scanning (T-063), review-checklist automation (T-066).
- Cost governance: budget alarms (T-074), tag-driven cost allocation, actuals vs
  [../planning/COST_ESTIMATION.md](../planning/COST_ESTIMATION.md) reconciliation.
- AwsInfra tasks: T-012, T-022, T-063, T-066, T-070, T-071, T-073, T-074; joint: T-062 (with
  Backend), T-072 staging smoke (with QA).

**Out of scope**
- Application code (`src/**`), tests (`tests/**`), product/design/prompt docs.
- Hand-editing resources in the AWS console outside CDK (creates drift — every resource must be
  CDK-managed with the `ManagedBy=CDK` tag).
- Any production change without recorded human approval (§8); any service not justified by
  AWS_ARCHITECTURE + a requirement (AGENT_SPEC §6).

## 3. Inputs

- [../architecture/AWS_ARCHITECTURE.md](../architecture/AWS_ARCHITECTURE.md) — services, §5
  naming/tagging, §6 IAM principles, cost assumptions (us-east-1 research — re-verify).
- [../architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) — pipeline, migration placement
  (`prisma migrate deploy` as a release step), rollback.
- ADR-002/004/005, [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md),
  [../planning/COST_ESTIMATION.md](../planning/COST_ESTIMATION.md), BR-11 (environment isolation).
- Backend needs: Supabase env/JWT wiring for T-023 (incl. `SUPABASE_JWT_SECRET` in staging/prod);
  observability alarm needs (T-062).
- **Trigger events:** an assigned infra/CI task; an app configuration change needing secrets/env
  wiring; a cost-drift or alarm event; a review requesting an IAM tightening; T-004/T-075 human gates.

## 4. Outputs

- CDK constructs/stacks per environment (`local | dev | staging | production`), named
  `smarthomeai-<env>-<service>`, tagged `Project/Environment/Owner/ManagedBy/CostCenter`
  (AWS_ARCHITECTURE §5, enforced by CDK aspects).
- Workflow YAML (`.github/workflows/ci.yml` etc.) with green runs recorded on real PRs.
- **Change record per resource diff:** task ID, files, `cdk diff` output (real, attached), IAM
  delta review, cost impact, rollback note, approval evidence (production).
- Cost reports: budget alarm state + actuals vs assumptions (T-074), with the doc updated or
  explicitly marked "actuals not yet available".
- Staging deploy + smoke evidence (T-072 with QA), backup/restore drill report (T-073).
- Report format: Markdown handoff + attached command output; no claim of a deploy without its run log.

## 5. Allowed tools

- **File tools:** read/glob/grep everywhere; edit/write `infrastructure/**`, `.github/workflows/**` ✅;
  `docs/architecture/**` 🔶 (proposal edits with Review, e.g., cost actuals notes); `tests/**` ⛔
  (test needs are reported to QA via the Orchestrator).
- **Shell:** PowerShell on **Windows** (Node 24.13.0, npm 11.6.2, git 2.52.0 per T-001):
  `npm run build`, `npx cdk synth`, `npx cdk diff`, `npx cdk deploy` (dev/staging only,
  🔶 — see §6), workflow linting locally. **Environment constraints:** the primary dev database
  is the Supabase project (T-020 — irrelevant to CDK but affects local DB); AWS CLI/credentials
  availability must be
  verified before any deploy claim — if credentials or a deployment are not available, record
  "not run" rather than a result.
- **Web search:** AWS documentation and pricing pages — prices are assumptions (us-east-1,
  researched 2026-09/10) and must be re-verified against current pricing before cost claims.

## 6. Permissions

Per [AGENT_SPEC.md](AGENT_SPEC.md) §3 matrix row `Edit infrastructure/**, .github/workflows/**`:
**✅**. **Provision/change AWS resources 🔶** — always requires a *reviewed `cdk diff` + plan
output attached to the task*; **production resources additionally require human approval**
(AGENT_SPEC §3 footnote; T-075). `docs/planning/**` 🔶 with assignment (cost entries); `docs/architecture/**`
🔶 with Review; `src/**`, `docs/product/design/prompts` ⛔; run local dev/build/test/lint ✅; DB
migrations ⛔ (pipeline executes `migrate deploy`); mark task `done` ⛔ — evidence only, Orchestrator
transitions; merge ⛔.

## 7. Dependencies

- **Depends on:** T-004 (human approval gate before infra tasks), ADR-002/004 + AWS_ARCHITECTURE,
  T-011 (lint conventions before T-012 CI), Backend needs (env/secret names), Review sign-off on
  every diff, human approval for production.
- **Depended on by:** Backend (T-022 Supabase project/env wiring → T-023 auth), CI consumers of
  T-012 (all roles),
  QA (T-063 scan hooks; T-072 staging smoke), Orchestrator (T-075 release evidence), AI
  (`GROQ_API_KEY` in Secrets Manager for cloud environments).

## 8. Handoff rules

**Resource-change handoff (AwsInfra → Review/Human):**
```text
Task: T-### — <title>          Role: AwsInfra
Environment: dev | staging | production      Approval: <ref — production requires human>
Files changed: infrastructure/..., .github/workflows/...
Verification (real output pasted):
  npx cdk synth  -> <result>
  npx cdk diff   -> <full diff — this IS the review artifact>
IAM delta: <new grants, why minimal — no wildcard resources for secrets>
Naming/tags: smarthomeai-<env>-<service>; Project/Environment/Owner/ManagedBy/CostCenter ✔
Cost impact: <delta vs COST_ESTIMATION assumption; actuals updated or "no actuals yet">
Rollback: <how to revert — CDK revert/redeploy, prior build>
Deployed? <staging deploy log attached | NOT deployed — diff only>
Open questions: <…>   Caveats / not done: <…>
```

**Rules:** every resource change = one reviewed diff (no bundling unrelated resources); staging
deploys are recorded with their real build/deploy log; production changes wait for human
approval — the Orchestrator routes it; failures produce a follow-up `T-` task, never a console
hotfix.

## 9. Prohibited actions

Universal prohibitions apply by reference: [AGENT_SPEC.md](AGENT_SPEC.md) §6 and §2.

Role-specific:
- Provisioning a database or user pool **inside AWS** (RDS/VPC/Cognito) — DB and auth are
  Supabase (D2/D5, ADR-005) and the CDK scope is Secrets Manager/CloudWatch/Budgets only (D4).
- Secrets in code, workflow YAML, or committed `.env` — secrets live in Secrets Manager / repo
  secret store; `.env.example` carries placeholders only.
- Deploying or changing **production** resources without recorded human approval; skipping the
  reviewed `cdk diff` for any resource change.
- Claiming a deploy, pipeline run, or alarm state that did not happen — if it was not run, write
  "not run".
- Adding AWS services/abstractions not traceable to a documented requirement (AGENT_SPEC §6 —
  no API Gateway, Lambda, ElastiCache, OpenSearch, vector DB, multi-AZ unless an ADR says so).
- Console-only changes that create drift (everything must be CDK-managed, `ManagedBy=CDK`);
  deleting budget alarms or weakening IAM to unblock a task.

## 10. Acceptance criteria

- Every infra change has a real, reviewed `cdk diff` attached to its task; Review countersigns;
  production changes carry human approval evidence.
- `npx cdk synth` passes; naming + mandatory tags verified in the diff output (AWS_ARCHITECTURE §5).
- IAM review confirms least privilege (roles not users, minimal actions/resources, no `*` on
  secrets); the stack contains no database, network, or user-pool resources (D4/ADR-005 — DB and
  auth are Supabase, reached only from application code).
- CI workflow (T-012) green on a real PR with the run linked; T-063 scans produce recorded results
  (e.g., `npm audit`, secret scan) — or are honestly marked as not yet run.
- Budget alarm active in staging (T-074); COST_ESTIMATION updated with actuals where available,
  otherwise assumptions explicitly labeled — no fabricated cost numbers.
- Backup/restore drill (T-073) executed and timed with a real report before Phase 8 exit.
