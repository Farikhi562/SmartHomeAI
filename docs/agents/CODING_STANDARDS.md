# Coding Standards — SmartHomeAI

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Extends | [AGENT_SPEC.md](AGENT_SPEC.md) §2.6 (minimal diffs bind all roles); layering from [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) §2–§3 |

## 1. Mission

This document is the binding code convention set for every role that writes TypeScript,
configuration, SQL-adjacent code, or tests in this repository. It exists so reviews argue about
requirements, not tabs: style is decided once, layering is machine-enforced (ESLint import
boundaries), validation is Zod-first, errors and logs follow the API/observability contracts, and
security defaults are not negotiable. Deviations require a documented rationale in the change
itself — never silent divergence.

## 2. Scope

**In scope — normative rules (apply to `src/**`, `tests/**`, `infrastructure/**`, build/config files):**

- **TypeScript strict:** `strict: true`; no `implicit any`; no `!` non-null assertions without a
  stated reason next to it; prefer explicit narrowing over casts; `unknown` + Zod parse at
  boundaries; branded types for IDs optional (`type OwnerId = string & { __brand: "OwnerId" }`)
  — use them where they prevent owner mix-ups.
- **Naming:** `camelCase` functions/variables/hooks (`recordLocation`, `useInventory`);
  `PascalCase` components/types/enums/interfaces; kebab-case **files**
  (`location-tree-picker.tsx`, `search.repo.ts`) — Next.js built-ins (`route.ts`, `page.tsx`,
  `layout.tsx`) exempt; booleans read `is/has/can`; handlers `handleX`/`onX`; no abbreviations
  beyond established ones (`req/res` at handler edges only).
- **File organization:** per SYSTEM_ARCHITECTURE §3 — `src/app` (pages + `api/**` route handlers),
  `src/client`, `src/components`, `src/server/{services,assistant,rules,repositories}`,
  `src/lib/{auth,providers/llm,validation,observability,config}`; no dumping-ground utils folder —
  code lives in its layer; one module per domain concept.
- **Imports (boundaries, ESLint-enforced):** pages → `src/client` API functions → server services
  → repositories; calls point downward only; **no deep cross-layer imports** (pages never import
  repositories/Prisma; handlers never import repositories directly; assistant reaches providers
  only through the `LlmProvider` interface); no `../../` escapes across layers; type-only imports
  (`import type`) for types; relative imports within a layer, aliases (`@/`) across.
- **Zod-first validation:** shared schema in `src/lib/validation` is the single source of truth —
  parse at every boundary (route handler body/params/query, form submit, typed env loader); infer
  types with `z.infer` (never hand-written duplicate interfaces); client and server use the same
  schema; API responses validated in dev/test.
- **Error handling:** `ApiError` hierarchy → error envelope `{ error: { code, message, details?, requestId } }`
  (API_SPEC §2); unexpected errors → logged with `requestId` → generic 500 `INTERNAL` (no stacks,
  no provider text to clients); **no empty `catch`, no swallowed errors** — catch with a reason:
  rethrow, translate to envelope, or log + recover visibly; errors carry stable machine `code`s.
- **Logging:** structured JSON via `src/lib/observability`; **redaction allowlist** — only
  operational fields (requestId, route, status, latency, outcome, counts); **never content**
  (message text, item names, locations, tokens) — AI safety S-10; one logger, no `console.*` in
  runtime code (test scripts excepted); errors log once, with context, not repeatedly.
- **Async/await + timeouts:** async/await only (no floating promises — lint-enforced); every
  external call has a hard timeout (LLM: 15 s/attempt, 2 retries per AI_ARCHITECTURE §2);
  `Promise.all` only for independent operations with bounded concurrency; no unbounded
  `while(true)`/retry loops; always `await` cleanup (finally blocks for resources).
