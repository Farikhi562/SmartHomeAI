# Observability — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Pillars | Logs · Metrics · (traces: deferred) · Alerts |
| Implementation task | T-062 (structured logger, redaction, metrics, staging alarms) — [TASK_BREAKDOWN](../planning/TASK_BREAKDOWN.md) |

> All AWS resources below (CloudWatch log groups, metric filters, alarms, SNS topic) are
> **proposed CDK output, not provisioned**. Retention/cost figures are labeled assumptions.

Observability exists to answer three questions fast: *Is it up?* *Is it degraded?* *Did user
data leak into telemetry?* It is deliberately minimal — this is a personal-scale product.

---

## 1. Logs

**Format:** structured JSON, one object per line, emitted by `src/lib/observability`
(central logger; `console.log` of raw objects is a review finding).

**Allowed fields (allowlist — everything else is dropped):**

| Field | Meaning |
|---|---|
| `ts` | RFC 3339 timestamp |
| `level` | `debug` \| `info` \| `warn` \| `error` (threshold via `LOG_LEVEL` env) |
| `requestId` | server-generated ID, echoed as `x-request-id` (API_SPEC §1) |
| `route` | matched route pattern (e.g. `/api/items/:id`), never full URLs with query secrets |
| `method`, `statusCode` | HTTP facts |
| `latencyMs` | server-side duration |
| `ownerIdHash` | salted hash or omitted — **never a raw user id/email** |
| `outcome` | e.g. `ok`, `validation_error`, `rate_limited`, `ai_fallback`, `unauthenticated` |
| `event` | counter/event name for metric correlation |

**Never logged (REDACTED):** message/conversation content, item names, location names,
descriptions, emails, tokens/cookies, `GROQ_API_KEY`/`DATABASE_URL`, raw provider request or
response bodies, stack traces in responses (logs may carry a sanitized stack at `error`
level server-side only). Model metadata (`model`, `latencyMs`, token counts, `intent`) is
allowed — this matches the `messages` metadata columns and BR-09/S-10.

**Destination and retention (assumption-labeled):**

| Environment | Log group (proposed) | Retention | Notes |
|---|---|---|---|
| staging | `/amplify/smarthomeai-staging` + app log group | **30 days** | metric filters + alarms live here first (T-062) |
| production | `/amplify/smarthomeai-production` + app log group | **90 days** | CloudWatch Logs retention setting via CDK; ingestion cost small at MVP volume (**assumption**) |

**Metric filters** turn log patterns into alarms without new code: `outcome=rate_limited`,
`outcome=ai_fallback`, `statusCode=5xx`, `event=audit.purge_failed`.

**Redaction test requirement:** unit test **UT-023-1** (log redaction guard,
FR-023/FUNCTIONAL_REQUIREMENTS) asserts that a simulated request containing marker strings in
content fields never appears in emitted log output. It runs in the PR pipeline; failure
blocks merge.

---

## 2. Metrics

Application counters emitted in-process and published as CloudWatch custom metrics (EMF
log-line or `PutMetricData` — mechanism chosen in T-062, **assumption**):

| Metric | Meaning | Why it matters |
|---|---|---|
| `ai.request` | assistant turns attempted | denominator for rates |
| `ai.fallback` | FR-013 fallback path taken (provider failure/malformed output) | provider health (Groq dependency, ADR-003) |
| `ai.ungrounded_detected` | grounding validation rejected model output (FR-010) | safety signal (S-1) |
| `api.4xx` | client errors by route class | input/validation regressions, abuse |
| `api.5xx` | server errors | availability (NFR-002) |
| `rate.limited` | 429s issued | abuse/limits tuning |

All counters are **privacy-safe**: counts only, no labels carrying user content or raw IDs.

**Platform metrics (no work needed from us):**

- **Amplify Hosting** provides build duration, hosting request/latency and cache metrics in
  its console (assumption on exact metric names — verify at T-071).
- **Supabase** (database + auth, ADR-005): CPU/storage/connection and auth metrics live in
  the **Supabase dashboard** — we do not mirror them into CloudWatch and do not rely on any
  Supabase alerting API in the MVP. Database/auth problems surface in AWS via our own
  signals (`api.5xx`, `GET /api/health`).

---

## 3. Traces — deliberately deferred

