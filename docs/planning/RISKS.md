# Risk Register — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Orchestrator (register) · per-risk owners listed per row (roles: [../agents/AGENT_SPEC.md](../agents/AGENT_SPEC.md)) |
| Canonical risk source | This file — `R-##` IDs defined here ([../index.md §3](../index.md)) |
| PRD linkage | [../product/PRD.md](../product/PRD.md) §16 defines **R-01…R-07 with fixed semantics** — those meanings are binding and are restated verbatim below; this register continues the series with R-08…R-15 |

**How to use this register**

- **ID rule:** `R-##`, two digits only, stable forever — never reuse an ID
  ([../index.md §3](../index.md)); R-01…R-07 keep their PRD §16 meanings exactly.
- **Likelihood / Impact:** `low | med | high` (impact `critical` allowed for security/privacy).
- **Status vocabulary:** `open` (risk exists, control not yet implemented) ·
  `open — control designed` (mitigation specified + tasked, not yet run) ·
  `accepted (MVP)` (consciously tolerated, documented) · `mitigated` (control implemented **and
  verified with recorded evidence**) · `closed`.
- **Cadence:** reviewed by the Orchestrator at every milestone exit
  ([MILESTONES.md](MILESTONES.md)) and at the risk checkpoints in
  [IMPLEMENTATION_PLAN.md §4](IMPLEMENTATION_PLAN.md).

---

## 1. Risk register R-01…R-16

