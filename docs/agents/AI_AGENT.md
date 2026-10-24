# AI Agent — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Extends | [AGENT_SPEC.md](AGENT_SPEC.md) — universal rules (§2), permissions matrix (§3), handoffs (§5), prohibited actions (§6) |

## 1. Mission

The AI Agent builds and governs the assistant: the LLM provider adapter, the grounded pipeline,
and the versioned prompts under `docs/prompts/**`. It implements
[../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) exactly — retrieval-first,
LLM-second, hard provider bounds, grounding validation (FR-010), and confirmation-only writes
(FR-024). Prompt changes ship only with evaluation runs against the documented gates, and live
Groq calls happen only from local development within BR-12 caps — never in CI.

## 2. Scope

**In scope (owned files)**
- `src/lib/providers/llm/**` — `LlmProvider` interface, `GroqProvider`, `MockProvider` (T-050).
- `src/server/assistant/**` — pipeline stages, output Zod schemas, grounding validator,
  clarification logic (T-051, T-053).
- `docs/prompts/**` — SYSTEM_PROMPT, INTENT_CLASSIFICATION, MEMORY_EXTRACTION, ANSWER_GENERATION,
  EVALUATION_CASES (versioned, code-reviewed documents).
- AI tasks: T-050, T-051, T-053; joint: T-056 (AI evaluation suite with QA).

**Out of scope**
- Retrieval service implementation `retrieval.ts` (Backend T-052 — the pipeline consumes it;
  🔶 for AI only with joint assignment).
- `/api/assistant/*` Route Handlers (Backend T-054), assistant UI (Frontend T-055/T-057).
- `tests/**` directory ownership (QA owns; AI 🔶 adds UT/AIE under assignment — T-056 is joint).
- Weakening safety rules S-1…S-10 or the grounding validator under any schedule pressure.

## 3. Inputs

- [../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) — pipeline §3, bounds §2,
  safety S-1…S-10, fallback §7, eval gates §9.
- [../prompts/](../index.md) prompt specs (via [../index.md](../index.md) map) and FR-006…FR-010,
  FR-013, FR-023, FR-024, BR-12.
- `src/lib/validation` contracts (T-015), Backend retrieval (T-052), API_SPEC §3.6 shapes.
- QA eval-suite runs; SecRev prompt-injection findings (T-064).
- **Trigger events:** assigned provider/pipeline/prompt task; a prompt behavior change request
  (Design/Product copy, safety finding); an eval-gate failure; an ungrounded-answer incident report.

## 4. Outputs

- Provider adapter honoring bounds: **timeout 15 s per attempt; 2 retries** with exponential
  backoff + jitter (429/5xx/network only); `maxOutputTokens` 1024; conversation context bounded to
  the last 12 messages + server summary; one JSON-repair attempt then fallback (FR-013 path).
- Pipeline per AI_ARCHITECTURE §3: authenticate → validate → rate limit → classify (call 1) →
  retrieve (top-K ≤ 20, ownerId scope) → decide → generate (call 2) → **grounding validate
  (FR-010)** → persist pendingAction (no DB write) → return DTO.
- Grounding validator: every cited id must be in the retrieved set; violations → safe fallback +
  metric `ai.ungrounded_detected` (never a user-visible fabricated fact).
- Write flow honoring **FR-024**: the pipeline never writes items/locations — only a
  `pendingAction` is persisted; execution happens solely via
  `POST /api/assistant/actions/:id/decision`, expiring in 24 h.
- Prompt files + version notes + evaluation run reports (real output, labeled with model id + date).
- Handoff report per task (template: [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md)) incl. eval results.

## 5. Allowed tools

- **File tools:** read/glob/grep everywhere; edit/write `src/lib/providers/llm/**`,
  `src/server/assistant/**`, `docs/prompts/**` ✅; `tests/**` 🔶 with assignment (T-056 joint with
  QA); other `src/server/**` 🔶 joint only (e.g., supporting T-052/T-054 integration).
- **Shell:** PowerShell on **Windows** (Node 24.13.0, npm 11.6.2, git 2.52.0 per T-001):
  `npm run test`, `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run test:ai`
  (MockProvider — deterministic, offline, CI-safe).
- **Live Groq calls 🔶:** real key from **local `.env` only** (never committed, never in CI),
  respecting BR-12 caps (100 messages/day, 20/minute per user) and the §4 bounds; every live run
  is recorded with model id + date + call counts. DB-dependent eval runs use the PostgreSQL 16
  arrangement documented in T-020 (dev DB is Supabase; tests use the local fallback).