- **Commenting style:** explain **why**, not what; no commented-out code left in the diff; non-obvious
  workarounds cite the constraint (`// FR-011: correction appends, never overwrites`);
  doc comments on exported service/provider functions reference `FR-/AC-` IDs where applicable.
- **Tests:** live under `tests/` mirroring the source tree (`tests/unit/**`, `tests/integration/**`,
  `tests/e2e/**`, `tests/ai-evaluation/**`), files named `*.test.ts` (`item.service.test.ts`);
  deterministic, no sleeps-as-sync, mock providers for LLM (MockProvider), local Postgres for IT;
  test IDs `UT/IT/E2E/AIE-###-#` per TEST_PLAN; no test-only bypasses of auth/validation.
- **Git:** branch `task/T-###-slug` (e.g., `task/T-032-items-api`); conventional commits referencing
  the task — `feat(T-032): add item CRUD with owner scoping`, `fix(T-034): …`, `test(T-037): …`,
  `docs(T-003): …`, `chore(T-012): …`; one task per branch/PR; no unrelated changes in a PR.
- **Accessibility coding:** semantic HTML (`button/nav/main/label` — no `div onClick`); every input
  has a `<label>`/`aria-label`; errors linked via `aria-describedby` + `aria-live`; dialogs trap and
  restore focus; route changes move focus to the heading; visible focus styles never removed;
  respect reduced-motion; color never the sole signal.
- **Security coding:** no `dangerouslySetInnerHTML` (assistant output renders as text + links);
  data access only through Prisma (parameterized) — no `$queryRawUnsafe` with string building;
  no secrets in code/config — typed env loader + `.env.example` placeholders only; `ownerId` from
  `requireUser()`, never from payloads; no user content in logs/URLs; CSP-compliant markup; rate
  limiting and auth checks never disabled "temporarily".

**Out of scope:** prose style for product/design docs (their owners), SQL formatting beyond Prisma
usage, marketing copy, ADR process (see Orchestrator/human gates).

## 3. Inputs

- [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) §2 (layering),
  [../architecture/API_SPEC.md](../architecture/API_SPEC.md) §2 (envelope), 
  [../architecture/OBSERVABILITY.md](../architecture/OBSERVABILITY.md) (log fields), AI
  bounds (AI_ARCHITECTURE §2), NFR-001 (a11y), SECURITY.md controls.
- ESLint/Prettier configs (T-011) that machine-enforce parts of this document.
- Review findings citing these rules; new patterns that need standardization.
- **Trigger events:** a rule gap found in review, a tooling change (lint rules), a repeated
  question about convention, a review dispute settled by escalation.

## 4. Outputs

- This standard (versioned here) + enforcement configs: ESLint import-boundary and
  floating-promise rules, Prettier, `tsconfig` strict flags (Frontend T-011).
- Rule-change proposals: Markdown entry with (a) rule text, (b) rationale, (c) affected roles/files,
  (d) migration/impact — routed to Orchestrator, countersigned by Review before this doc changes.
- Review citations: blockers formatted `violates CODING_STANDARDS §<section> (<rule>)` so
  disputes resolve by text, not taste ([REVIEW_AGENT.md](REVIEW_AGENT.md) §4).

## 5. Allowed tools

- **File tools:** read/glob/grep everywhere; edit/write for the doc changes in §4 (Orchestrator
  applies, Review countersigns — see §6).
- **Shell:** PowerShell on **Windows** (Node 24.13.0, npm 11.6.2, git 2.52.0 per T-001) —
  `npm run lint`, `npm run typecheck`, `npm run test`, Prettier check; only by roles that own the
  touched files (per role-doc §5 constraints: DB rules are verified by
  Backend/QA with their local PostgreSQL 16 test database).
- **Web search:** official docs (TypeScript/Next.js/Prisma/React a11y) when a rule needs a
  rationale — citations strengthen proposals; never to justify adding untraceable dependencies.

## 6. Permissions

