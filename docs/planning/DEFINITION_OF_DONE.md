# Definition of Done — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Orchestrator (enforcement) · Review agent (verification) · roles: [../agents/AGENT_SPEC.md](../agents/AGENT_SPEC.md) |
| Scope | (a) documentation phase · (b) per task · (c) per phase · (d) release · (e) role addenda · (f) anti-patterns |
| Authority | [../product/PRD.md](../product/PRD.md) §17 (release) · [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §5 (phase) · [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) header rule (task) |

**Ground rule ([../index.md §6](../index.md) #3):** nothing is "done" unless it actually ran
and the result is recorded.

---

## (a) Documentation-phase DoD — status as of 2026-10-15

Checklist for Phases 0–1 (the phase this repository is in). **Only items with recorded
evidence may be checked.**

- [x] **Repository & toolchain inspected and recorded** (T-001, *done 2026-10-15*): Windows,
      Node 24.13.0, npm 11.6.2, git 2.52.0, Python 3.13.7 — and **Docker NOT installed**
      (drives the T-020 native-PostgreSQL fallback and risk R-08).
- [x] **`prisma validate` on `prisma/schema.prisma` — PASSED (Prisma CLI 6.19.3,
      2026-10-15).** Evidence: recorded result cited in [TASK_BREAKDOWN.md §4](TASK_BREAKDOWN.md)
      (schema validation only — it is not a test run).
- [x] **Relative Markdown link + structure validation — PASSED.** Orchestrator-run output
      recorded: `node tools/validate-docs.mjs` → **ALL CHECKS PASSED** — 62 files, 711 relative
      links, 23 Mermaid blocks, 30 FRs (18 P0), 52 AC refs, 29 US refs, 0 failures
      (runs 2026-10-17 23:46 and 2026-10-22; full evidence rows in
      [TASK_BREAKDOWN.md §4](TASK_BREAKDOWN.md)).
- [x] **Document-map parity — VERIFIED 2026-10-22.** All 61 documents linked in
      [../index.md §2](../index.md) exist on disk (programmatic existence check of every §2
      link: 61/61 present, 0 missing). The 2026-10-15 gap (agent role docs + `docs/prompts/*`)
      was closed by the T-003 documentation sweep.
- [x] **Traceability has no P0 gaps:** 19/19 P0 FRs map to US, AC, API/DB, tasks, and test IDs
      (per [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) gap analysis; test IDs
      cross-checked against [../requirements/FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md)
      2026-10-15). Re-verify at T-003.
- [x] **ID-convention audit (T-003, closed 2026-10-22):** prefixes follow
      [../index.md §3](../index.md) (`FR/AC/US/BR/T/M/R/UT·IT·E2E·AIE`); FR/AC/US IDs are
      machine-validated by `tools/validate-docs.mjs` (30/52/29, all defined). Risk IDs are
      two-digit `R-##` with R-01…R-07 keeping PRD §16 semantics — a full-repo scan found 9
      genuine three-digit drifts (`R-003`-style) left by the competing-draft numbering; all 9
      corrected to canonical IDs (`R-007`→`R-03`, `R-011`→`R-08`, `R-010`→`R-11`,
      `R-012`→`R-10`, `R-002`→`R-09`) in ADR-002/003/004 + SECURITY.md. Deliberate historical
      annotations (CONTRACT.md mapping, RISKS.md §ID notes, AWS_ARCHITECTURE "historical
      `R-010`" note) left intact. No reused/renumbered IDs remain.
- [x] **T-003 cross-consistency review:** findings F-1…F-8 produced and every finding resolved
      or explicitly deferred with rationale — recorded in
      [TASK_BREAKDOWN.md §4](TASK_BREAKDOWN.md) (2026-10-17); post-fix validator runs green.
- [x] **`docs/CONTRACT.md` adjudicated** — 2026-10-17 (T-003): the **index-rooted set is
      authoritative**; CONTRACT.md retained as Adjudication Record + D-OPEN register with
      every registry section marked SUPERSEDED (see [../CONTRACT.md §0](../CONTRACT.md) and
      risk R-12 "mitigated"). *Human stakeholder sign-off of the outcome = T-004, still open.*
- [ ] **T-004 stakeholder approval** of PRD, ADRs, and cost model (incl. C-4 budget
      acceptance) recorded in CHANGELOG.
- [ ] **T-005** agent roles/permissions countersigned ([../agents/AGENT_SPEC.md](../agents/AGENT_SPEC.md) §7).
- [ ] **T-006** docs versioned to v1.0.0 + CHANGELOG entry.
- [ ] **License decision recorded** (risk R-15) — LICENSE file + README statement.
- [ ] **Every dollar figure labeled:** assumption + region (`us-east-1`) + research basis
      (2026-09/10) + "verify at purchase" — spot-checked across
      [COST_ESTIMATION.md](COST_ESTIMATION.md), [../architecture/AWS_ARCHITECTURE.md](../architecture/AWS_ARCHITECTURE.md),
      [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md).
- [ ] **No fabricated evidence in the set:** no test results, deployments, cloud resources, or
      measured costs claimed anywhere (all such values must be marked pending/assumption).

---

## (b) Per-task DoD

A `T-###` task is `done` **only when all boxes are checked and the evidence is linked**:

- [ ] **Implemented** against its FR(s)/AC/API contract/DB schema as cited in the task row.
- [ ] **Tests added** at the level [TEST_PLAN.md](TEST_PLAN.md) requires (every API endpoint:
      ≥ 1 happy-path + ≥ 1 negative `IT`; new logic: `UT`; user flow: `E2E`; AI behavior: `AIE`)
      — and the IDs registered in TEST_PLAN's catalog.
- [ ] **Verification commands run with real output** (TASK_BREAKDOWN "Verification" column)
      pasted into the PR/task evidence. No "should pass", no copied expected output.
- [ ] **Docs updated in the same change** — behavior/schema/API change and its document travel
      in one PR (IMPLEMENTATION_PLAN §2.4); new tests/IDs added to TEST_PLAN/TRACEABILITY.
- [ ] **No lint / typecheck errors; no skipped or `.only` tests**; new dependencies justified
      by a documented requirement (index §6.5).
- [ ] **Security defaults respected:** no secrets in git (`.env.example` placeholders only),
      `ownerId` only from the verified token, server-side authorization for every new endpoint,
      log redaction for anything user-content-adjacent.
- [ ] **Review approved** (Review agent) with zero blocking findings.
- [ ] **Status flipped by the Orchestrator only after the above** (TASK_BREAKDOWN header rule).

---

## (c) Per-phase DoD

- [ ] **All tasks in the phase** are `done` with evidence per (b).
- [ ] **Phase exit criteria met** (IMPLEMENTATION_PLAN §1):

| Phase | Exit criterion (restated) |
|---|---|
| 2 | `npm run dev/build/lint/typecheck/test` all green in CI on the scaffold |
| 3 | Signup→login→session works against local Postgres; migrations + search SQL applied; authz middleware proven |
| 4 | Full item/location/event flows usable in UI; ownership-matrix tests green |
| 5 | Dashboard, inventory table, deterministic search usable and tested |
| 6 | Assistant round-trips + confirmations + fallback + eval suite gates green |
| 7 | Security gate passed; coverage/risk targets met; logging/metrics live |
| 8 | Staging smoke recorded, restore drill done, release checklist signed |

- [ ] **Full regression suite green** (unit + integration + e2e + AIE/MockProvider —
      [TEST_PLAN.md §8](TEST_PLAN.md)).
- [ ] **No open blocking review findings**; no quarantined/flaky tests outstanding
      ([TEST_PLAN.md §7](TEST_PLAN.md)).
- [ ] **Traceability re-checked** for the phase's FRs (gate G-3, zero gaps for P0).
- [ ] **Risk register reviewed** at the milestone exit — statuses updated with evidence
      ([RISKS.md §3](RISKS.md)); risk checkpoints answered, not skipped
      ([MILESTONES.md §9](MILESTONES.md)).

---

## (d) Release DoD — PRD §17 restated as an actionable checklist

| # | Release criterion (PRD §17) | Evidence to record | Owner / task | Status |
|---|---|---|---|---|
| 1 | All P0 FRs implemented with passing `AC-` criteria recorded in test results | Test report mapping `AC-###-#` → executed test output | QA + roles, T-065 | [ ] pending |
| 2 | Every P0 FR mapped to ≥ 1 automated test per [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) | Traceability run: 19/19 P0 rows with executed test references | QA, T-065 | [ ] pending |
| 3 | Security review gate passed (authz matrix, secrets scan, injection/XSS/CSRF, prompt-injection tests) | Findings report + verdict, zero open high/critical | SecRev, T-064 | [ ] pending |
| 4 | AI evaluation suite run: **≥ 70% correct, 0% fabricated**, results recorded | `npm run test:ai` output **+ committed live-Groq run report** | AI + QA, T-056 | [ ] pending |
| 5 | Production build passes CI (lint, types, tests, build) | CI run reference on `main` (pipeline T-012) | AwsInfra, T-012/T-075 | [ ] pending |
| 6 | Staging deploy + smoke test (auth → item → event → search → assistant) recorded | Smoke report file in repo from a **real staging run** | AwsInfra + QA, T-072 | [ ] pending |
| 7 | Backup configured; one restore drill executed and documented | T-073 drill report: timestamps, **measured RTO/RPO**, findings (RTO ≤ 4 h / RPO ≤ 24 h targets) | AwsInfra, T-073 | [ ] pending |
| 8 | Budget alarms active; COST_ESTIMATION assumptions updated with actuals | Alarm configuration evidence + updated cost doc with an "Actual (measured)" column | AwsInfra, T-074 | [ ] pending |
| 9 | CHANGELOG updated; DoD checklists complete | CHANGELOG v1.0.0 entry + this document all sections checked with evidence | Orch + Human, T-075 | [ ] pending |

Production deploy itself requires **human approval** (T-075); a staging smoke failure blocks
release regardless of schedule (risk checkpoint T-072).

---

## (e) Role-specific DoD addenda

On top of (b), each role's handoff additionally requires:

| Role | Extra "done" conditions |
|---|---|
| **Backend** | An **authorization-matrix test exists (and is updated) for every new endpoint** — IT-012-1 covers it; `ownerId` derived only from the verified token; Zod validation with the standard error envelope; migrations expand-contract only |
| **AI** | **Eval gates run** for the change (CI MockProvider AIE suite green; live run when prompt/model behavior changes); prompts updated from the prompt docs in the same change; grounding validator + fallback covered; **no live keys in CI** |
| **AwsInfra** | **`cdk diff` reviewed line-by-line** (naming/tags per AWS_ARCHITECTURE §5, no public DB endpoint, no undocumented services) **and the cost doc updated** ([COST_ESTIMATION.md](COST_ESTIMATION.md): new/changed assumptions labeled, actuals where they exist); budget alarms intact |
| **Docs** | **Relative links validated with recorded output**; IDs follow [../index.md §3](../index.md); document-map parity holds; header table (Version/Status/Date) present; no checked box without evidence |
| **Frontend** | Loading/error/empty states implemented per AC; keyboard/contrast spot-checks per design docs; the flow's `E2E` test exists and runs in CI |
| **QA** | Suites green and recorded; coverage report vs G-1/G-2 produced; flaky triage updated; traceability cross-check done |
| **SecRev** | Threat-model deltas reviewed; no open high/critical findings; prompt-injection cases added for new AI surfaces |

Roles not listed follow (b) plus their [../agents/AGENT_SPEC.md](../agents/AGENT_SPEC.md) §4
outputs — a handoff the downstream role rejects counts as **not done**.

---

## (f) Anti-patterns (explicitly forbidden)

1. **Marking done without evidence** — a task/test/deploy flagged complete with no recorded
   command output, report, or signed note ([../index.md §6](../index.md) #3).
2. **Claiming unrun tests** — "should pass", pasting expected output, or citing a test ID as
   green because it was written. Written ≠ executed.
3. **Documentation drift** — behavior/schema/API changed without its document changed in the
   same PR (or a doc changed with no corresponding code), leaving
   [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) or contracts stale.
4. **Scope additions without FR updates** — new features, services, or dependencies smuggled in
   without an FR/PRD version bump (PRD §8.2, index §6.5–6.6; risk R-07).
5. **ID hygiene violations** — reusing/renumbering retired IDs, inventing prefixes outside
   [../index.md §3](../index.md), or using 3-digit `R-0xx` risk IDs.
6. **Citing `docs/CONTRACT.md` as authority** before T-003 adjudicates it — the set rooted in
   the index governs until a human decides otherwise ([../index.md §5](../index.md) item 4).
7. **Ticking §a's link-validation (or any checklist) without pasting the actual result** —
   including this document's own pending items.
8. **Recording estimates as measurements** — restore times, RTO/RPO, coverage, latencies, or
   dollar figures presented as measured when they are assumptions or projections.
9. **Committing real secrets** or putting live LLM keys in CI ([../index.md §6](../index.md) #4).

## Related documents

- [../product/PRD.md](../product/PRD.md) §17 — release criteria source
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) §1/§4/§5 — phase exits and risk checkpoints
- [TASK_BREAKDOWN.md](TASK_BREAKDOWN.md) — per-task verification commands and status rules
- [TEST_PLAN.md](TEST_PLAN.md) — suites, gates, evidence formats
- [RISKS.md](RISKS.md) — register reviewed at every phase/milestone exit
- [MILESTONES.md](MILESTONES.md) — milestone exit criteria that consume these checklists
