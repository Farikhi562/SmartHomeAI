# ADR-004: Deployment — AWS Amplify Hosting + CDK Foundations (with Cognito Auth)

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | **Partially amended 2026-10-17** by ADR-005 — hosting decision (Amplify + CDK) stands; **auth provision (D5) moved from Amazon Cognito to Supabase Auth**; CDK scope shrinks to Secrets Manager/alarms/budget (no Cognito, no RDS). Cognito/RDS text below is the historical rationale for the superseded portions. Decision status: Accepted with open item D-OPEN-001 |
| Date | 2026-10-15 |
| Decision IDs | D4 (hosting + IaC), D5 (Cognito auth) — [index.md §4](../../index.md) |
| Deciders | Principal Architect, AWS Solutions Architect |

## Context

The MVP deploys one Next.js modular monolith ([ADR-001](ADR-001-application-architecture.md))
that must reach a private PostgreSQL RDS instance ([ADR-002](ADR-002-database.md)) and call
the Groq API over the public internet ([ADR-003](ADR-003-llm-provider.md)). It also needs
authentication (registration, login, recovery, email verification) with server-side JWT
verification. Forces: SSR support for Next.js; managed TLS/CDN; one language for app and IaC;
cost ceiling ≤ USD 25/mo (C-4); a small team with no container-ops appetite; AWS-first
requirement.

**Known unresolved technical fact (registered as D-OPEN-001):** at documentation time there
was **no network access to AWS documentation**, so it could not be *verified* whether
Amplify Hosting's SSR compute can attach to a VPC and reach RDS in private subnets. Publicly
exposed RDS is excluded by spec, and Amplify's outbound IPs are not guaranteed stable for
security-group IP allowlisting. A network spike must resolve this before production cutover.

## Considered options

| Option | Pros | Cons |
|---|---|---|
| **(A) AWS Amplify Hosting (SSR) + AWS CDK (TypeScript) in `infrastructure/`** *(chosen)* | Managed Git-connected CI/CD with SSR for Next.js; managed CDN + ACM TLS; preview branches per PR; CDK keeps app + IaC in TypeScript (one language, shared types); CDK covers everything provisionable (Cognito, RDS, Secrets, alarms, budget) | Some Amplify settings live only in the console (documented, below); SSR↔private-DB path unverified (D-OPEN-001); build-minute + SSR GB-hr billing (**assumption**) |
| (B) Container platform (App Runner / ECS Fargate + ALB) | Full VPC control; reaches private RDS natively; keeps ADR-001 intact | Image build, task defs, more IAM/ops; more infra than the MVP needs — retained as **fallback path 2** in the D-OPEN-001 ladder |
| (C) Lambda + API Gateway | Pay-per-request | Rejected by [ADR-001](ADR-001-application-architecture.md)/D1 (second backend, second auth path) |
| (D) Vercel / Netlify hosting | Excellent DX for Next.js | Not AWS; weaker region/data-residency control; spec evaluates AWS services |
| (E) EC2 self-managed | Total control | Patching/ops burden with zero benefit at this scale |
| (F) Terraform for IaC | Battle-tested, multi-language | Team consistency argument favors CDK (TypeScript strict everywhere); Terraform remains acceptable if the infra team standardizes on it later |

**Auth options (decision D5):**

| Option | Pros | Cons |
|---|---|---|
| **(A) Amazon Cognito (Essentials tier)** *(chosen)* | Managed sign-up/login/recovery/verification; free ≤ 10,000 MAU/month (**assumption**: then $0.015/MAU); no password handling in app code; JWKS verification is standard | Hosted-UI/SDK UX must be validated in a real browser (checkpoint **T-023**); default email sending quota may throttle (D-OPEN-006 → SES remedy); separate pools per environment |
| (B) Auth.js + Prisma sessions + SES email flows | Full UI control; stays in-app; no third-party auth vendor | We hand-roll password reset, verification, session storage, expiry, and email deliverability — meaningful security + work surface; chosen **only if Cognito integration proves infeasible at the T-023 checkpoint** |

## Decision

1. **AWS Amplify Hosting is the deployment target for the MVP (D4):** GitHub-connected,
   preview branches per environment, SSR runtime for the Next.js app; CloudFront distribution
   and ACM TLS are **implicit in Amplify** — no separate CloudFront resources are created.
2. **AWS CDK (TypeScript) in `infrastructure/` owns every provisionable resource (D4):**
   VPC + subnets + security groups, RDS PostgreSQL, Cognito user pools/app clients, Secrets
   Manager secrets, SSM parameters, CloudWatch log groups/alarms + SNS, AWS Budgets. The
   Amplify app is bootstrapped once (console or CDK `aws-amplify` construct) and thereafter
   updated by Git-based CI/CD.
3. **Auth = Cognito Essentials (D5):** server-side JWT verification via JWKS; `ownerId` from
   token `sub` (never browser-supplied). Separate pools for staging and production. The
   **Auth.js + Prisma + SES alternative stays documented and reversible**: because handlers
   reach identity only through the narrow `requireUser()` layer, a switch at the T-023
   checkpoint changes that module + auth pages, not services/repositories
   ([SECURITY.md §3.1](../SECURITY.md)).
