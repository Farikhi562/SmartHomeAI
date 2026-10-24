# Contributing to SmartHomeAI

Thanks for contributing — whether you are a human developer or an AI coding agent. Both
follow the same rules.

## 1. Ground rules

1. **Documentation is the contract.** Behavior starts in `docs/` (PRD → FR/AC → design →
   architecture), then lands in code. If code must diverge, update the doc in the same
   change and note the deviation.
2. **Never fabricate results.** No task, test, or deployment is "done" without real,
   recorded command output. `not verified` is a valid and required status.
3. **Never commit secrets.** `.env` files are gitignored; only `.env.example` (placeholders)
   is committed. Real keys live in local env or AWS Secrets Manager.
4. **Stable IDs.** Reference `FR-/NFR-/BR-/AC-/US-/T-/ADR-` IDs exactly; never renumber
   or reuse them.
5. **Scope discipline.** P0 scope is frozen (PRD §8.1). New ideas → open an issue → Product
   triages into P1/P2.

## 2. Workflow

1. Pick a task from [docs/planning/TASK_BREAKDOWN.md](docs/planning/TASK_BREAKDOWN.md)
   (`T-###`); confirm its dependencies are satisfied.
2. Branch: `task/T-###-short-slug` from `main`.
3. Implement in small, reviewable units following
   [docs/agents/CODING_STANDARDS.md](docs/agents/CODING_STANDARDS.md).
4. Run the verification commands listed in the task. Paste real results into the PR.
5. Update any affected docs (schema/API/prompts/plan) in the same PR.
6. Open a PR; CI must pass (lint, typecheck, tests, `prisma validate`, build).
7. Review per [docs/agents/REVIEW_AGENT.md](docs/agents/REVIEW_AGENT.md); security-relevant
   changes also get a Security Review pass.
8. The Orchestrator marks the task `done` — contributors do not.

## 3. AI agent rules

Agents must read [docs/agents/AGENT_SPEC.md](docs/agents/AGENT_SPEC.md) first. The short
version: stay inside your role's permission column, hand off with evidence, never claim
unrun checks, never weaken auth/validation/logging to make something pass, and never edit
acceptance criteria to match failing code.

## 4. Code conventions (summary — full detail in CODING_STANDARDS.md)

- TypeScript strict; no `any` without a documented reason; Zod at every boundary.
- Layering: pages → route handlers → services → repositories → Prisma. No shortcuts.
- Server-side authorization on every protected operation; `ownerId` from the verified
  token, never from the request payload.
- Meaningful names, small functions, comments explain *why* not *what*.
- Tests sit next to the level they verify (`tests/unit`, `tests/integration`, `tests/e2e`,
  `tests/ai-evaluation`).

## 5. Commit and PR hygiene

- Conventional-ish commits: `feat(T-032): item CRUD API`, `docs(T-003): fix API_SPEC link`.
- One task (or tight cluster) per PR; no drive-by refactors.
- PR description includes: task ID, changes, verification commands + real output, doc
  updates, open questions.

## 6. Reporting problems

Found a spec inconsistency, a security concern, or a bug in a merged change? Open an issue
with: what doc/code says, what you expected, and (for security) impact + affected
FR/endpoint. Security issues get a private disclosure path before public detail (see
`docs/architecture/SECURITY.md` §11).
