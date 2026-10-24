# ADR-001: Application Architecture — Next.js Modular Monolith

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review (decision status: **Accepted**) |
| Date | 2026-10-15 |
| Decision ID | D1 ([index.md §4](../../index.md)) |
| Deciders | Principal Architect, Backend Agent |

## Context

SmartHomeAI's MVP needs one backend providing session-authenticated REST operations over
items/locations/history, a Groq-powered assistant pipeline
([ADR-003](ADR-003-llm-provider.md)), and server-side authorization on every protected
operation (FR-012). Forces acting on the choice:

- **Team:** a single small team / agent workforce — no ops rotation, no per-service owners.
- **Load:** personal-scale (one household's inventory per account), one client (the web UI).
- **Speed:** MVP delivery pressure; documentation-first repo where every moving part must be
  specifiable before code.
- **Consistency:** transactions across items, locations, and append-only events must stay
  simple ([ADR-002](ADR-002-database.md)); "two competing backend architectures" is an
  explicit anti-goal (CONTRACT D-1).
- **Constraints:** REST contracts are required for testability and agent implementability
  ([API_SPEC.md](../API_SPEC.md)); no Lambda/API Gateway backend in MVP.

## Considered options

| Option | Pros | Cons |
|---|---|---|
| **(A) Modular monolith on Next.js App Router + Route Handlers** *(chosen)* | One deployable/CI pipeline; shared types & Zod schemas between UI and server; single Prisma client keeps transactions trivial; hosting is a managed SSR platform; simplest IAM/network surface; easiest rollback | AI pipeline shares the HTTP process (bounded by 15 s LLM timeout); no independent scaling of AI vs CRUD; whole-app compute billing |
| (B) API Gateway + Lambda API (separate serverless backend) | Per-request billing granularity; independent scaling | Second deployment artifact and auth path; cold starts; distributed transactions with the DB; duplicated validation/error handling; more IAM surface — none justified by load or team size |
| (C) ECS/Fargate or App Runner container service | Full VPC control, reaches private RDS natively | Container/image ops and task-def management for a workload managed hosting already covers; retained only as ADR-004 network fallback |
| (D) Microservices (items / ai / search services) | Independent scaling and ownership | Operational overhead with no scaling or team-size justification; distributed transactions across one cohesive dataset |
| (E) tRPC-only internal API | Nice end-to-end typing | REST contracts requested for clarity/agent-readability; adds no value before a rich client ecosystem |
| (F) Next.js Server Actions only | Ergonomic for our own UI mutations | Not an explicit, testable contract; may be used *in addition* for form-shaped mutations, never as the only contract |

## Decision

We adopt **(A) a modular monolith** deployed as a single Next.js (App Router, TypeScript
strict) application — **decision D1**:

- HTTP layer: Route Handlers at `app/api/v1/**` implementing
  [API_SPEC.md](../API_SPEC.md); no API Gateway/Lambda backend in the MVP.
- Layering (dependency direction top → bottom, enforced by ESLint import boundaries, T-025):

  ```text
  app/api/v1/**                (HTTP handlers: parse, validate, map errors — no business rules)
      → src/server/services/**      (business logic, transactions, authorization checks)
          → src/server/repositories/**  (Prisma data access; ownerId required on user-scoped queries)
              → src/server/providers/**  (groq/, auth/, future external I/O adapters)
  src/shared/**                (Zod schemas/types shared by UI + server)
  ```

- Handlers stay thin: Zod parse → one service call → HTTP mapping.
- Services are the only place cross-entity rules and ownership checks run.
- Providers implement narrow interfaces (`LlmProvider`, identity provider) so vendors are
  swappable ([ADR-003](ADR-003-llm-provider.md), SECURITY §3.1).
- **Escape hatch (documented, not built):** if a second consumer of the API appears, the
  service layer is already isolated behind explicit DTOs, so it can be extracted behind an
  API Gateway (or a second deployable) without rewriting domain logic. Revisit triggers:
  independent scaling needs for the AI pipeline; multiple client applications; a required
  VPC-only data path the hosting cannot satisfy ([ADR-004](ADR-004-deployment.md));
  background job queue requirements (any operation consistently > 30 s).

## Consequences

**Positive**

- One deployable, one auth path, one error model, one CI pipeline ([DEPLOYMENT.md](../DEPLOYMENT.md)).
- Simple local development: `npm run dev` runs UI + API together.
- Transactional integrity stays trivial (single Prisma client, single database).

**Negative / accepted costs**

- The AI pipeline runs inside an HTTP request; the 15 s LLM timeout bounds request duration —
  long-running jobs would need offloading (trigger above).
- No independent scaling of the AI path vs. the CRUD path; acceptable at MVP scale.
- Compute is billed as the whole app; no per-function granularity.
- Shared process means a crash in one module affects all routes (mitigated by platform SSR
  restart + 5xx alarms, [OBSERVABILITY.md](../OBSERVABILITY.md)).

**Neutral**

- REST + Server Actions may coexist; contracts remain REST-first.
- Layering rules are enforced by lint, not by the compiler — discipline is required at review.

## Compliance notes

- [ ] Route handlers contain no business rules (Review Agent check).
- [ ] Every user-scoped service method takes an authenticated `ownerId` from the verified
      session token, never from the request body (FR-012; IT-012-1 matrix).
- [ ] Provider interfaces have exactly one production implementation (Groq) plus test doubles.
- [ ] ESLint import-boundary rules configured (T-025).
- [ ] No second backend is introduced without a superseding ADR.

## Related

- D1 in [index.md §4](../../index.md) · [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md)
  §8 · [API_SPEC.md](../API_SPEC.md) · [adr/ADR-004](ADR-004-deployment.md) (hosting)
- PRD constraint **C-3** (modular monolith, no microservices)
