# Disaster Recovery — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Scope | Single-region MVP; Supabase PostgreSQL is the only stateful system (ADR-005) |
| Targets | **RTO ≤ 4 h, RPO ≤ 24 h** (canonical: `NFR-008` in [../requirements/NON_FUNCTIONAL_REQUIREMENTS.md](../requirements/NON_FUNCTIONAL_REQUIREMENTS.md); an earlier draft cited "NFR-006 in CONTRACT.md" — corrected at T-003 adjudication, 2026-10-17) |
| Availability | 99.5% monthly target (NFR-002) |
| Task | T-073 (backups + one recorded restore drill) — [TASK_BREAKDOWN](../planning/TASK_BREAKDOWN.md) |

> Nothing in this document has been executed yet. All durations are **engineering estimates,
> not measurements**. Actual restore time is only known after the T-073 drill records it.

---

## 1. Scope and justification

- **Single region** (default `us-east-1`, AWS_ARCHITECTURE §4) — cross-region replication
  is explicitly out of scope for the MVP.
- **RPO ≤ 24 h / RTO ≤ 4 h:**
  - *RPO 24 h* — the product stores personal notes about where belongings were placed; losing
    up to a day of entries is recoverable by user re-entry and is an accepted trade-off for
    the cost ceiling (C-4 ≤ USD 25/mo). Supabase **Free has no automatic backups**; the MVP
    basis is scheduled `supabase db dump` exports (below) whose cadence in practice targets a
    window at or below 24 h; the **contractual** promise stays 24 h.
  - *RTO 4 h* — restore is a known, scripted sequence (§4) against a small database; no data
    science or re-indexing step exists.
- These are **targets for the MVP**, to be proven by the T-073 drill and re-stated with the
  measured number.

---

## 2. Threats covered

| Threat | Covered by | Residual risk |
|---|---|---|
| Accidental data deletion (row/table, bad UPDATE) | Restore from the latest scheduled dump export (§3) — **targets**, not achieved guarantees | Deleting data *and* waiting past the last dump before noticing → unrecoverable on Free (no PITR) |
| Bad migration / broken deploy | Expand-contract + forward-fix ([DEPLOYMENT.md](DEPLOYMENT.md) §5–6) | Irreversible DDL executed manually (prohibited) — process risk |
| Supabase project/compute failure (incl. Free auto-pause after 1 week idle) | Handled by the Supabase platform; paused compute resumes on access; damaged data → dump restore (§4) | Platform incidents are outside our control; Free tier has no uptime SLA (**assumption** — verify current Supabase terms) |
| Storage/volume loss | Supabase-managed storage; scheduled dumps are exported off-platform (§3) | Dump cadence bounds the loss window |
| Region outage | **Accepted risk for MVP (documented, not mitigated)** — single region, no warm standby | Outage duration = full region outage; users see downtime until the region recovers |
| Account compromise | Least-privilege IAM, Secrets Manager, env separation ([SECURITY.md](SECURITY.md)) | Dump exports are subject to the same storage controls; see IR §7 |
| Volume growth / full storage | 500 MB Free-tier cap — usage visible in the Supabase dashboard; Pro upgrade is the documented escape | Manual action required (monitoring is manual in MVP — no invented Supabase alerting API) |

---

## 3. Backups

**Reality check (verified at supabase.com/pricing 2026-10-15/17):** Supabase **Free tier
has NO automatic backups**. The MVP backup basis is therefore **scheduled `supabase db
dump` exports** (proposal, below). Upgrading to **Pro (from $25/mo)** enables **daily
backups with 7-day retention**; point-in-time recovery (PITR) is a **paid add-on on Pro+
only**.

