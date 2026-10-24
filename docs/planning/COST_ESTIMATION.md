# Cost Estimation — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | AwsInfra agent (cost model) · stakeholder acceptance at T-004 ([MILESTONES.md §2](MILESTONES.md)) |
| Region | **`us-east-1`** (default for the MVP — [../architecture/AWS_ARCHITECTURE.md §4](../architecture/AWS_ARCHITECTURE.md)); Supabase project in **US East (Iowa)** (`aws-us-east-1`, ADR-005) |
| Budget target | **≤ USD 25/month** at MVP scale (PRD **C-4** / BO-3, [../product/PRD.md](../product/PRD.md) §12) |
| Actuals tracking | T-074 (budget alarms + actuals vs this document) |

> **EVERY FIGURE IN THIS DOCUMENT IS AN ASSUMPTION.** Prices were researched on the web in
> **2026-09/10 for `us-east-1`** and are labeled with their basis; **none is a bill, a
> measurement, or a purchased resource.** No AWS resource exists yet
> ([../architecture/AWS_ARCHITECTURE.md §1](../architecture/AWS_ARCHITECTURE.md)).
> **Re-verify all unit prices at purchase (T-070) and record actuals (T-074).**
> Groq figures are likewise assumptions until the recorded live run (T-056) yields measured
> token counts.

---

## 1. Scope & usage assumptions (MVP scale)

| Assumption | Value | Basis |
|---|---|---|
| Monthly active users (MAU) | **≤ 100** | MVP sizing for the cost model; Supabase Auth free tier (50,000 MAU) is far above this |
| Items per user | **≤ 1,000** | Personal-inventory scale (D6, AI_ARCHITECTURE §8) — negligible storage cost |
| Assistant requests per **active** user per day | **≤ 20** | Within server-side caps BR-12 (20 req/min, 100 messages/day/user) |
| Tokens per assistant request (cost model) | **≈ 1,500 input / 300 output** | Planning assumption — unmeasured; replace with measured counts from the T-056 live run |
| Database size | **≤ 500 MB** at MVP scale (Supabase Free disk cap; 1,000 items × ≤100 MAU fits comfortably) | Text-only records (images are P1, FR-025); verified Supabase Free cap 2026-10-15/17 |
| Environment schedule | **staging 24/7** (from T-070 through release validation); **production starts after M-6** | [../architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) environment table |
| Region / account | one region, one account, all environments ([AWS_ARCHITECTURE §5](../architecture/AWS_ARCHITECTURE.md)) | Locked for pricing; a region switch re-prices everything (R-13) |
| Assistant usage caps | BR-12 enforced server-side | [../requirements/BUSINESS_RULES.md](../requirements/BUSINESS_RULES.md) |

---

## 2. Unit price basis (assumptions — us-east-1, researched 2026-09/10 — **verify at purchase**)

| Service | Assumed price | Notes |
|---|---|---|
| Supabase Free (database + Supabase Auth) | **$0** | 500 MB disk; 2 active projects; shared Nano compute; Auth = 50,000 MAU; **no automatic backups**; auto-pauses after 1 week idle; direct connection has no IPv4 — use the shared pooler (verified at supabase.com/pricing 2026-10-15/17) |
| Supabase Pro (launch/production path) | **from $25/mo** | 8 GB disk; daily backups with 7-day retention; never pauses; **$10 compute credit covers the first Micro instance**; 100k MAU — upgrade trigger = Free-tier caps (ADR-005) |
| Supabase built-in email (Free) | included, rate-limited **~2–3 emails/hour** | Mitigation: custom SMTP (staging/prod) or confirmations disabled in dev (R-10) |
| Amplify Hosting | builds **$0.01/min** after 1,000 free min; CDN storage **$0.023/GB-mo** after 5 GB; data served **$0.15/GB** after 15 GB; SSR compute free to **100 GB-hrs/mo**, then **$0.20/GB-hr** | WAF attach ≈ **$15/mo per app** — deferred (R-11) |
| Secrets Manager | **$0.40/secret/mo**, first **5 free** per account | ≤ 5 secrets expected → $0 |
| CloudWatch alarms | **≈ $0.10/alarm/mo** | ≈ 4 alarms ≈ $0.40 + small log ingestion |
| AWS Budgets | ≈ $0 for 1–2 budgets (free allowance) | assumption — verify current Budgets pricing |
| NAT gateway (only in the superseded VPC design) | ≈ $0.045/hr ≈ $32/mo + data processing | **$0 — no VPC after ADR-005** (historical budget risk, was R-09) |
| Amazon SES (only if Supabase built-in email is insufficient; primary remedy = custom SMTP in Supabase) | ≈ $0.10/1,000 emails | Conditional (R-10) |
| Supabase backups / dumps | Free: **none automatic** — scheduled `supabase db dump` exports ≈ $0; Pro: daily backups (7-day retention) included in the $25/mo | [../architecture/DISASTER_RECOVERY.md §3, §10](../architecture/DISASTER_RECOVERY.md) |
| Groq `llama-3.3-70b-versatile` | **$0.59 / 1M input**, **$0.79 / 1M output** tokens | Dev free tier ≈ **30 RPM / 1,000 RPD** (assumption, no card) |
| Groq `llama-3.1-8b-instruct` (reduction option only) | ≈ $0.05 / 1M input, ≈ $0.08 / 1M output | assumption, same research date — re-verify |