| ID | Category | Likelihood | Impact | Mitigation (control + where it lives) | Owner | Trigger / early warning | Status |
|---|---|---|---|---|---|---|---|
| **R-01** | AI quality — **LLM fabricates an answer** (PRD §16) | med | high (trust collapse; BO-2) | Retrieval-first pipeline (FR-007), strict grounding prompts, **zero-fabrication eval gate**, citations to source records; grounding validator replaces ungrounded replies (FR-010) | AI | `ai.ungrounded_detected` metric > 0; AIE fabrication count > 0; citation links failing | open — control designed (T-053, T-056; gates at M-5) |
| **R-02** | Security — **prompt injection via item names/user text** (PRD §16) | med | high (data leak or rogue writes) | Untrusted-content delimiters, no tool escalation, writes only via BR-02 confirmation, authorization enforced **outside** the LLM; prompt-injection test battery at the security gate | SecRev | injection tests failing; unexpected `pendingAction`s in audit log | open — control designed (T-053, T-064) |
| **R-03** | External dependency — **Groq outage/429s** (PRD §16) | med | med (assistant unusable) | 15 s timeout, bounded retries (2, exponential backoff, 429/5xx/network only), deterministic search fallback (FR-013); `ai.fallback` metric without content | AI | `ai.fallback` spike; sustained 429s from provider | open — control designed (T-050, T-057; proven at M-5) |
| **R-04** | Security/privacy — **cross-tenant data exposure** (PRD §16) | low | critical (BO-1 breach) | `ownerId` only from verified JWT `sub` (BR-01); repository-level scoping; ownership-matrix integration test per endpoint (IT-012-1, T-037); security review gate (T-064) | Back + SecRev | any matrix test failing; a 403 where 404 is required; findings in review | open — control designed (matrix suite at M-3) |
| **R-05** | Cost/quota — **Supabase Free-tier cost or quota surprises** (500 MB storage, 2 projects, shared-compute caps; PRD §16 — aligned with ADR-005, 2026-10-17) | med | med (budget breach, C-4 ≤ USD 25/mo) | Supabase **Free tier $0** for MVP (Supabase Auth 50k MAU included); documented Free-tier caps + **Pro upgrade path/trigger** ([../architecture/adr/ADR-005-supabase.md](../architecture/adr/ADR-005-supabase.md), [COST_ESTIMATION.md](COST_ESTIMATION.md)); AWS budget alarms at 80%/100% (T-074) for the AWS-side spend | AwsInfra | budget alarm firing; actuals outside the documented range; Supabase quota/size-limit errors; connection errors from non-pooler connects | open — alarms tasked (T-074); Pro-upgrade trigger to be documented with cost actuals |
| **R-06** | Data/ops — **schema migration failure in cloud** (PRD §16) | low | high (downtime) | Expand-contract migrations, `migrate deploy` in the pipeline, backups + **restore drill** (T-073, [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md)); forward-fix over destructive DDL | Back + AwsInfra | CI/deploy migration errors; `prisma migrate status` mismatch after deploy | open — drill tasked (T-073) |
| **R-07** | Process/scope — **scope creep** (tracking, households, voice) (PRD §16) | med | high (MVP never ships) | P0 freeze at T-004; PRD §8.2 exclusions; new ideas → P1/P2 roadmap **with an FR update**, never bolt-on code (index ground rule 6) | Prod + Orch | FR/PRD edits without a version bump; tasks outside the T-ranges; "small" features appearing in diffs | open — freeze planned at T-004 |
| **R-08** | Environment/tooling — **Docker missing on the dev machine → local DB setup friction** | high (confirmed: Docker NOT installed, 2026-10-15) | low–med (M-2 friction, schedule slip) | T-020 offers a **native PostgreSQL 16 fallback**; the chosen path (Docker Desktop install vs native PG) must be documented in task evidence; test-plan environments list both ([TEST_PLAN.md §2](TEST_PLAN.md)) | Back | `docker compose up -d` unavailable (already observed); Phase-3 tasks stalling on DB setup | **largely mitigated 2026-10-17 (ADR-005)** — hosted Supabase removes the local-DB blocker (local dev points `DATABASE_URL`/`DIRECT_URL` at the Supabase project); Docker now an optional fallback only; residual = environment hygiene |
| **R-09** | Infrastructure/platform — **Amplify SSR → private RDS connectivity unverified for this topology** | med | high (blocks M-6; possible budget break) | Network **spike at T-070/T-071** before staging deploy; fallback ladder per [../architecture/AWS_ARCHITECTURE.md §7](../architecture/AWS_ARCHITECTURE.md) / ADR-004: security-group-scoped access from Amplify egress → dedicated network path (VPC connector) → data-API style access — **never a public DB endpoint**. NAT gateway ≈ $32/mo is a flagged budget risk if a dedicated egress path is required | AwsInfra | spike result still open at T-071; D-OPEN-001 unresolved before staging; a NAT gateway line item appears on the bill | **superseded-pending-closure 2026-10-17 (ADR-005)** — no RDS remains in the topology (DB = Supabase pooler over public HTTPS); the T-070/T-071 spike collapses to an Amplify→Supabase reachability check; NAT-gateway cost tail void; close together with D-OPEN-001 |
| **R-10** | Platform/quota — **built-in transactional email limits may block verification/recovery emails** (Supabase Auth since ADR-005: built-in email ≈ 2–3/hour) | med | med (signup/recovery broken in staging) | Configure **custom SMTP** for Supabase Auth in staging/prod **or** disable confirmations in dev environments (documented per environment); verify at T-022 (manual signup test). *(Pre-ADR-005 remedy was Cognito + SES; SES no longer applies — auth left Cognito.)* | AwsInfra | failed email verification during T-022 or T-072 smoke; Supabase Auth email-rate-limit responses | open — verify at T-022 |
| **R-11** | Security — **no WAF at the edge during MVP** | med | med (abuse/OWASP traffic reaches app layer) | Compensating controls: app-level rate limiting (429 + `Retry-After`, API_SPEC §1, T-060), Zod input validation, Supabase Auth rate limiting, security headers; **revisit at launch** — WAF ≈ $15/mo per app is deferred as a deliberate budget choice (≈ 60% of the C-4 ceiling) | SecRev | scanner/abuse patterns in logs; sustained 429 storms; launch decision date reached | accepted (MVP) — revisit at launch; cost noted in [COST_ESTIMATION.md](COST_ESTIMATION.md) |
| **R-12** | Process/documentation — **bus factor, agent-coordination errors, and documentation drift — including the competing `docs/CONTRACT.md` registry** | med | high (wrong implementation, duplicated effort) | **T-003 adjudication (blocking Phase 1)**; a single authoritative registry per [../index.md §3](../index.md); Review-agent doc-consistency checks ("docs travel with code", IMPLEMENTATION_PLAN §2.4); DoD doc checklists ([DEFINITION_OF_DONE.md §b/e](DEFINITION_OF_DONE.md)) | Review + Orch | conflicting IDs/paths/base-path found in review; CONTRACT.md adjudication overdue at T-004; behavior changed without a doc change in the same PR | **mitigated 2026-10-17** — T-003 adjudicated: index-rooted set declared authoritative, CONTRACT.md retained as Adjudication Record + D-OPEN register ([../CONTRACT.md](../CONTRACT.md) §0); residual drift guarded by `tools/validate-docs.mjs` in CI (T-012) + Review-agent checks |
| **R-13** | Cost/financial — **pricing assumptions wrong, or region choice changes the cost basis** | med | med (budget breach or mispriced plan) | Every figure in [COST_ESTIMATION.md](COST_ESTIMATION.md) is labeled **assumption + region (us-east-1) + research date (2026-09/10) + "verify at purchase"**; budget alarms (T-074); re-verify pricing at T-070/T-074; region decision recorded (AWS_ARCHITECTURE §4, default `us-east-1`) | AwsInfra + Prod | actual bill outside documented ranges; region switch (e.g., `eu-central-1`) approved; Groq price change | open — assumptions labeled; re-verify at T-070 |
| **R-14** | Data — **data loss** | med (raised 2026-10-17: Supabase **Free tier has no automatic backups**, ADR-005) | high (permanent loss beyond RPO) | **Scheduled `supabase db dump` exports** (dedicated task to be added — ADR-005 names it; currently the closest existing task is T-073, whose scope is amended for the Supabase path) + **upgrade to Pro at launch** (daily backups, 7-day retention); **one timed restore drill (T-073)** adapted to the Supabase path per [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md); export-failure alarms ([../architecture/OBSERVABILITY.md](../architecture/OBSERVABILITY.md)) | AwsInfra | missing/failed scheduled dump; drill not executed before release (PRD §17) | open — dump task + Pro upgrade required before cloud data matters |
| **R-15** | Legal/licensing — **license undecided → legal risk for distribution** | med | med (cannot distribute/publish; unclear reuse terms for code and docs) | Decide the license at **T-004 / M-1** and record it (LICENSE file + README + CHANGELOG); until decided, treat the repository as all-rights-reserved and do not publish or redistribute | Prod + Human | no LICENSE file at M-1 exit; intent to publish/narrow distribution; external contribution requests | open — decision required at M-1 (T-004) |
| **R-16** | Platform/availability — **Supabase Free-tier operational limits: auto-pause after ~7 days idle (cold starts) + shared-compute caps** (ADR-005) | med | med (demo/staging cold-start friction) | Exercise scheduled environments (periodic smoke/cron), document pause behavior in DEPLOYMENT.md, pooler-only connections (IPv4), **Pro upgrade trigger** documented together with R-05; verify at T-072 smoke | AwsInfra + Back | first request after ≥7 days idle fails/times out; connection errors on direct (non-pooler) connects | open — accepted for MVP; Pro upgrade at launch |

