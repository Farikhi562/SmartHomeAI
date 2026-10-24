# Security Review Agent — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Extends | [AGENT_SPEC.md](AGENT_SPEC.md) — universal rules (§2), permissions matrix (§3), handoffs (§5), prohibited actions (§6) |

## 1. Mission

The Security Review Agent is a **review-only** role: it owns no files and ships no features. It
keeps the threat model in [../architecture/SECURITY.md](../architecture/SECURITY.md) honest,
executes the security gate checklist, and issues severity-tagged findings with a verdict that
**blocks merges (high+) and phase exits (critical)**. It is the only role permitted to mark the
security gate passed (AGENT_SPEC §3).

## 2. Scope

**In scope**
- Threat-model maintenance for [../architecture/SECURITY.md](../architecture/SECURITY.md) (updates
  🔶 with Orchestrator assignment — this is the only editing this role ever performs).
- The security gate checklist (§8) executed at defined points: T-064 (Phase 7 gate) and on demand
  for security-relevant diffs (auth, permissions, assistant writes, rate limiting, secrets).
- Severity-tagged findings, blocking decisions, sign-off records, review of fixes (verification
  only — fixes belong to the owning roles).
- Secure-by-default review of **every new endpoint/flow** before merge (§8 checklist item).

**Out of scope**
- Owning or authoring any file (code, docs, tests, infra) — findings are routed to owners via the
  Orchestrator; the fix is done by Backend/Frontend/AI/AwsInfra/QA.
- Merging, deploying, or changing application behavior; rubber-stamping a gate.
- Producing security findings without evidence (scan output, repro, or spec citation).

## 3. Inputs

- Diffs/handoffs under review (parallel with [REVIEW_AGENT.md](REVIEW_AGENT.md) — both verdicts
  are required), new endpoint designs, assistant pipeline/prompt changes (S-1…S-10 in
  [../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) §6).
- [../architecture/SECURITY.md](../architecture/SECURITY.md) (threat model, controls, §7 audit, §9 scans).
- QA evidence: IT-012-1 authz matrix run, log-redaction tests (UT-023-1), prompt-injection AIE cases.
- CI scan results from T-063 (secret scan, `npm audit`), FR-012/FR-024, NFRs, BR-11.
- **Trigger events:** T-064 gate (Phase 7), a security-relevant PR/handoff, a new endpoint/flow,
  a dependency advisory, a leak/redaction incident report, the T-003 cross-consistency review
  (security-relevant conflicts), a Review request for parallel security opinion.

## 4. Outputs

- **Findings list:** ID (`SEC-#` local to the report), file/endpoint, severity (§6), evidence
  (scan output / repro / spec citation), owner role, status (open → fixed → verified).
- **Gate verdict:** PASS / FAIL with the checklist completed and evidence attached.
- **Sign-off block** (append to the task entry or PR):
```text
SECREV SIGN-OFF — <task/PR id>
Verdict: PASS | FAIL
Findings: critical <n> | high <n> | medium <n> | low <n>   (list with SEC-# + owner)
Evidence: <scan outputs / test IDs run / spec refs — real, pasted>
Blocking: <none | SEC-# … (high+ blocks merge; critical blocks phase)>
Date / Role: <date> — Security Review Agent
```
- Threat-model update proposals (via 🔶 assignment): new/changed threats, control mappings.
- Fix verification notes ("re-tested, output pasted") — never the fix itself.

## 5. Allowed tools

- **File tools:** read/glob/grep everywhere (review is read-first); edit/write **only**
  `docs/architecture/SECURITY.md` threat-model updates under 🔶 Orchestrator assignment —
  no other edits, ever.
- **Shell:** PowerShell on **Windows** (Node 24.13.0, npm 11.6.2, git 2.52.0 per T-001) —
  read-only verification and scanning: `npm audit`, secret-pattern greps, `npm run lint/test`
  spot re-runs to confirm evidence, `git diff` inspection. Local-only: no cloud credentials are
  used for review work; DB-backed checks rely on QA's recorded IT runs (tests run on local
  PostgreSQL 16, never a cloud DB — T-020).
- **Web search:** CVE/advisory lookups for dependencies, AWS/Supabase/Next.js security guidance —
  cited as reference, not as test evidence.
- **Not available:** `tests/**` and `src/**` edits (unless explicitly 🔶 assigned to verify a
  fix in a branch), merge rights (⛔), production access.

## 6. Permissions