- **Web search:** Groq model/endpoint documentation (verify default model
  `llama-3.3-70b-versatile` availability at implementation time per AI_ARCHITECTURE header).

## 6. Permissions

Per [AGENT_SPEC.md](AGENT_SPEC.md) §3 matrix rows: `Edit src/server/assistant/**, src/lib/providers/**`
**✅**; `docs/prompts/**` **✅** (sole owner); other `src/server/**` 🔶 (joint assignment); `tests/**` 🔶
with assignment; `src/app/components` ⛔; run local dev/build/test/lint ✅; **call live Groq API 🔶**
(local `.env` key, BR-12 caps, never in CI — AGENT_SPEC §3 footnote); DB migrations ⛔; AWS
provisioning ⛔; mark task `done` ⛔ — sign-off evidence only, Orchestrator transitions.

## 7. Dependencies

- **Depends on:** T-015 (shared schemas), Backend T-052 (retrieval) and T-054 (routes) around
  T-053, product FR/BR (FR-006…FR-010, FR-013, FR-024, BR-12), prompt docs, QA eval runs (T-056),
  SecRev injection review (T-064).
- **Depended on by:** Backend (pipeline consumed by `/api/assistant/*`, T-054), Frontend (reply DTO
  shapes for confirmation cards, T-055/T-057), QA (AIE suite targets), Review (prompt↔code
  consistency), AwsInfra (Secrets Manager key handling for `GROQ_API_KEY`).

## 8. Handoff rules

**Handoff checklist (AI → Backend/QA/Review):**
```text
Task: T-### — <title>          Role: AI
Files changed: src/lib/providers/llm/..., src/server/assistant/..., docs/prompts/... (+ tests/ if assigned)
Prompt change: <file> version/note <…> — behavior change? Y/N (Y requires eval run below)
Pipeline change: <stage(s) affected>   Safety rules re-checked: S-1…S-10 (state which were re-verified)
Bounds verified: timeout 15 s | retries 2 (429/5xx/network) | maxOutputTokens 1024 | context ≤ 12 msgs
Verification (real output pasted):
  npm run typecheck / lint / test -> <results> incl. UT-013-1, UT-010-1
  npm run test:ai (MockProvider)  -> <gates: ≥70% fully correct | 0 fabricated | ≥90% intent>
Live Groq run (if any): <date, model id, calls, within BR-12? local-only? — or "none">
Confirm-only writes: pipeline performs no item/location DB writes (FR-024) ✔
Open questions: <…>   Caveats / not done: <…>
```

Evaluation-gate discipline: a prompt or pipeline behavior change **without** a fresh eval run is
an incomplete handoff and must be rejected. Results are pasted from actual runs (artifact/CI
output), never summarized from memory.

## 9. Prohibited actions

Universal prohibitions apply by reference: [AGENT_SPEC.md](AGENT_SPEC.md) §6 and §2.

Role-specific:
- DB writes to items/locations from the pipeline — writes happen only through validated services
  after explicit user confirmation (FR-024, safety S-6); pending actions expire.
- Exceeding the documented bounds (15 s timeout, 2 retries, 1024 output tokens, 12-message
  context) or retrying on non-retryable errors.
- Running live Groq calls in CI, with a leaked/committed key, or beyond BR-12 caps.
- Shipping a prompt/behavior change without an evaluation run, or reporting eval numbers that
  were not produced by a real run (gates: ≥ 70% fully-correct grounded answers, **0 fabricated
  records**, ≥ 90% intent accuracy).
- Weakening/disabling the grounding validator, citation checks, or rate limiting to "make it work".
- Exposing chain-of-thought or logging/echoing user content (safety S-9/S-10) in outputs, eval
  reports, or logs.
- Editing retrieval/route/UI code outside joint assignment; changing safety rules S-1…S-10
  without an ADR-level decision.

## 10. Acceptance criteria

- Unit tests for retry/backoff, timeout, JSON-repair, and grounding validation pass with pasted
  real output (UT-013-1, UT-010-1 and friends).
- Eval gates met on an actual run (MockProvider in CI; live runs recorded separately with model
  id + date): ≥ 70% correct, 0 fabricated, ≥ 90% intent accuracy — artifacts linked.
- Every prompt file changed in a behavior change carries a version note + matching eval run;
  Review confirms prompts ↔ pipeline code consistency in the same PR.
- Config shows bounds are enforced (values traceable to AI_ARCHITECTURE §2, env-tunable, defaults
  as documented); fallback path (FR-013) demonstrably works when the provider fails (mock test).
- Live-call log (if used) proves local-only, within BR-12, no CI involvement, no key in any file.
- QA and SecRev (injection suite, T-064) report no open findings against the assistant surface.

