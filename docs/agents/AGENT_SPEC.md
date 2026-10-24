# Agent Specification — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Purpose | Defines the AI coding-agent roles that build and maintain SmartHomeAI: missions, scopes, permissions, handoffs, and hard rules |

---

## 1. Agent model

SmartHomeAI is developed by a team of specialized agents (which may be human developers or
AI coding agents). Each role has a **narrow mission**, **explicit permissions**, and
**mandatory handoffs**. Role documents live next to this file:

| Role | Document |
|---|---|
| Orchestrator | [ORCHESTRATOR_AGENT.md](ORCHESTRATOR_AGENT.md) |
| Product | [PRODUCT_AGENT.md](PRODUCT_AGENT.md) |
| Design | [DESIGN_AGENT.md](DESIGN_AGENT.md) |
| Frontend | [FRONTEND_AGENT.md](FRONTEND_AGENT.md) |
| Backend | [BACKEND_AGENT.md](BACKEND_AGENT.md) |
| AI | [AI_AGENT.md](AI_AGENT.md) |
| AWS Infrastructure | [AWS_INFRA_AGENT.md](AWS_INFRA_AGENT.md) |
| QA | [QA_AGENT.md](QA_AGENT.md) |
| Security Review | [SECURITY_REVIEW_AGENT.md](SECURITY_REVIEW_AGENT.md) |
| Review | [REVIEW_AGENT.md](REVIEW_AGENT.md) |

Coordination mechanics: [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).
Code conventions: [CODING_STANDARDS.md](CODING_STANDARDS.md).
Task source of truth: [planning/TASK_BREAKDOWN.md](../planning/TASK_BREAKDOWN.md).

## 2. Universal rules (all agents, no exceptions)

1. **Truthfulness.** Never claim a test ran, a deploy happened, a file changed, or a check
   passed unless it actually did — cite the real command output or link the artifact.
   "Not verified" is a valid and required status.
2. **Documentation is the contract.** Behavior changes start with a documentation change
   (docs → code, never code → silent docs drift). If reality must diverge, update the doc
   in the same change and note the deviation.
3. **Stable IDs.** Reference `FR-/NFR-/BR-/AC-/US-/T-/ADR-` IDs exactly; never renumber.
4. **Scope discipline.** Implement only tasks assigned to your role. New ideas → report to
   Orchestrator → Product triages into P1/P2 backlog. No scope creep.
5. **Security defaults.** Never weaken an auth check, log content, or commit a secret to
   make something "temporarily" work.
6. **Minimal diffs.** Preserve existing work; no reformatting unrelated code; follow
   CODING_STANDARDS.md.
7. **Small units of work.** One task (or tightly related task cluster) per handoff; keep
   diffs reviewable.
8. **Evidence-based completion.** A task is "done" only when its verification commands
   pass and the result is recorded in the task entry.

## 3. Permissions matrix

Legend: ✅ allowed · ⛔ prohibited · 🔶 allowed with review/confirmation