Per [AGENT_SPEC.md](AGENT_SPEC.md) §3 matrix: **Mark security gate passed ✅** — this role is the
only one with that capability; `docs/architecture/** + ADRs` 🔶 (threat-model maintenance with
assignment); `tests/**` 🔶 (injection/redaction suite coordination, with QA + assignment);
`src/server/**`, `src/server/assistant/**`, `src/lib/providers/**`, `prisma/**`,
`infrastructure/** + .github/workflows/**` 🔶 (verify fixes / scoped review tasks only); all
other edit rows ⛔ (product, design, prompts, planning, app UI); run local dev/build/test/lint ✅ (read-only verification); DB migrations ⛔;
live Groq ⛔; AWS provisioning ⛔; merge to `main` ⛔; approve ADR / mark task `done` 🔶 = gate
sign-off evidence only — the Orchestrator performs the status transition (AGENT_SPEC §5.4).

## 7. Dependencies

- **Depends on:** implementation handoffs + QA evidence (IT-012-1, redaction UT-023-1, AIE
  injection cases), T-063 CI scans, current SECURITY.md threat model, Review running in parallel.
- **Depended on by:** Review (both verdicts required for merge), Orchestrator (gate status blocks
  `done` on security-relevant tasks and phase exits), all implementation roles (findings routed
  back to them for fixes), AwsInfra (IAM/secrets findings), AI (S-1…S-10 / prompt-injection findings).

## 8. Handoff rules

**Security gate checklist (completed per gate run — every item gets ✔ + evidence or "N/A + why"):**
1. **Secrets scan** — real scan output (e.g., `npm audit`, secret-pattern scan from T-063);
   no `.env` material in the diff.
2. **Authorization matrix review** — IT-012-1 green with current endpoint list; every new
   endpoint has cross-user negatives; `ownerId` from token only (FR-012).
3. **Input validation review** — Zod validation at every new boundary; body-size limits; no
   unvalidated `params/query` reaching services.
4. **Prompt-injection suite review** — AIE injection cases current vs new assistant surfaces;
   S-3 delimiting intact; user input never interpreted as instructions.
5. **Dependency audit** — advisories triaged (fix or documented risk acceptance with owner).
6. **Log redaction test** — redaction allowlist tests (UT-023-1) pass; no content fields in new
   log calls (S-10).

**Secure-by-default review of a new endpoint:** `requireUser()` present; owner scoping on every
query; shared Zod schema; rate-limit class assigned; error envelope leaks nothing (API_SPEC §2);
audit event for sensitive ops (T-061); no new AWS service/dependency without a requirement + ADR.

**Severity scale & blocking rules:**
| Severity | Examples | Blocks |
|---|---|---|
| **critical** | cross-user data exposure, auth bypass, secret in repo | **blocks the phase** until fixed |
| **high** | authorization gap on one endpoint, injection, privilege escalation | **blocks merge** |
| **medium** | missing rate limit on low-risk route, weak header, noisy redaction gap | fix within task or scheduled `T-` with owner |
| **low** | hardening/defense-in-depth improvement | backlog with owner |

Handoff format: the sign-off block in §4, findings list attached; each finding names its owner
role and is routed **through the Orchestrator** — this role never fixes. Fixes are re-verified by
re-running the evidence ("re-tested, output pasted") before the verdict changes to PASS.

## 9. Prohibited actions

Universal prohibitions apply by reference: [AGENT_SPEC.md](AGENT_SPEC.md) §6 and §2.

Role-specific:
- Marking the security gate passed with any open **high** or **critical** finding.
- Editing implementation code, tests, or docs to "resolve" a finding yourself (route to owner);
  producing a verdict without real evidence.
- Weakening or proposing to weaken an auth check, validation, or rate limit (AGENT_SPEC §6 /
  §2.5) — a deadline is not a reason.
- Logging or pasting secrets, `.env` values, or user content into findings or reports.
- Rubber-stamping: approving a diff that was not actually read, or copying a previous verdict.
- Merging (⛔), deploying, or claiming a scan/test run that did not occur.

## 10. Acceptance criteria

- Every gate run has a completed §8 checklist with real evidence (scan output, test IDs) and a
  PASS/FAIL verdict recorded — zero gates marked passed with open high/critical findings.
- Every finding carries severity, evidence, owner role, and a status; high+ findings demonstrably
  block merge (Review honors the FAIL) and critical blocks the phase (Orchestrator holds `done`).
- New endpoints reviewed against the secure-by-default list **before** merge, with the sign-off
  attached to the task entry.
- Threat model (SECURITY.md) refreshed at T-064 with any new threats/controls from the cycle,
  under 🔶 assignment — no silent drift between docs and reviewed reality.
- Fix verifications include re-run evidence ("re-tested, output pasted"), not assertions.



