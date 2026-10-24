# SmartHomeAI — Non-Functional Requirements

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Verification authority | [../planning/TEST_PLAN.md](../planning/TEST_PLAN.md) (test IDs `UT/IT/E2E/AIE-`), [../architecture/OBSERVABILITY.md](../architecture/OBSERVABILITY.md) (runtime measurement), [../planning/TRACEABILITY_MATRIX.md](../planning/TRACEABILITY_MATRIX.md) |

**How to read this file.** Each `NFR-###` states a quality requirement, a *measurable*
threshold, and how the requirement will be verified. Thresholds are targets for the MVP
release ([PRD.md](../product/PRD.md) §10 headlines); a threshold may only be changed through the
same re-triage/PRD-bump process as scope changes (see
[../product/ROADMAP.md](../product/ROADMAP.md) §5). No NFR in this file has been *measured*
yet — this documentation phase defines the targets; results are recorded only when the
verification actually runs.

**Categories:** performance · reliability · security · usability · accessibility ·
maintainability · compliance · operability.

---

## Requirements

| ID | Category | Requirement | Target / measurable threshold | Verification method |
|---|---|---|---|---|
| NFR-001 | accessibility | The application must be usable by people with disabilities, covering keyboard operation, focus visibility, semantic structure, color contrast, and screen-reader labels on all P0 pages | WCAG 2.1 Level AA on every P0 page; contrast ratio ≥ 4.5:1 for body text (≥ 3:1 for UI components/large text) | Automated axe accessibility checks in CI on all P0 pages + manual keyboard/screen-reader pass per [../design/ACCESSIBILITY.md](../design/ACCESSIBILITY.md); test IDs per TEST_PLAN |
| NFR-002 | performance | Non-LLM API requests must respond fast enough that the UI feels instant under normal load | p95 server-side latency **< 400 ms**, **excluding** LLM calls (assistant endpoints measured separately, NFR-003); personal-scale data volumes (typical response < 500 KB) | Server timing instrumentation (`x-request-id`-correlated timings per OBSERVABILITY.md); load spot-check per endpoint in TEST_PLAN integration level |
| NFR-003 | performance | Assistant round-trips must return within an interactive budget | Assistant p95 **< 6 s**, measured server-side request → first byte of reply (provider timeout 15 s, retries 2 per FR-013 are hard upper bounds outside p95) | Latency metric recorded per request (no content logged); offline evaluation runs record per-case latency; target mirrored in PRD §14 |
| NFR-004 | reliability | Cloud environments must be available enough for daily use | **99.5% monthly availability target** for cloud environments (staging/production); local dev excluded | Availability derived from health checks (`GET /api/health`) + uptime monitoring/CloudWatch alarms per OBSERVABILITY.md; monthly review against target |
| NFR-005 | security | All network traffic must be encrypted | TLS 1.2+ everywhere (HTTPS-only; HSTS); no plaintext HTTP paths to app or API; JWKS/OIDC endpoints over TLS | Config review at deploy (Amplify/CDK settings), TLS handshake check during staging smoke; security review gate (PRD §17) |
| NFR-006 | security | Stored data must be encrypted at rest | Encryption at rest for **RDS** (storage encryption enabled) and **S3** (block-public-access + default encryption for P1 item images); local dev excluded | CDK/infra configuration review + AWS console/API verification recorded during Phase 8; secrets never in git (CI secret scan) |
| NFR-007 | security / operability | Application logs must not leak user content or PII | **Zero** occurrences of: conversation/message content, item names, location names, free-text payloads, raw tokens, secrets, raw IP (hashed only) in any log line; operational metadata (intent, model, latency, token counts, IDs) is allowed | Redaction-tested logger unit tests + log fixture review (per FR-023, BR-09); spot audit of staging logs; log retention 30 days per OBSERVABILITY.md |
| NFR-008 | reliability | Data loss and downtime must be bounded after an incident | **RPO ≤ 24 h**, **RTO ≤ 4 h** (RDS automated backups/PITR assumed — see [../architecture/DISASTER_RECOVERY.md](../architecture/DISASTER_RECOVERY.md)) | Backup policy configured in Phase 8 + **one restore drill executed and documented** (PRD §17); drill measures actual RPO/RPO vs target |
| NFR-009 | maintainability | The codebase must stay strongly typed and boundary-safe | TypeScript **strict** mode enabled; **zero `any`** at module boundaries (route handlers, service interfaces, repository/DTO seams, provider interface); no `@ts-ignore` without documented justification | `npm run typecheck` in CI on every merge; ESLint rules incl. import-boundary rules (IMPLEMENTATION_PLAN Phase 2) |
| NFR-010 | maintainability | Automated test coverage must be sufficient to refactor safely | **Unit: ≥ 70% of service-logic lines** covered; **every API endpoint has ≥ 1 integration test** (including an ownership/negative path per FR-012); every P0 FR maps to ≥ 1 automated test (`UT/IT/E2E/AIE`) | Coverage report in CI compared against targets; mapping checked via [../planning/TRACEABILITY_MATRIX.md](../planning/TRACEABILITY_MATRIX.md) at the release gate (PRD §17); full strategy in [../planning/TEST_PLAN.md](../planning/TEST_PLAN.md) |
| NFR-011 | compliance / operability | The MVP must stay within its cost envelope | MVP running cost **≤ USD 25 / month** at MVP-scale usage (excluding one-off free-tier usage), per constraint C-4 and BO-3 | AWS Budgets alarm (CDK) + monthly reconciliation of actuals vs [../planning/COST_ESTIMATION.md](../planning/COST_ESTIMATION.md) assumptions; all external prices labeled ASSUMPTION until verified |
| NFR-012 | reliability | An LLM provider outage must degrade, not disable, the product | During provider outage/rate-limit: **100% of non-assistant features fully functional**; assistant requests surface a clear degraded state with retry + deterministic search fallback (FR-013); assistant availability metric counts fallback as *degraded*, not failed (target ≥ 99%, PRD §14) | Integration tests with mocked provider (timeout/retry/fallback, IT-013-1); fault-injection of 429/5xx/timeout in test env; `ai.fallback` metric observed (no content logged) |
| NFR-013 | security | No user can read another user's data under any input | **Zero cross-user reads** in automated authorization tests: crafted IDs, payloads, query params, and assistant prompts never return foreign records; "not mine" ≡ 404 | Per-endpoint ownership-matrix integration tests (IT-012-1, IT-001-*), cross-user negative E2E (E2E-012-1), prompt-injection suite; security review gate (PRD §17, risk R-04) |
| NFR-014 | usability | Layouts must work across the supported display range | Fully usable responsive layout from **360 px to 1920 px** width: no horizontal scroll on core flows (dashboard, inventory, item detail, assistant), tables fall back to mobile-appropriate presentation | Visual/responsive checks per breakpoint in DESIGN_SPEC; E2E runs at representative viewports (360, 768, 1280, 1920) in TEST_PLAN |
| NFR-015 | usability | Supported browsers are defined and tested | Last **2 versions** of Chrome, Edge, Firefox, Safari (desktop) + mobile Safari/Chrome for responsive flows; no support for older/legacy browsers beyond graceful degradation | E2E smoke on the supported matrix (best-effort per environment availability; recorded, not assumed); build targets (Browserslist) pinned at scaffold time |
| NFR-016 | operability / compliance | Sensitive operations must be auditable after the fact | Audit events written for: account deletion request/completion, data export, assistant write confirmations, and permission-relevant anomalies; **retained 12 months** (anonymized on account purge), PII-free by design (hashed IP only) | `audit_events` rows asserted in integration tests (e.g., export/deletion flows); retention job + 12-month retention verified per BR-08 and DATABASE_SCHEMA §3.8; audit design reviewed at security gate |

---

## Notes and boundaries

1. **Measurement honesty.** Every threshold above is a *target*. Results may be claimed only
   when the verification actually ran and its output is recorded (PRD §17, AGENT_SPEC rules).
2. **Assistant vs. non-assistant latency** are deliberately split (NFR-002 / NFR-003) because
   LLM latency is not controlled by the app; the app controls timeouts, retries, and fallback
   UX (FR-013).
3. **Environment scoping:** NFR-004 (availability) and NFR-005/NFR-006 (TLS, at-rest
   encryption) apply to cloud environments; local development uses Docker Postgres 16 and is
   exempt — but BR-11 (no production data outside production) applies everywhere.
4. **Privacy interaction:** NFR-007 (log redaction) + NFR-016 (auditability) look
   contradictory but are complementary — audit events record *that* an action happened (type,
   counts, IDs), never *what was said or stored* (BR-08, BR-09).
5. **Related rules:** rate caps and content rules live in
   [BUSINESS_RULES.md](BUSINESS_RULES.md); functional behavior in
   [FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md); Given/When/Then checks in
   [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).
