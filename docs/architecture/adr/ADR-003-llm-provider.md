# ADR-003: LLM Provider — Groq Behind a Provider Abstraction

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review (decision status: **Accepted**) |
| Date | 2026-10-15 |
| Decision ID | D3 ([index.md §4](../../index.md)) · Product requirement **C-1** |
| Deciders | AI/LLM Engineer, Principal Architect |

## Context

The product requires a natural-language assistant whose answers are grounded in the user's
stored records ([AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md)). Forces:

- **Product requirement C-1:** Groq is the mandated *initial* inference provider; Amazon
  Bedrock must **not** be silently substituted.
- **Provider independence:** a future provider must be a configuration + adapter change, not
  a rewrite.
- **Latency:** the assistant is a synchronous request/response turn (p95 < 6 s end-to-end,
  NFR-001) — provider latency dominates perceived quality.
- **Cost:** Groq pricing research (2026-09/10, **assumption to re-verify**):
  `llama-3.3-70b-versatile` ≈ **$0.59 / 1M input tokens, $0.79 / 1M output tokens**; free
  developer tier ≈ 30 requests/min and 1,000 requests/day without a card.
- **Security:** the API key is a third-party secret; it must live server-side only; Groq sits
  **outside AWS's SLA** — an external dependency, an egress path, and its own availability
  risk (R-03).
- **Model catalog churn:** model ids and structured-output support change over time
  (open decision **D-OPEN-004**).

## Considered options

| Option | Pros | Cons |
|---|---|---|
| **(A) Groq behind an `LlmProvider` interface** *(chosen)* | Mandated by product C-1; very low latency + low cost; JSON mode; generous free dev tier; key stays server-side; adapter isolates it | Not an AWS service (external dependency, egress, separate billing/key); rate limits and model churn outside our control |
| (B) Amazon Bedrock (managed models) | Same account/IAM/billing; AWS SLA; VPC-friendly | Explicitly excluded by product requirement; extra IAM + model-access setup; generally higher latency/cost for this workload (**assumption**); kept as the leading *future* provider candidate because it slots behind the same interface |
| (C) OpenAI/Anthropic direct APIs | Mature tooling, strong models | Not required now; no added MVP value; same "external SaaS" shape as Groq without the mandated choice |
| (D) Self-hosted model (EC2/lightsail + GPU) | Full control, no per-token cost | GPU/ops cost and skill burden far beyond MVP needs; violates the cost ceiling (C-4) |
| (E) Client-side Groq calls from the browser | Fewer moving parts | Exposes the API key to browsers and bypasses server-side authorization — **prohibited** |
| (F) Lambda + Bedrock dedicated AI path | Isolated AI compute | Creates the second backend architecture rejected by [ADR-001](ADR-001-application-architecture.md)/D1 |

## Decision

1. **Groq is the initial and only production LLM provider for the MVP** — **decision D3** —
   accessed server-side via its OpenAI-compatible chat-completions REST API
   (`https://api.groq.com/openai/v1`), default model `llama-3.3-70b-versatile` configured via
   `GROQ_MODEL` (D-OPEN-004: verify model availability/JSON-mode support at implementation).
2. **All model I/O goes through an `LlmProvider` interface**
   (`src/lib/providers/llm/`): `complete()` and `completeJson()` with Zod-validated schemas;
   production implementation `GroqProvider`, test implementation `MockProvider`
   (deterministic, offline). Services never import Groq specifics.
3. **Structured output discipline:** JSON mode requested; every response parsed and validated
   with Zod; one repair retry; then the deterministic fallback path (FR-013) — never
   fabricated content.
4. **Bounds:** 15 s timeout per attempt, max 2 retries (429/5xx/network only) with backoff +
   jitter, `maxOutputTokens` 1024, circuit-breaker-lite after 5 consecutive failures (60 s),
   per-user caps BR-12 (100 messages/day, 20/min).
5. **Key custody:** `GROQ_API_KEY` lives **only** in server-side configuration — AWS Secrets
   Manager in staging/production (read via IAM, T-070/T-071), `.env` locally; never
   `NEXT_PUBLIC_*`, never client bundles, never git, never logged. **Rotation cadence:
   quarterly**, and immediately on any suspected exposure (SECURITY §4 incident containment).
6. **Provider independence is enforced, not aspirational:** services depend only on the
   interface; prompts and output schemas have no Groq-specific imports; swapping providers =
   one new adapter + config change (prompts may need model-specific tuning — known cost).

## Consequences

**Positive**

- Groq's low latency fits the synchronous assistant turn; free dev tier removes cost friction
  during development and evaluation runs.
- Deterministic fallback keeps search and CRUD fully functional during provider outages
  (FR-013) — the assistant is an acceleration layer, never a single point of failure.
- Swapping to Bedrock/OpenAI later is an adapter + config change (Bedrock is explicitly *not*
  auto-substituted; adopting it later requires a superseding decision).

**Negative / accepted costs**

- **External dependency outside AWS:** availability and rate limits depend on one key/plan
  (R-03); mitigations: bounded retries, degradation UX, deterministic search fallback,
  model configurable without code change.
- **Egress:** server→Groq HTTPS calls traverse the public internet; response/request content
  is personal data — minimized by top-K retrieval scoping and never sending other users'
  data (safety S-4/invariants below).
- **Key management:** a third-party secret to store, restrict, and rotate (Secrets Manager,
  quarterly) — adds a small operational ritual.
- **Model churn:** the default model must be re-verified each release (checklist item in
  TEST_PLAN/Phase 6); structured-output support may change per model (D-OPEN-004).
- Cross-provider prompt portability is best-effort (JSON contracts portable, phrasing not).
- Usage cost is variable (per 1M tokens) — bounded by BR-12 caps and bounded contexts; model
  in [COST_ESTIMATION.md](../../planning/COST_ESTIMATION.md).

**Neutral**

- Groq billing/keys are managed outside the AWS console — a second vendor relationship for
  the team.

## Compliance notes

- [ ] Key present only in Secrets Manager (cloud) / `.env` (local); secret scan green
      (T-063); no `NEXT_PUBLIC_` secret ever.
- [ ] Quarterly key rotation recorded; rotation procedure tested once.
- [ ] Never send data of users other than the authenticated requester to the provider.
- [ ] The LLM never executes SQL, tools, or unconfirmed writes — writes are proposed
      `pendingAction`s validated and confirmed server-side (S-5/S-6, FR-024).
- [ ] Never log the API key or conversation content (S-10, UT-023-1).
- [ ] Model id re-verified at release (D-OPEN-004).

## Related

- D3 in [index.md §4](../../index.md) · [AI_ARCHITECTURE.md](../AI_ARCHITECTURE.md)
  (interface, S-1…S-10, fallback) · [adr/ADR-001](ADR-001-application-architecture.md) (one
  backend) · [adr/ADR-004](ADR-004-deployment.md) (secrets handling, hosting)
- Risks R-03 (provider availability) · Cost model in
  [COST_ESTIMATION.md](../../planning/COST_ESTIMATION.md)