*No PRD semantics were changed: R-01…R-07 above are the PRD §16 risks verbatim in meaning;
R-08…R-15 are additions owned by this file.*

**Numbering note (pending T-003 adjudication):** [../architecture/AWS_ARCHITECTURE.md §3](../architecture/AWS_ARCHITECTURE.md)
carries two risk references from the competing draft's numbering — "R-010" for the deferred WAF
and "R-012" for the (pre-ADR-005) auth e-mail quota/SES remedy. **In this register those risks are `R-11` and `R-10`
respectively.** This register is canonical per [../index.md §3](../index.md); the adjudication at
T-003 decides whether those cross-references are corrected in a later change.

---

## 2. Top-5 watchlist (narrative)

These are the five risks the Orchestrator actively watches milestone-to-milestone; everything
else in §1 is reviewed at exit checkpoints.

### W-1 — R-04: Cross-tenant data exposure
Highest-consequence risk in the product: a single ownership-scoping mistake violates the core
privacy promise (BO-1, "private by default"). Likelihood is judged *low* because the mitigation
is structural — `ownerId` derived only from the verified JWT (BR-01), scoping in the repository
layer, "not mine" ≡ "not found" (404) — but that judgment only holds **after** IT-012-1 exists.
The authorization-matrix suite (T-037, milestone M-3) is therefore treated as a release-blocking
gate, re-run in every regression sweep, and every new endpoint must ship with its matrix row
([DEFINITION_OF_DONE.md §e](DEFINITION_OF_DONE.md)). Early warning: a 403 appearing anywhere a
404 is expected, or any matrix test failing in CI.

### W-2 — R-01: LLM fabrication
Fabrication is the failure mode that would silently destroy the product's reason to exist
("recorded facts, not guesses"). Controls are layered: retrieval before generation (FR-007),
grounding validation that replaces ungrounded replies (FR-010), citations, and an AIE suite
with **fabricated records = 0** as a hard release gate (PRD §14/§17, gates in
[TEST_PLAN.md §5](TEST_PLAN.md)). Watch item: gates must be evaluated on a **recorded live-model
run** (T-056), not only the deterministic MockProvider, because CI mocks prove pipeline logic,
not real-model behavior. Early warning: `ai.ungrounded_detected` > 0 in any environment.

### W-3 — R-09: Amplify SSR → private RDS connectivity (and its NAT cost tail)

