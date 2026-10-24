# SmartHomeAI — Roadmap

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Priority source | [FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md) — P0 = FR-001–FR-013, FR-015–FR-017, FR-023, FR-024 · P1 = FR-014, FR-018–FR-022, FR-025, FR-030 · P2 = FR-026–FR-029 |
| Phase definitions | [../planning/IMPLEMENTATION_PLAN.md](../planning/IMPLEMENTATION_PLAN.md) §1–§3 (this roadmap maps FRs onto those phases; it does not redefine them) |

Priorities are frozen at the approval gate (T-004 per IMPLEMENTATION_PLAN §2.6): moving an
FR between P0/P1/P2 requires Product re-triage and a PRD version bump.

---

## 1. P0 — MVP (must ship before release)

P0 scope is the MVP release criteria in [PRD.md](PRD.md) §17. Mapped onto the canonical
implementation phases:

| Phase | Goal (IMPLEMENTATION_PLAN §1) | P0 FRs delivered in this phase | Notes |
|---|---|---|---|
| 0–1 | Documentation & approval gate | — (scope freeze) | This documentation set; T-004 approval freezes P0 |
| 2 | Scaffolding & conventions | — (platform only) | Next.js/TS strict/Tailwind/shadcn/Vitest/Playwright/CI; design tokens incl. D7 theme |
| 3 | Auth & database foundations | **FR-001** (auth), **FR-012** (server-side authorization groundwork: JWKS verification, `ownerId` from `sub`) | Identity is the isolation boundary; ownership guard proven here |
| 4 | Item & location management | **FR-002** items · **FR-003** item→location · **FR-004** append-only history · **FR-016** soft-delete/archive · **FR-017** locations · **FR-012** ownership-matrix integration tests (gate) | The core memory model; corrections (**FR-011**) come with the edit/detail UI in this phase |
| 5 | Dashboard & search | **FR-005** deterministic search · **FR-015** dashboard | Recall surface without AI — also the FR-013 fallback dependency |
| 6 | Groq assistant | **FR-006** NL asking · **FR-007** retrieval-before-generation · **FR-008** last-recorded + caveat + citations · **FR-009** clarification · **FR-010** zero-fabrication · **FR-013** graceful degradation · **FR-023** conversations · **FR-024** confirmed writes | Eval gates (≥ 70% correct, 0% fabricated) must pass before phase exit |
| 7 | Security, QA, observability | **FR-012** (final sweep), cross-cutting verification of all P0 FRs | Security review gate; coverage targets (NFR-010); rate limits incl. BR-12 caps; log redaction (NFR-007) |
| 8 | AWS deployment & release | P0 end-to-end verification in cloud environments | Staging smoke, restore drill, budget alarms; availability target (NFR-004) begins applying to cloud envs |

**MVP exit = PRD §17 release criteria.** Notable sequencing constraints:

- FR-013 (degradation) depends on FR-005 (search) — search must exist before the assistant fallback is meaningful.
- FR-024 (confirmed writes) depends on FR-002/FR-003 services — assistant writes reuse UI validation, never a parallel path.
- FR-007/FR-008/FR-009/FR-010 are inseparable: grounding, citations, clarification, and zero-fabrication form one trust contract (US-007–US-009).

## 2. P1 — Fast follow

Shipped after MVP release, in the order below by default. Effort hints are **planning
estimates in person-days of agent work**, not measurements — refine at triage.

| Order | FR | Title | Rationale | Effort hint | Depends on |
|---|---|---|---|---|---|
| 1 | FR-014 | Account deletion per retention policy | Completes the privacy promise (JTD-5) started by P0 soft-delete; many users will not onboard without an exit; audit events already designed (BR-08) | M (3–5 d): Supabase Auth admin deletion (GoTrue admin API / SQL delete path) + purge job + idempotent request flow | P0 auth, retention job for BR-07 |
| 2 | FR-022 | Data export (JSON) | Cheap, high-trust feature; also offered inside the deletion flow (FR-014.2) | S–M (2–3 d): streaming JSON + audit event | All user tables (P0) |
| 3 | FR-030 | Guided onboarding (≤ 3 steps) | Directly targets the activation metric (≥ 50%, PRD §14); empty states already exist in FR-015 | M (3–4 d): flow UI + reuse of existing services | FR-015 empty states |
| 4 | FR-019 | Item aliases | Closes the biggest phrasing gap in search + assistant retrieval ("bike lock" = "U-lock"); schema already exists (DATABASE_SCHEMA §3.3) | S (2–3 d): CRUD + index reads into `search.repo` + retrieval | FR-005, FR-002 |
| 5 | FR-020 | Fuzzy-match quality ("did you mean") | Converts typo searches (UC-09) from empty states into hits; tunable ranking measured against the eval set | M (3–5 d): trigram thresholds, suggestion UX, eval runs | FR-005, `pg_trgm` indexes |
| 6 | FR-018 | Recent activity timeline | Cross-item "what changed" view; the append-only event feed makes it nearly free once dashboards exist | S–M (2–3 d) | FR-004 events feed |
| 7 | FR-021 | Preferences (theme, suggestions) | Accessibility/comfort (D7 dark theme is already designed); small data model (`user_preferences`) | S (1–2 d) | P0 auth |
| 8 | FR-025 | Item images (≤ 1, ≤ 5 MB, jpeg/png/webp) | Visual recall ("the blue bag"); requires S3 presigned upload + thumbnails — first new AWS surface, so also a cost/security review point (BR-10) | M–L (4–6 d): presigned upload, lifecycle/delete cascade, CDK additions | FR-002; BR-10 caps; budget check (BO-3) |