Per [AGENT_SPEC.md](AGENT_SPEC.md) §3: every editing role is **bound by** these standards when
using its ✅/🔶 capabilities; `npm run lint/typecheck/test` ✅ (per role rows). This document has
no dedicated §3 row (coordination doc): changes are proposed by any role (§4 format), applied by
the **Orchestrator** with **Review countersignature** — nobody rewrites standards unilaterally.
The AGENT_SPEC §2.6 minimal-diff rule and CI lint gate (T-011/T-012) are the enforcement backstop.

## 7. Dependencies

- **Depends on:** SYSTEM_ARCHITECTURE (layering), API_SPEC (envelope), OBSERVABILITY (log fields),
  NFR-001/ACCESSIBILITY (a11y rules), SECURITY.md, AI_ARCHITECTURE bounds; Frontend's T-011 lint
  configs as enforcement vehicle.
- **Depended on by:** all implementation roles (Frontend, Backend, AI, AwsInfra write to these
  rules), QA (test-file naming/layout rules), Review (§8 citations), Security Review (security
  coding rules are gate inputs), Orchestrator (proposal application).

## 8. Handoff rules

- Every implementation handoff names which standard sections its change relies on: default is the
  checklist below; deviations are listed explicitly with rationale (a deviation without rationale
  is a blocker, not a caveat).
```text
Standards conformance (self-check, cite sections):
  TS strict / no unexplained `!`            -> §2 TypeScript strict
  Naming + file layout                      -> §2 Naming, File organization
  Import boundaries (no cross-layer deep)   -> §2 Imports (ESLint clean)
  Zod-first, shared schemas only            -> §2 Zod-first validation
  ApiError → envelope, no empty catch       -> §2 Error handling
  Structured logs, allowlist, no content    -> §2 Logging
  Awaited promises, hard timeouts           -> §2 Async/await
  Why-comments, no dead code                -> §2 Commenting
  tests/…*.test.ts with TEST_PLAN IDs       -> §2 Tests
  branch task/T-###-slug, feat(T-###): …    -> §2 Git
  Semantic HTML + labels + focus            -> §2 Accessibility
  No raw SQL / dangerouslySetInnerHTML / secrets in code -> §2 Security
Deviations from the above: <none | rule + rationale + reviewer awareness>
```
- Review cites blockers as `CODING_STANDARDS §<n>` so authors can self-serve; recurring ambiguity
  → proposal per §4 (does not block the current PR once the blocker is resolved).

## 9. Prohibited actions

Universal prohibitions apply by reference: [AGENT_SPEC.md](AGENT_SPEC.md) §6 and §2.

- Using `any` to skip a type problem, or `!` to silence a boundary check, without stated reason.
- Bypassing lint rules with `eslint-disable` (each disable needs an inline reason + Review ack).
- Duplicating schemas/types instead of importing `src/lib/validation`.
- Empty catches, swallowed promises, `console.log` of runtime content, raw `console.error` chains.
- String-built SQL, `dangerouslySetInnerHTML`, secrets in code, auth/validation disabled for speed.
- Editing this document directly without the §4 proposal path (Orchestrator applies, Review countersigns).
- Drive-by reformatting/unrelated diffs (AGENT_SPEC §2.6) — style is fixed by config, not by hand.

## 10. Acceptance criteria

- `npm run lint` (T-011 config incl. import boundaries + floating promises) passes with 0 errors
  in every handoff, output pasted; `npm run typecheck` clean under `strict`.
- Review finds zero un-rationaled deviations; blockers cite §sections and authors resolve them or
  file §4 proposals.
- Spot checks confirm: shared schemas used at boundaries, envelope-conformant errors, allowlist-only
  logs, `task/T-###-slug` branches and `feat(T-###): …` commits, `tests/**/*.test.ts` naming.
- No new standards text appears anywhere else (single source); this doc changes only via §4 with
  recorded countersignature.

