# SmartHomeAI — Test Suite

Vitest 3 (`vitest.config.ts`: node environment, `globals: false` — tests import from `vitest`).

## How to run

```bash
npm test          # unit + integration + ai-evaluation (vitest run)
npm run test:watch
npm run test:ai   # only tests/ai-evaluation (AI evaluation suite, CI/mock mode)
```

Integration tests are guarded and inert by default. To enable them:

```bash
IT_PG=1 DATABASE_URL=postgresql://user:pass@host:5432/smarthomeai npm test
```

> **No test result is claimed here that has not actually been executed.**
> This file describes intent and structure only; passing runs are recorded by the
> engine/CI that actually executes them, never asserted in advance.

## What is covered

| Area | File(s) | Covers |
|---|---|---|
| Location rules | `tests/unit/rules/locations.test.ts` | BR-04 depth cap (≤ 3), name normalization, cycle guard, BR-05 archive guard |
| Item rules | `tests/unit/rules/items.test.ts` | BR-03 duplicate-name warning, BR-07 30-day restore window (incl. exact boundaries), status projection |
| Event rules | `tests/unit/rules/events.test.ts` | occurredAt future-skew, last-recorded-location derivation + tie-break determinism, FR-008 caveat wording |
| Retention rules | `tests/unit/rules/retention.test.ts` | BR-02 24 h pending-action expiry, BR-07 30-day purge, BR-08 7-day grace + 365-day audit constant |
| Grounding | `tests/unit/assistant/grounding.test.ts` | FR-010: citation stripping, fabricated-fact rejection, empty/invalid shape, 1200-char truncation, caveat check |
| Prompts | `tests/unit/assistant/prompts.test.ts` | Classification/generation prompt contracts, escaping (S-3), record block bounds (FR-007) |
| LLM retry | `tests/unit/llm/retry.test.ts` | FR-013 `shouldRetry`/`backoffMs`/`LlmHttpError` |
| Mock provider | `tests/unit/llm/mock-provider.test.ts` | Default handler classification heuristics, schema-safe output, call recording |
| Errors | `tests/unit/errors.test.ts` | API error envelope mapping, requestId echo, no stack/message leakage |
| Validation | `tests/unit/validation/schemas.test.ts` | Request schemas: bounds, coercion, defaults, error paths |
| Rate limit | `tests/unit/rate-limit/rate-limit.test.ts` | BR-12 buckets (120 reads/min, 20 assistant/min, daily cap), per-user/per-class isolation, env-driven caps |
| Pipeline schemas | `tests/unit/pipeline-structures/pending-action.test.ts` | FR-024 `pendingActionSchema` + `classificationSchema` contracts |
| Append-only | `tests/unit/repositories/static-constraints.test.ts` | BR-06 static source scan: no `itemLocationEvent` mutations without `// APPEND-ONLY-EXEMPT` |
| AI evaluation | `tests/ai-evaluation/evaluation.test.ts` | All 34 cases from `docs/prompts/EVALUATION_CASES.md` via MockProvider; catalog-integrity check against the doc |
| Inventory CRUD | `tests/integration/inventory-crud.test.ts` | Guarded integration: CRUD + cross-user isolation + soft-delete visibility |

## What is pending (intentionally skipped — never fabricated)

- **Integration tests (T-020)** — require a reachable Postgres. Docker is **not installed**
  on the currently inspected machine, so `tests/integration/inventory-crud.test.ts` stays
  behind `IT_PG=1` and reports `describe.skip('inventory CRUD integration (enable: IT_PG=1 …)')`
  otherwise. No integration result exists until someone runs it against a real database.
- **E2E Playwright** — not written here; `tests/e2e/**` is excluded from the Vitest
  include patterns and has no runner yet.
- **Live Groq evaluation (T-056)** — `describe.skip('GROQ live evaluation (T-056 — requires
  GROQ_API_KEY + network)')` in `tests/ai-evaluation/evaluation.test.ts` lists every case's
  live assertions. They run against `GroqProvider` only when a run is actually wired up with
  `GROQ_API_KEY`; results are never fabricated (EVALUATION_CASES.md §6).
- **Supabase Auth live run** — no hosted auth pool is exercised from this suite; auth
  behavior is covered only by schema/env unit tests until a live pool exists.

## Notes for implementers

- Tests import **only** from stable foundation modules (`src/server/rules/*`,
  `src/server/assistant/*`, `src/lib/*`) plus Zod schemas. They deliberately do **not**
  import `src/server/services/*` or route handlers — those APIs were in flux while the
  suite was written.
- Cases the deterministic `MockProvider` heuristic cannot classify as the doc expects are
  marked `it.skip('heuristic — covered by live run T-052')` with a comment stating the doc
  expectation vs the mock yield — they are neither weakened nor silently passed.
- The rate-limit tests encode the **specified** behavior (a fresh user starts with a full
  per-minute bucket). If they fail on the very first `consumeRate`, inspect the bucket
  seeding in `src/lib/rate-limit.ts` rather than the tests.