4. **Data-path strategy with a fallback ladder** (resolved at the network spike):

   | Priority | Path | Condition |
   |---|---|---|
   | 1 | Amplify SSR compute with VPC attachment → private RDS | Choose if Amplify supports VPC-connected compute for the account/region |
   | 2 | Same monolith containerized → **App Runner with VPC connector** → private RDS | If Amplify cannot reach private RDS; keeps ADR-001 intact — only hosting changes |
   | 3 | Aurora PostgreSQL Serverless v2 **Data API** (HTTPS + IAM) while staying on Amplify | Only if 1–2 fail and containerization is unacceptable; higher cost (min ACU) — record the trade-off |
   | ✗ | Publicly accessible RDS + IP allowlist | **Rejected:** unstable egress IPs, internet-exposed database |

   The chosen path is recorded by updating this ADR in the same change that provisions it.
5. **Environment strategy:** `local` / `dev` / `staging` / `production` in a **single AWS
   account**, separated by stacks + mandatory tags (multi-account is future); separate Cognito
   pools and databases per environment; no production data outside production (BR-11).
6. **Secrets and config:** application secrets (`GROQ_API_KEY`, `DATABASE_URL`) live in
   **AWS Secrets Manager** for staging/production, read via least-privilege IAM at
   deploy/runtime (T-070/T-071); `.env` locally only. Non-secret config (model name, feature
   flags) in SSM Parameter Store / typed env config. Account IDs and credentials are never
   hardcoded.
7. **Release/rollback:** PR → preview → staging (merge to `main`) → manual-approval
   production from a version tag; rollback = redeploy previous build; bad migration =
   forward-fix; feature flags for fast disable — detail in
   [DEPLOYMENT.md](../DEPLOYMENT.md).

## Consequences

**Positive**

- One Git-based pipeline from PR → preview → staging → production; infra changes reviewed as
  pull requests (`cdk diff` evidence, T-070).
- Managed TLS/CDN/auth shrink the operational surface; single-language IaC (TypeScript).
- The fallback ladder means D-OPEN-001 can delay only the final hosting choice, not the
  roadmap (container readiness via Dockerfile, T-029, keeps path 2 cheap).

**Negative / accepted costs**

- **Amplify console-coupled settings:** app bootstrap, branch/env wiring, and some build/env
  settings live in the Amplify console and must be documented step-by-step in
  [DEPLOYMENT.md](../DEPLOYMENT.md) to stay reproducible — **CDK owns everything else**;
  anything not reproducible from code is treated as a defect.
- Hosting may require a late change (Amplify → App Runner) if the network spike fails; the
  app is container-ready by design.
- Amplify build minutes + SSR compute are billed continuously (**assumptions** in
  [COST_ESTIMATION.md](../../planning/COST_ESTIMATION.md)).
- WAF is absent at the edge for MVP (R-11, ~$15/mo deferred); compensating controls:
  app-layer rate limiting, Cognito throttling, input validation. Additional **assumption**
  (to verify): Amplify-managed distributions may not accept arbitrary WAF associations.
- Cognito email quota limits may throttle verification/recovery (D-OPEN-006/R-10) — SES is
  the documented remedy if observed.

**Neutral**

- Migration between hosting options is bounded work (Dockerfile + CDK swap), not a rewrite.
- Single-account multi-environment requires tag discipline to avoid confusion.

## Compliance notes

- [ ] Network spike resolves **D-OPEN-001** with *actually verified* behavior (not assumed),
      and this ADR is updated in the provisioning change.
- [ ] T-023 browser checkpoint records the Cognito UX verdict; if infeasible, the Auth.js
      alternative is invoked by updating this ADR (decision reversal with evidence).
- [ ] No account IDs, credentials, or environment secrets committed (Security Review, T-064).
- [ ] Every provisioned resource tagged `Project`, `Environment`, `Owner`, `ManagedBy=CDK`,
      `CostCenter` ([AWS_ARCHITECTURE.md §5](../AWS_ARCHITECTURE.md)).
- [ ] Budget alarms created **before** the first staging deployment (T-074).
- [ ] Console-coupled settings documented in DEPLOYMENT.md at T-071.

## Related

- D4/D5 in [index.md §4](../../index.md) · [AWS_ARCHITECTURE.md](../AWS_ARCHITECTURE.md)
  (services, network, IAM) · [DEPLOYMENT.md](../DEPLOYMENT.md) (pipeline, environments)
- [SECURITY.md](../SECURITY.md) §3.1 (auth + Auth.js fallback) ·
  [adr/ADR-001](ADR-001-application-architecture.md) · [adr/ADR-002](ADR-002-database.md) ·
  [adr/ADR-003](ADR-003-llm-provider.md)
- Open decisions D-OPEN-001 (Amplify↔private RDS), D-OPEN-006 (Cognito email limits) —
  CONTRACT.md · Risks R-09, R-11, R-10