| Backup | Mechanism | Retention | Scope | Notes |
|---|---|---|---|---|
| **Automatic backups / PITR** | Supabase: **none on Free**; Pro = daily backups (7-day retention); PITR = paid add-on on Pro+ | 7 days (Pro) | staging + production (per env) | **Not available in the MVP Free tier** — Pro upgrade is the launch path |
| **Scheduled dump export (proposal)** | `supabase db dump` scheduled in CI (e.g. nightly GitHub Action), stored off-platform (repo artifacts or cheap object storage) | **14 days**, rolling (proposal) | production (staging optional/cheaper) | The MVP protection — proposal cadence, to be confirmed at T-022/T-073 |
| **Schema/migrations** | Git (`prisma/migrations`) | Indefinite (repo history) | all | Rebuild schema from code |
| **App artifacts** | Git tags + Amplify build history | Indefinite (git) | all | Rebuild rather than restore |

Dump schedule (proposal):

| When (UTC) | What | Retention |
|---|---|---|
| Nightly 03:00 | `supabase db dump` of the production project → dated export | 14 days (lifecycle deletion, assumption) |
| Nightly 03:30 (optional) | staging dump | 7 days |
| Pre-release (manual, optional) | named dump before a high-risk migration | until release verified |

**Cost of DR (assumption):** dump export storage is a small file (≤ 500 MB Free cap) —
**≈ $0/mo in repo/CI artifacts or pennies in object storage**; scheduled dumps are
included in the Free tier. The Pro upgrade that adds daily backups (7-day retention) costs
from $25/mo and is counted in
[COST_ESTIMATION.md](../planning/COST_ESTIMATION.md) as the launch path, not the Free MVP
total. **Labeled assumptions, verify and record in
[COST_ESTIMATION.md](../planning/COST_ESTIMATION.md).**

---

## 4. Restore procedures

**Dump restore (most common: bad migration, data damage, deletion) — estimated
total ≈ 45–120 min, an estimate, not a measurement:**

1. **Detect & decide** — alarm/user report → severity assignment
   ([SECURITY.md](SECURITY.md) §4). *≈ 5–15 min.*
2. **Stop writes** — disable the app (feature flag / Amplify disable) to prevent divergence.
   *≈ 5 min.*
3. **Restore the latest scheduled dump** — take the most recent `supabase db dump` export
   ≤ the damage event and restore it into a clean Supabase project (or the same project
   after wipe) via `psql`/Supabase CLI. Restore duration scales with DB size; for ≤ 500 MB
   expect *≈ 10–30 min* (**estimate**). Free tier has **no PITR** — the restore point is
   the dump cadence, not an arbitrary timestamp.
4. **Verify the restored data** — run read-only checks: row counts per table vs expectations,
   newest events, spot-check one user's items; optionally run `prisma migrate status`.
   *≈ 15–30 min.*
5. **Repoint the app** — update `DATABASE_URL`/`DIRECT_URL` in **Secrets Manager** if the
   project/endpoint changed, restart/redeploy the app. *≈ 5–15 min.*
6. **Verify** — post-deploy checklist ([DEPLOYMENT.md](DEPLOYMENT.md) §10), especially the
   T-072 smoke path. *≈ 10–20 min.*
7. **Cleanup & learn** — retire the damaged project/database after sign-off; take a fresh
   dump as the new baseline; record actual timeline in the drill/incident report.

**Supabase instance/compute failure:** handled by the Supabase platform (rebuild/resume);
Free-tier compute auto-pauses after 1 week idle and resumes on access (cold start). If data
is damaged, the dump restore above applies. **Estimate: minutes (platform-dependent).**

**Region outage:** no automated procedure (accepted risk, §2). Recovery = when the region
returns, verify stack integrity, or restore the latest **dump export** (which lives
off-platform) into a Supabase project in a second region — i.e.,
RPO for a full-region loss is bounded by the latest scheduled dump; this is a
documented gap, accepted for MVP.

---

## 5. Restore drill (T-073)

Quarterly (and once before production sign-off):

1. Pick a recent scheduled dump export from **staging** (production drill allowed
   but scheduled).
2. Execute §4 steps 3–6 verbatim, **timed with a stopwatch**, in a clean Supabase project.
3. Record: start/end timestamps, actual RTO, data-verification results, issues found, and the
   **measured RPO window** exercised.
4. Write the drill report into the repo (`docs/` or CI artifacts) — **actual numbers only;
   never estimated figures recorded as results.**
5. Update this document's target-vs-measured table.