---

## 3. Environment cost tables (monthly, assumptions)

### (a) Local development — **≈ $0/month**

| Line | Basis | Assumed cost |
|---|---|---|
| Node 24.13.0 / npm 11.6.2 / git 2.52.0 / Python 3.13.7 (recorded 2026-10-15) | OSS toolchain | $0 |
| Supabase Free project via `DATABASE_URL`/`DIRECT_URL` (primary local dev DB per T-020, ADR-005 — only network reachability required) | Supabase Free | $0 |
| PostgreSQL 16 — **native install** (optional offline fallback; Docker is **not installed** on the inspected machine, 2026-10-15; T-020, R-08) | OSS | $0 |
| Docker Desktop — *only if installed instead* (optional fallback only after ADR-005) | Free for personal use; paid license required for larger organizations (assumption — verify Docker's current licensing terms) | $0 for personal use; **license risk noted**, avoided entirely by the Supabase/native-PG paths |
| Groq API during development | Dev free tier ≈ 30 RPM / 1,000 RPD (assumption) covers dev + CI-free usage; live key used **only from local dev** (IMPLEMENTATION_PLAN §2.5) | $0 expected |
| CI minutes (GitHub Actions or equivalent, `.github/workflows/ci.yml` T-012) | Within the free allowance for this repository's size (assumption — verify plan limits) | $0 expected |
| **Local total** | | **≈ $0/mo** |

### (b) Staging (24/7 during M-6 validation)

| Line item | Assumption basis | Assumed $/mo |
|---|---|---|
| Supabase Free (database + Supabase Auth) | $0 — 500 MB, shared Nano, 50k MAU; no automatic backups (scheduled dumps ≈ $0) | ≈ $0.00 |
| Amplify Hosting (builds + SSR + CDN + data) | Free allowances cover MVP build/traffic volume; upper figure if builds/traffic exceed them | ≈ $0 – $8.00 |
| Secrets Manager (`GROQ_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_JWT_SECRET` — 4 secrets) | $0.40/secret/mo but **first 5 free → expected $0.00**; $1.60 carried as conservative worst case if the free allowance does not apply | ≈ $0.00 – $1.60 |
| CloudWatch (≈ 4 alarms + log ingestion) | $0.10/alarm/mo | ≈ $0.60 |
| Data transfer / egress | Small volumes at personal scale | ≈ $1.00 |
| **Staging subtotal (AWS + Supabase Free)** | 0 + (0–8) + (0–1.60) + 0.60 + 1 | **≈ $2 – $11/mo** |
| *Not in the subtotal:* DR (scheduled `supabase db dump` exports) | DISASTER_RECOVERY §10: ≈ $0 | *+ ≈ $0* |

### (c) Production (starts after M-6)

| Line item | Assumption basis | Assumed $/mo |
|---|---|---|
| Supabase Free for MVP — database + Supabase Auth (**Pro at launch: from $25/mo**, incl. daily backups 7-day retention, never pauses) | as staging; Pro = documented upgrade path (ADR-005) | ≈ $0.00 (Free) · ≈ $25 (Pro, launch) |
| Amplify Hosting | free allowances → modest overage at growth | ≈ $0 – $8.00 |
| Secrets Manager | 5-free-secret allowance | ≈ $0.00 – $1.60 |
| CloudWatch alarms + logs | ≈ $0.10/alarm × ≈ 4 + small ingestion | ≈ $0.60 – $2 |
| Data transfer / egress | personal scale | ≈ $1 |
| DR (scheduled dumps, ≤ 500 MB) | DISASTER_RECOVERY §10 | ≈ $0 |
| Budgets / SSM Parameter Store / IAM | free allowances (assumption) | ≈ $0 |
| **Production subtotal (excluding Groq)** | sum of rows on Supabase **Free** | **≈ $2 – $12/mo** (≈ $27 – $37/mo after the Supabase **Pro** launch upgrade) |
| Groq usage | usage-based — see §4 (0 to tens of USD, engagement-dependent) | see §4 |
| *Deferred / risk lines (NOT included):* WAF at launch | ≈ $15/mo per app | *+ $15 — a deliberate decision (R-11)* |

### (d) Budget view vs PRD C-4 (≤ USD 25/month)

| Running configuration | Fixed subtotal (assumption) | Fits C-4 ≤ $25? |
|---|---|---|
| Local only | ≈ $0 | ✅ |
| Staging only (Supabase Free, incl. DR ≈ $0) | ≈ $2 – $11 | ✅ |
| Production only, Supabase Free (excl. Groq) | ≈ $2 – $12 | ✅ |
| **Staging + production both running 24/7 (Supabase Free)** | **≈ $4 – $23** | ✅ **comfortably kept for the MVP** |
| Production after Supabase **Pro** launch upgrade (excl. Groq) | ≈ $27 – $37 | ⚠️ deliberate launch decision — above C-4, taken knowingly |
| + Groq at upper-bound usage (§4) | + up to ≈ $67 | ❌ usage, not infrastructure, is what breaks C-4 |

> **Note (post-ADR-005):** with the database and auth on Supabase Free, the MVP **fixed**
> cost is ≈ $0 + Amplify free allowances + pennies of AWS services — **C-4 (≤ USD 25/mo) is
> comfortably kept for the MVP**; the ceiling is threatened only by (a) Groq usage (§4),
> (b) the deliberate Supabase Pro upgrade at launch, or (c) deferred WAF (R-11). The
> historical pre-ADR-005 decision point (staging+production ≈ $34–60 on RDS) is retired
> with the RDS/Cognito supersession.

---

## 4. Groq cost model

**Formula (monthly):**

```
$ = active_users × requests_per_day × 30
    × ( input_tokens  × $0.59 / 1,000,000
      + output_tokens × $0.79 / 1,000,000 )
```

Assumption set: 1,500 input / 300 output tokens per request (unmeasured — replace with T-056
measured counts), 30-day month, `llama-3.3-70b-versatile`, us-east-1-equivalent API pricing
(re-verify at purchase).

### Worked example — full MVP usage (100 users × 20 requests/day)

| Step | Calculation | Result |
|---|---|---|
| Requests/day | 100 × 20 | 2,000 |
| Input tokens/day | 2,000 × 1,500 | 3,000,000 (3.0M) |
| Output tokens/day | 2,000 × 300 | 600,000 (0.6M) |
| Input $/day | 3.0M × $0.59/1M | **≈ $1.77** |
| Output $/day | 0.6M × $0.79/1M | **≈ $0.47** |
| **Monthly** | ($1.77 + $0.47) × 30 | **≈ $67/mo** at that scale |

This is an **upper bound**: it assumes *every* registered user is active every day at 20
requests. Real engagement is lower — see the sensitivity table.

### Worked example — solo-dev / CI usage (30 requests/day)

| Step | Calculation | Result |
|---|---|---|
| Tokens/day | 30 × (1,500 in + 300 out) | 45,000 in / 9,000 out |
| $/day (if billed) | 0.045M × $0.59 + 0.009M × $0.79 | ≈ $0.027 + $0.007 ≈ **$0.03** |
| **Monthly (if billed)** | ≈ $0.03 × 30 | **≈ $1.01/mo** |
| **Monthly, realistically** | dev free tier ≈ 30 RPM / 1,000 RPD covers 30 req/day | **≈ $0.00 billed** |

*Note:* much lighter dev probes (a few hundred tokens per request, e.g. classification-only
calls) bring the billed figure down by an order of magnitude (≈ $0.02–0.20/mo); at the full
1,500/300 assumption the computed figure is ≈ $1/mo. Either way it is **< 0.5% of the C-4
budget and covered by the free tier** — immaterial, but recorded here with its arithmetic so
the number can be re-derived rather than trusted.

### Sensitivity table — Groq per month (assumption: 1,500/300 tokens, 30-day month)

| MAU scenario | All MAU active daily at 20 req/day | Only 20% active daily at 20 req/day | Infra prod, excl. Groq (Supabase Free) | Combined total |
|---|---|---|---|---|
| **50 MAU** | 30M in + 6M out → **≈ $22.44/mo** | ≈ **$4.49/mo** | ≈ $2 – $12 | ≈ $6 – $35 |
| **100 MAU** | 90M in + 18M out → **≈ $67.32/mo** | ≈ **$13.46/mo** | ≈ $2 – $12 | ≈ $15 – $80 |
| **500 MAU** | 450M in + 90M out → **≈ $336.60/mo** | ≈ **$67.32/mo** | ≈ $2 – $12 (Supabase Auth still free < 50k MAU) | ≈ $69 – $349 |

Reading: **Groq is the only strongly usage-sensitive line** and is the first thing to break
C-4 as usage grows; infrastructure stays near $0 across all three scenarios (Supabase Free +
Amplify allowances). BR-12 caps
(100 messages/day/user) bound the worst case server-side.

---

## 5. Cost-control measures (built into the plan)

| # | Measure | Where it lives |
|---|---|---|
| 1 | AWS budget alarms at **80% / 100%** of the ≤ $25 target, email via SNS | T-074 ([../architecture/AWS_ARCHITECTURE.md §2](../architecture/AWS_ARCHITECTURE.md)) |
| 2 | Right-sizing: Supabase Free shared Nano compute for the MVP; Pro Micro (covered by the $10 compute credit) only on the documented upgrade | ADR-005, [../architecture/AWS_ARCHITECTURE.md §2.1](../architecture/AWS_ARCHITECTURE.md) |
| 3 | Supabase Auth **free tier** (50k MAU) — zero auth cost at MVP scale | D5, §2 of this file |
| 4 | **WAF deferred** (≈ $15/mo avoided); compensating app-level controls instead | R-11, [RISKS.md](RISKS.md) |
| 5 | **Server-side assistant caps** BR-12 bound Groq exposure | [../requirements/BUSINESS_RULES.md](../requirements/BUSINESS_RULES.md) |
| 6 | Groq **dev free tier** in development; live key only from local dev | IMPLEMENTATION_PLAN §2.5 |
| 7 | Secrets Manager ≤ 5 free; **SSM Parameter Store (standard, free)** for non-secret config | AWS_ARCHITECTURE §2 |
| 8 | Stop/destroy **non-production when idle** (staging restartable) | AWS_ARCHITECTURE §10.2 |
| 9 | Single region/account; no separate CloudFront; no cache/search/vector services | AWS_ARCHITECTURE §3 (rejected services) |
| 10 | Amplify free allowances (1,000 build min, 100 SSR GB-hrs, 5 GB CDN, 15 GB served) | §2 of this file |
| 11 | Lean DR: scheduled `supabase db dump` exports ≈ $0/mo on Free (Pro adds daily backups at launch) | DISASTER_RECOVERY §3, §10 |

---

## 6. Cost-reduction options if over budget (in order of simplicity)

1. **Stop non-production nights / between validation cycles.** Staging runs on Supabase
   Free ($0) — there is no instance-hour billing to pause; the lever is `cdk destroy` on the
   AWS staging stack plus deleting the staging Supabase project between cycles ("on-demand
   start" — staging is documented restartable,
   AWS_ARCHITECTURE §10.2 / DEPLOYMENT.md). Supabase Free itself auto-pauses after 1 week
   idle.
2. **Stay within the two free Supabase projects** (Free tier = 2 active projects —
   assumption, verify): one for staging, one for production; a third environment must share
   or move to Pro (from $25/mo).
3. **Cheaper Groq model for classification only:** route intent classification to
   `llama-3.1-8b` (≈ $0.05/1M in, ≈ $0.08/1M out — assumption) while keeping
   `llama-3.3-70b-versatile` for answer generation. Saving = (share of input tokens that are
   classification) × input cost — **measure that share from the T-056 run before adopting**;
   a provider swap stays a config/adapter change per D3/ADR-003.
4. **Trim assistant prompt/context size** after measuring at T-056 — retrieval context is
   already bounded (≤ 20 records, ≈ 4k tokens, FR-007), so gains come from prompt examples.
5. **Trim CloudWatch log retention/alarm count** (small effect at ≈ $1–2/mo).

*Considered and rejected for now:* **Aurora Serverless v2** — minimum ACU cost is higher than
Supabase Free at this scale (ADR-002, assumption); Multi-AZ RDS (2× cost, R-14/availability
trade-off documented; no RDS after ADR-005); a second CloudFront distribution (duplicates Amplify's CDN).

---

## 7. What would change these numbers

1. **Region choice** — anything other than `us-east-1` re-prices every AWS line (R-13;
   AWS_ARCHITECTURE §4 switch guidance).
2. **Real usage vs assumptions** — MAU, daily actives, requests/active user/day, and actual
   tokens/request (1,500/300 is unmeasured until T-056).
3. **Groq price/model changes** — provider pricing is outside our control (re-verify at
   purchase; D3 abstraction keeps a swap cheap).
4. **Supabase plan or email changes** — Free → Pro (from $25/mo); custom SMTP (or
   SES-as-SMTP, ≈ $0.10/1k) if Supabase's built-in email is insufficient (R-10).
5. **Amplify build/traffic volume** beyond free allowances (builds $0.01/min, SSR $0.20/GB-hr,
   served $0.15/GB).
6. ~~NAT gateway retained in the dedicated VPC~~ — no longer applicable: **no VPC after
   ADR-005** (historical +$32/mo risk removed).
7. **WAF added at launch** → ≈ +$15/mo (R-11 — deliberate decision, ~60% of the C-4 ceiling).
8. **Storage growth beyond the 500 MB Free cap** → Supabase Pro (from $25/mo, 8 GB, daily
   backups included).
9. **Availability requirements beyond the Free-tier terms** (no uptime SLA on Free —
   assumption, verify) → Supabase Pro rather than any Multi-AZ equivalent.
10. **AWS price-list changes** between research (2026-09/10) and purchase — the reason every
    figure carries "verify at purchase" (T-070) and an actuals pass (T-074).

---

## 8. Actuals tracking (T-074 deliverable)

When the first AWS bill exists, the AwsInfra agent adds an **"Actual (measured)" column** to
§3 tables, computes variance per line, and records: bill period, region, total actual spend,
variance vs assumption, and any action taken (right-size / teardown / escalate to stakeholder).
Supabase Free bills $0 — record console usage figures (disk, MAU, pauses, email volume) as
the Supabase actuals. Budget alarms (80% / 100% of $25) must be
**active and verified** before production traffic.
Until that column exists, this document contains **no measured costs** — do not cite it as
evidence of spend (see [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) anti-patterns).

## Related documents

- [../product/PRD.md](../product/PRD.md) §12 (C-4) · §16 (R-05) — budget constraint and risk
- [../architecture/AWS_ARCHITECTURE.md](../architecture/AWS_ARCHITECTURE.md) §9 — per-service cost table
- [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md) §10 — DR cost lines
- [../architecture/adr/ADR-002-database.md](../architecture/adr/ADR-002-database.md) — why not Aurora Serverless
- [RISKS.md](RISKS.md) — R-05, R-09, R-10, R-11, R-13 (cost-side risks)
- [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) — T-070 (verify prices at purchase), T-074 (actuals + alarms)