> **Superseded-pending-closure (2026-10-17, ADR-005):** the database moved to Supabase
> (hosted; pooler over public HTTPS) — no RDS, no private subnet, no NAT tail. What remains
> is a routine reachability check (Amplify → Supabase pooler), folded into T-070/T-071.
> The historical rationale below is retained.
This is the only risk that can invalidate the chosen deployment topology *and* break the budget
at the same time. Amplify Hosting reaching a database in a private subnet for this topology was
**not verified during documentation** (AWS_ARCHITECTURE §7, open item D-OPEN-001). If the path
requires a dedicated NAT gateway, ≈ $32/mo alone exceeds the C-4 ≤ USD 25/mo target. Mitigation
is a deliberate spike at T-070/T-071 with a fallback ladder (security-group-scoped access from
Amplify egress → dedicated network path) — **a public RDS endpoint is never an option**. Early
warning: the spike still has no verdict at T-071, or a NAT line item appears on the bill; then
[COST_ESTIMATION.md](COST_ESTIMATION.md) and the stakeholder (T-004 cost acceptance) are
re-engaged before proceeding.

### W-4 — R-13: Pricing assumptions / region choice shift the cost basis
Every dollar figure in [COST_ESTIMATION.md](COST_ESTIMATION.md) is a labeled 2026-09/10
`us-east-1` research assumption — **none of it is a measured bill**. Two plausible surprises
move the model materially: a region change (e.g., `eu-central-1` re-prices everything, see
AWS_ARCHITECTURE §4) and usage exceeding the MVP scale assumptions (Groq is the only strongly
usage-sensitive line — see the sensitivity table in COST_ESTIMATION §5). Controls: budget
alarms at 80%/100% (T-074), actuals-vs-assumptions update at T-074, and re-verification at
purchase (T-070). Early warning: any month where actuals land outside the documented range, or
a region decision recorded after costs were published. Related: R-05 (service quota/cost
surprises) rides on the same alarms.

### W-5 — R-12: Bus factor, coordination error, and documentation drift
This project is documentation-first and agent-assisted: the main failure mode before code
exists is **implementing against the wrong registry**. The competing `docs/CONTRACT.md` draft
([../index.md §5](../index.md) item 4) still conflicts with this documentation set on ID
numbering, API base path, auth mechanism, WCAG level, RTO, cost ceiling, and region — until
T-003 adjudicates it, every divergence is a potential wasted implementation. Controls: T-003
adjudication is blocking for Phase 1, one authoritative registry per index §3, Review-agent
doc-consistency checks on every PR, and DoD checklists that fail changes shipping without their
docs ([DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md)). Early warning: findings mentioning
"CONTRACT.md" still open at T-004, or docs changed in a PR without the matching behavior change
(or vice versa). Related: R-07 (scope creep) uses the same Review/Product escalation path.

---

## 3. Risk checkpoints (stop points)

| After | Checkpoint question | Related risks | Where defined |
|---|---|---|---|
| T-004 | Cost model accepted? | R-05, R-13, R-09 | [IMPLEMENTATION_PLAN §4](IMPLEMENTATION_PLAN.md) |
| T-023 | Auth UX acceptable in a real browser? (A-7 — Supabase Auth via `/api/auth/*` since ADR-005) | R-10 (email flows), A-7 fallback | IMPLEMENTATION_PLAN §4 |
| T-053 | Grounded-answer quality ≥ eval gates? | R-01, R-02, R-03 | IMPLEMENTATION_PLAN §4 |
| T-064 | Any open high-severity security finding blocks Phase 8 | R-02, R-04, R-11 | IMPLEMENTATION_PLAN §4 |
| T-072 | Staging smoke failure blocks release | R-03, R-09, R-10, R-06 | IMPLEMENTATION_PLAN §4 |
| T-074 | Budget alarms active; actuals vs assumptions | R-05, R-13 | TASK_BREAKDOWN T-074 |
| M-1 exit | CONTRACT.md adjudicated; license decided | R-12, R-15 | [MILESTONES.md](MILESTONES.md) §2 |

---

## 4. Related documents

- [../product/PRD.md](../product/PRD.md) §16 — source of R-01…R-07 semantics; §17 release gates
- [COST_ESTIMATION.md](COST_ESTIMATION.md) — cost-side mitigations (R-05, R-09, R-13)
- [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md) — R-14 controls
- [../architecture/SECURITY.md](../architecture/SECURITY.md) — R-02/R-04/R-11 control detail
- [TEST_PLAN.md](TEST_PLAN.md) — the automated tests that *are* the mitigations for R-01, R-03, R-04
- [MILESTONES.md](MILESTONES.md) — where each control must be verified