| Capability | Orch | Prod | Design | Front | Back | AI | AwsInfra | QA | SecRev | Review |
|---|---|---|---|---|---|---|---|---|---|---|
| Read repo (all files) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit `docs/product/**`, `docs/requirements/**` | 🔶 | ✅ | 🔶 | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | ⛔ | 🔶 |
| Edit `docs/design/**` | 🔶 | 🔶 | ✅ | 🔶 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 |
| Edit `docs/architecture/**` + ADRs | 🔶 | ⛔ | ⛔ | ⛔ | 🔶 | 🔶 | 🔶 | ⛔ | 🔶 | 🔶 |
| Edit `docs/prompts/**` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | 🔶 | ⛔ | 🔶 |
| Edit `docs/planning/**` | ✅ | 🔶 | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | 🔶 | ⛔ | 🔶 |
| Edit `src/app/**`, `src/components/**`, `src/client/**` | ⛔ | ⛔ | 🔶 | ✅ | ⛔ | ⛔ | ⛔ | 🔶 | ⛔ | 🔶 |
| Edit `src/server/**`, `src/lib/validation/**` | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | 🔶 | ⛔ | 🔶 | 🔶 | 🔶 |
| Edit `src/server/assistant/**`, `src/lib/providers/**` | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | ✅ | ⛔ | 🔶 | 🔶 | 🔶 |
| Edit `prisma/**` | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | ⛔ | ⛔ | 🔶 | 🔶 | 🔶 |
| Edit `infrastructure/**`, `.github/workflows/**` | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | 🔶 | 🔶 |
| Edit `tests/**` | ⛔ | ⛔ | ⛔ | 🔶 | 🔶 | 🔶 | ⛔ | ✅ | 🔶 | 🔶 |
| Run local dev/build/test/lint commands | ✅ | ✅ | 🔶 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Run DB migrations against local dev DB | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ | ✅ | ⛔ | ⛔ |
| Modify DB schema (`schema.prisma` + migrations) | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | ⛔ | ⛔ | ⛔ | 🔶 | 🔶 |
| Call live Groq API (real key) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | ⛔ | ⛔ | ⛔ | ⛔ |
| Provision/change AWS resources | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | ⛔ | ⛔ | ⛔ |
| Approve ADR / mark task `done` | ✅ | 🔶 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 | 🔶 | 🔶 |
| Mark security gate passed | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ⛔ |
| Merge to `main` | 🔶 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | 🔶 |

- 🔶 = allowed only with Orchestrator assignment or passing Review/Security review.
- **AWS resource changes** (AwsInfra 🔶) always require a reviewed CDK diff + plan output
  attached to the task; production resources additionally require human approval.
- **Live Groq calls** (AI 🔶) require the dev key from local `.env`, respect BR-12 caps,
  and are never run in CI.

## 4. Inputs / outputs per role (summary — details in role docs)

| Role | Key inputs | Key outputs |
|---|---|---|
| Orchestrator | Docs index, task board, agent reports | Task assignments, updated task statuses, conflict resolutions |
| Product | PRD, user feedback, metrics | Updated PRD/stories/AC, scope decisions |
| Design | PRD, design system tokens | Page specs, tokens, wireframes, a11y states |
| Frontend | Design specs, API_SPEC, task | Pages/components/forms, UI tests |
| Backend | FRs, API_SPEC, schema | Services, repositories, endpoints, integration tests |
| AI | AI_ARCHITECTURE, prompts | Provider adapter, pipeline, eval suite results |
| AwsInfra | AWS_ARCHITECTURE, DEPLOYMENT | CDK constructs, pipelines, alarms, cost reports |
| QA | TEST_PLAN, ACs | Test code + real run results, coverage/quality reports |
| SecRev | SECURITY, threat model | Findings (severity-tagged), gate verdicts |
| Review | Everything in the diff | Review verdict, blocking issues list |

## 5. Handoff rules (summary — details in AGENT_WORKFLOW.md)

1. Work flows **Product → Design → Backend/Frontend/AI → QA → SecRev → Review → Orchestrator**.
2. A handoff includes: task ID(s), changed files, verification commands run + outcomes,
   open questions, and explicit "not done" caveats.
3. A downstream role may reject a handoff with concrete reasons; the Orchestrator routes
   it back. Rejection is normal, not failure.
4. Nobody marks a task `done` — Orchestrator does, and only with verification evidence
   and all required reviews attached.

## 6. Prohibited actions (all agents)

- Claiming completion, test results, or deployments that did not occur.
- Adding dependencies, AWS services, or architectural layers not traceable to a requirement.
- Reading or embedding `.env` files with real secrets into documents, code, or prompts.
- Exposing private chain-of-thought or logging/echoing user content in eval reports.
- Disabling or "temporarily" bypassing authorization, validation, or rate limiting.
- Modifying acceptance criteria to make failing code pass (Product owns criteria; changes
  require documented rationale).
- Using production data in non-production environments.

## 7. Acceptance criteria for this document

- [x] Every role in the matrix has a role document.
- [x] Every capability class (docs, code, infra, tests, merge, gates) has an explicit rule.
- [x] Universal rules cover truthfulness, scope, IDs, and security defaults.
- [ ] Roles reviewed and countersigned by a human owner before Phase 2 begins (tracked as T-005).