**P1 entry rule:** a P1 item starts only after the MVP release criteria are met and any
stated dependencies exist. P1 work must not regress P0 test gates (NFR-010 coverage, eval
suite, security gate).

## 3. P2 — Future (roadmap only; no implementation in this plan)

Each P2 item requires, **before any implementation work**: (a) a new or superseding **ADR**
for the architecture it touches, (b) a **PRD revision** (scope + assumptions + cost), and
(c) triage against the "not doing" list below. P2 items have no ACs or tests reserved yet.

| FR | Title | Why it is deferred | Entry criteria (all required) |
|---|---|---|---|
| FR-026 | Voice interaction (speech in/out) | New modality: transcription + playback UX, latency budget, privacy of audio | ADR (Whisper-vs-alternatives, per FR-026 notes); PRD §8.2 revision; cost/latency budget vs NFR-003 and BO-3 |
| FR-027 | QR/NFC label scan to open item | Camera flows + label printing outside the web MVP surface | ADR (camera permissions, label lifecycle); PRD revision; mobile browser support spike vs NFR-015 |
| FR-028 | Shared household inventories | Data-model change (spaces/roles/membership); invalidates assumption A-2; largest security blast radius | ADR + **security review** + PRD revision (A-2 replaced); isolation tests redefined (NFR-013); UX for roles |
| FR-029 | External smart-home / IoT tracking integrations | Would introduce automated `INFERRED` events; stresses assumption A-1 and the honesty rules | ADR (provenance model); PRD revision (A-1 revisited); explicit opt-in + provenance display spec; eval cases proving no weakening of FR-008/FR-010 |

## 4. Explicitly not doing

These are rejected or out of scope for the foreseeable roadmap — not "later maybe". Each
line names its canonical reason; adding any of them requires the P2 entry criteria above
plus removal of this entry.

| Excluded | Reason | Reference |
|---|---|---|
| Vector database / embeddings / RAG infrastructure | PostgreSQL FTS + `pg_trgm` is sufficient at personal-inventory scale; retrieval-first grounding does not need it | D6, PRD §8.2, AI_ARCHITECTURE §8 |
| Native mobile applications (iOS/Android) | Responsive web covers the use cases; two codebases would dominate the budget and cadence | PRD §8.2 |
| Multi-language UI | English first; `locale` field reserved in preferences; locale work moves in as P1 only if assumptions change | A-3, FR-021 |
| Real-time physical tracking (Bluetooth/UWB/GPS/IoT position) | The product is a **memory** system, not a tracker; live position claims would break the honesty contract | PRD §1, §8.2; "what we are NOT" in PRODUCT_VISION |
| Microservices / Lambda + API Gateway backend | Modular monolith meets all MVP needs with one deployable; operational cost unjustified | D1, C-3, ADR-001 |
| AWS branding/logos/proprietary assets in the UI | Design is AWS-*inspired* only | C-5 |
| Chatbot-only landing-page experience | The dashboard is the product; the assistant is embedded in it | C-6, D7 |
| Voice input/output, QR/NFC, households, smart-home integrations in MVP | Explicit P2 items above — tracked, not silently dropped | FR-026–FR-029 |
| Automated object recognition in images | P1 images are visual hints only; recognition is never claimed | PRD §8.2, FR-025 |
| Third-party analytics / conversation-content tracking | Privacy: only anonymized functional events; no message text, names, or free text | PRD §14–§15 |

## 5. Roadmap update policy

1. **Authority order.** This roadmap is subordinate to
   [FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md) for *what* an FR
   is and *its* priority; it owns sequencing and rationale. On conflict, the FR list wins and
   this file is corrected. (See also [../CONTRACT.md](../CONTRACT.md) §3 for the FR registry.)
2. **P0 freeze.** P0 scope is frozen at T-004. Any change to P0 requires Product re-triage,
   a PRD version bump, and an updated traceability matrix — never an in-place silent edit.
3. **Moving work up (P1 → P0):** allowed only pre-freeze; post-freeze it consumes contingency
   and requires the same re-triage as a P0 change.
4. **Moving work down (P0 → P1, or P1 → P2):** permitted with a PRD/roadmap version bump and
   a CHANGELOG entry stating why (cost, risk, dependency discovery).
5. **New ideas:** become P1/P2 *candidates* here (per [../index.md](../index.md) §6 ground
   rule 6) — never new P0 items, never new FR numbers outside the registry.
6. **Versioning:** file version bumps follow the documentation set (MAJOR at approval gate
   v1.0, MINOR for scope-relevant changes, PATCH for wording). Date updated in the header.
7. **Effort hints** are estimates, not results; actuals replace them only when recorded by a
   completed task (never claim work that has not run).
8. **P2 promotion checklist:** ADR + PRD revision + triage against §4 + new AC/test IDs minted
   in the canonical files *before* any code task is created.