Distributed tracing (X-Ray/OTel) is **not** adopted for the MVP: one small deployable, one
database, synchronous flows, and per-request `requestId` correlation across app → Groq → DB
is sufficient to reconstruct any request. **Revisit trigger:** a second service appears
(ADR-001 escape hatch) or p95 investigations become routine.

---

## 4. Alerts

Proposed single SNS topic → email subscription (CDK, T-070/T-062). All thresholds are
starting values to be tuned with real staging data.

| Alarm (proposed name) | Condition | Window | Action |
|---|---|---|---|
| `smarthomeai-<env>-ai-fallback-rate` | `ai.fallback` / `ai.request` > **10%** | 15 min | Email: likely Groq outage/degradation → check provider status, expect FR-013 UX |
| `smarthomeai-<env>-api-5xx` | `api.5xx` rate > **1%** of requests | 10 min | Email: page owner; consider rollback (DEPLOYMENT §7) |
| `smarthomeai-<env>-budget` | AWS Budgets actual/forecast > **80%** of ≤ USD 25/mo threshold | Daily eval | Email (then 100% second threshold) — C-4, T-074 |
| `smarthomeai-<env>-purge-failed` | `event=audit.purge_failed` log filter > 0 | 5 min | Email: FR-014 retention job failure (retried job + alarm per FR-014 error conditions) |

Database metrics (CPU, storage, connections) and auth metrics come from the **Supabase
dashboard** (§2) — no CloudWatch alarm covers them, and no Supabase alerting API is
invented for the MVP; storage growth against the 500 MB Free cap is checked manually and
is the documented Pro-upgrade trigger.

Alarm cost: ~**$0.10/alarm/mo** per alarm (**assumption**) → ≈ $0.40/mo for this table.
Notifications are email-only for MVP; no pager/escalation tooling.

---

## 5. Health checks

- **`GET /api/health`** (API_SPEC §3.1, unauthenticated): returns
  `{ status, version, db: "up" | "down" }` with a lightweight DB ping.
- Used as the **post-deploy smoke endpoint** (deploy pipeline) and by the T-072 staging
  smoke test chain: health → auth → item → event → search → assistant.
- Not exposed as a public SLA page; contains no sensitive data.

---

## 6. Dashboards

**One CloudWatch dashboard per environment** (`smarthomeai-<env>`), minimal widget set:

1. Request count + 5xx rate + 4xx rate (24 h)
2. AI request/fallback/ungrounded rates (24 h)
3. Database status from our health check (24 h) + pointer to the Supabase dashboard (DB metrics are not mirrored into CloudWatch)
4. Active alarms + budget status

No business dashboards in AWS (see §7).

---

## 7. What we deliberately do NOT monitor

| Not monitored | Why |
|---|---|
| **Per-user content** — messages, item/location names, conversation text | Privacy: BR-09/S-10 forbid content in telemetry |
| **Individual user behavior / funnels** | No product analytics in cloud telemetry; first-party analytics events are P1 (T-087) and privacy-limited by PRD §15 |
| **Business KPIs beyond privacy-safe counters** | Counts above are operational only; no per-owner segmentation that could re-identify |
| **Full SQL/query logs** | Noise + plan exposure; use Prisma logging only at `warn`/`error` locally |
| **Traces** | Deferred (§3) |
| **Synthetic canaries** | Nice-to-have; health check on deploy is enough for MVP — revisit if 99.5% (NFR-002) must be *proven* rather than targeted |

---

## 8. Task and verification mapping

| Item | Task | Evidence required |
|---|---|---|
| Logger with redaction, counters, staging alarms | T-062 | **UT-023-1 redaction unit tests green**; alarm visible in staging (recorded, not assumed) |
| CI scanning (secret + dependency) feeding alert hygiene | T-063 | CI run recorded |
| Alarm thresholds tuned on real staging traffic | T-072 smoke + follow-up | Values updated in CDK with a comment citing observed data |
| Budget alarm | T-074 | Alarm active; assumptions vs actuals recorded in COST_ESTIMATION |

## Related documents

- [SECURITY.md](SECURITY.md) — log redaction rules and audit retention
- [AWS_ARCHITECTURE.md](AWS_ARCHITECTURE.md) — CloudWatch/Alarm service selection and cost
- [DEPLOYMENT.md](DEPLOYMENT.md) — health checks in the pipeline, post-deploy checklist
- [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) — alarms during incidents
- [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) — fallback semantics behind `ai.fallback`