| Drill date | Environment | Target RTO | **Measured RTO** | Findings |
|---|---|---|---|---|
| (pending T-073) | staging | ≤ 4 h | not yet run | — |

---

## 6. Application-level recovery

- **No seeding into real environments.** Application data is *user* data; the dev seed
  (`prisma/seed.ts`) runs only on `local`/`dev` (DATABASE_SCHEMA §6.5). Restoring means the
  database, not sample rows.
- After restore: run the T-072 smoke path end-to-end (health → auth → item → event → search →
  assistant) and confirm the assistant still falls back gracefully (FR-013).
- In-memory state (rate-limit buckets, JWT verification caches, location-tree cache) is disposable —
  nothing to rebuild.

---

## 7. Conversation data loss tolerance (disclosure)

The RPO applies to **all tables**, including `conversations` and `messages`. In the worst
case defined by target (24 h), **up to one day of assistant conversation history could be
lost** in a disaster; users have already been given an explicit privacy control to hard-delete
conversations at any time (FR-023), and conversations are continuity convenience rather than
the system of record (items/locations/events are). This tolerance is stated here so it is a
*decision*, not an accident. The MVP Free tier has **no PITR** — actual loss is bounded by
the dump cadence (and by Pro daily backups after the launch upgrade); the drill records the
real figure.

---

## 8. Incident response pointer

Detection, severity levels, containment (key rotation, feature disable, pool lockdown),
recovery, and communication are specified in **[SECURITY.md §4](SECURITY.md)**. This document
covers only data/system restoration; the incident timeline lives with the response process.

---

## 9. What is NOT backed up

| Asset | Backup? | Rationale / recovery path |
|---|---|---|
| **Supabase Auth users (users, passwords, MFA)** | **No automated export on Free** | No supported full user export is relied upon for recovery (assumption to re-verify against current Supabase docs). Recovery: users re-verify by email into a rebuilt project; app data keyed by `sub` would require an id mapping exercise — accepted as a known MVP gap and a reason projects are separate per environment |
| **Amplify builds/artifacts** | Not treated as durable | Rebuild from git tag (DEPLOYMENT §8) |
| **Secrets Manager values** | Not "backed up" | Re-enter/rotate values manually; `DATABASE_URL` changes on restore anyway (§4.5) |
| **SSM parameters** | Recreated from CDK/app config | Config is code |
| **Application logs** | 30/90-day retention only ([OBSERVABILITY.md](OBSERVABILITY.md)) | Telemetry, not data of record |
| **Cross-region copies** | None | Single-region scope (§1) |

---

## 10. Cost summary (assumptions)

| Item | Assumed cost |
|---|---|
| Scheduled dump exports (14 d, ≤ 500 MB Free cap) | ≈ $0 (repo/CI artifacts or pennies of object storage — **assumption**) |
| Supabase Pro upgrade (launch path; includes daily backups, 7-day retention) | from $25/mo — counted in [COST_ESTIMATION.md](../planning/COST_ESTIMATION.md), not the Free-tier MVP total |
| Restore drill run (temporary Supabase project / restore, minutes–hour) | pennies–$1 one-off (**assumption**) |
| **Total DR cost (MVP, Free tier)** | **fits comfortably within the ≤ USD 25/mo MVP budget (C-4)** — verify in [COST_ESTIMATION.md](../planning/COST_ESTIMATION.md) |

## Related documents

- [DEPLOYMENT.md](DEPLOYMENT.md) — migration/rollback (what DR does *not* replace)
- [SECURITY.md](SECURITY.md) — incident response, environment separation (BR-11)
- [OBSERVABILITY.md](OBSERVABILITY.md) — alarms that detect the need for recovery
- [AWS_ARCHITECTURE.md](AWS_ARCHITECTURE.md) — infrastructure + Supabase cost assumptions
- [adr/ADR-002-database.md](adr/ADR-002-database.md) — managed backups as a reason for RDS (hosting superseded by ADR-005)
- [adr/ADR-005-supabase.md](adr/ADR-005-supabase.md) — Supabase platform decision (database + auth)
