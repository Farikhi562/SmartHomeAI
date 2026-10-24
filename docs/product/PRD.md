# SmartHomeAI — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Canonical scope | Yes — any feature not described here is out of MVP scope |

---

## 1. Executive summary

SmartHomeAI is a personal belongings memory platform. Users record everyday items (keys,
wallet, charger, documents…) and where they placed them; an AI assistant answers natural-
language questions ("Where did I last put my motorcycle keys?") using **only** the recorded
facts, retrieved server-side and passed to a large language model for explanation.

The product is a **memory and record-retrieval system**, not a tracking system. It never
claims to know the real-time physical position of an object; it reports the last *recorded*
location and says so.

The MVP is a single-user-per-account, responsive web application with an enterprise-style
dashboard (AWS-inspired, not AWS-branded), PostgreSQL as the source of truth, Groq as the
initial LLM provider, and AWS as the cloud platform (Amplify Hosting) with the database and
auth on Supabase (PostgreSQL + Supabase Auth, per ADR-005).

## 2. Problem statement

People forget where they last placed everyday belongings. Existing solutions are either
physical trackers (costly, battery-powered, per-object) or manual notes spread across
apps with no retrieval intelligence. There is no lightweight, private, conversational way
to *ask* a system where something was last recorded and get a trustworthy, grounded answer.

## 3. Product vision

Help people remember where they last placed their belongings through a searchable personal
memory system and a natural-language AI assistant.

**Product principles**
1. **Recorded facts, not guesses.** Every answer is traceable to a stored record.
2. **Honesty about uncertainty.** Answers state "last recorded" and flag inferences.
3. **The dashboard is the product.** AI is embedded in a working management UI, not a chatbot landing page.
4. **Private by default.** One owner per record; server-side isolation on every operation.
5. **Graceful degradation.** Inventory operations work even when the AI provider is down.

## 4. Business objectives

| # | Objective | Measure |
|---|---|---|
| BO-1 | Ship a secure MVP that users trust with personal data | Zero cross-tenant data exposures; P0 security tests pass |
| BO-2 | Deliver genuinely useful recall | ≥ 70% of AI-evaluation cases produce a correct, grounded answer |
| BO-3 | Keep MVP operating cost negligible | ≤ USD 25/month at MVP-scale usage (see COST_ESTIMATION.md) |
| BO-4 | Maintain a swappable AI layer | Provider change = one adapter module + config |
| BO-5 | Build an agent-ready codebase | Traceability from every P0 FR to tests; documented conventions |

## 5. User personas

See [PERSONAS.md](PERSONAS.md) for full personas. Summary:

- **P1 — "Busy Professional Sam" (32):** misplaces keys/wallet/chargers daily; wants a 5-second answer on the phone in the morning.
- **P2 — "Household Manager Priya" (45):** tracks documents, tools, kids' gear across rooms; wants structure (locations, history) and search.
- **P3 — "Minimalist New User Noah" (27):** allergic to heavy apps; wants onboarding in under 2 minutes and quick capture via the assistant.

## 6. Jobs to Be Done

| # | Job | Trigger | Outcome |
|---|---|---|---|
| JTD-1 | When I can't find an item, I want to ask where I last recorded it, so I can stop searching blindly | Moment of forgetfulness | A grounded answer with last recorded location + time + honest caveat |
| JTD-2 | When I put something away, I want to record it in seconds, so future-me can find it | Item placed | A stored location event, confirmable by voice-like phrasing |
| JTD-3 | When my memory is fuzzy, I want to search/browse my inventory, so I can jog my memory | Vague recollection | Filterable list and search results |
| JTD-4 | When records are wrong or stale, I want to correct them, so the system stays trustworthy | Mistake discovered | Edited record with history preserved |
| JTD-5 | When I leave the platform, I want to export or delete my data, so I stay in control | Exit intent | Export file / deletion per retention policy |

## 7. User journeys

1. **First run:** Land → register (Supabase Auth via our `/api/auth/*` proxy) → onboarding (create first 2 items + first locations with examples) → dashboard.
2. **Quick capture:** Open assistant → "I put my wallet in the bedroom drawer" → assistant extracts item+location → confirmation card → record saved → dashboard updated.
3. **Recall:** Ask "Where did I last put my motorcycle keys?" → grounded answer with source records linked.
4. **Browse & search:** Open Inventory → filter by location/category → sort by last recorded time → open item detail → see location history timeline.
5. **Correction:** Item detail → edit name/category or record a new location → history preserved.
6. **Exit:** Settings → export JSON → request account deletion (grace period → purge).

Full flows in [USER_FLOWS.md](../design/USER_FLOWS.md); use cases in [USE_CASES.md](USE_CASES.md).

## 8. MVP scope

### 8.1 In scope (P0 — see roadmap for P1/P2)

| Area | P0 capability |
|---|---|
| Auth | Registration, login, logout, session, password recovery, email verification (Supabase Auth) |
| Items | Create, view, edit, delete (soft), archive; name, description, category, status |
| Locations | Create, edit, archive; simple hierarchy (parent/child, depth ≤ 3) |
| Location events | Record location changes; append-only history with occurred-at vs recorded-at |
| Search | Deterministic search over items/locations (PostgreSQL FTS + trigram) |
| AI assistant | Natural-language Q&A over the user's records via Groq; grounded answers; clarification on ambiguity; confirmed write actions |
| Dashboard | Counts, recently updated items, recent recorded locations, quick search, AI entry point, empty states |
| Isolation | Server-side, per-user authorization on every protected operation |
| Quality | Loading/error/empty states; responsive layouts; unit + integration tests |

### 8.2 Explicitly out of scope for the MVP

- Real-time physical tracking, IoT, Bluetooth/UWB integrations (P2).
- Voice input/output (P2).
- Shared household inventories / multi-user per space (P2).
- QR/NFC label scanning, calendars, and smart-home platform integration (P2).
- Vector databases, embeddings, retrieval-augmented generation infrastructure (rejected — see AI_ARCHITECTURE.md §8).
- Native mobile applications (responsive web only).
- Multi-language UI (English first; locale field reserved in preferences).
- Automated object recognition in images (P1 adds optional item images only as visual hints; recognition is not claimed).

## 9. Functional requirements

Canonical list with full detail (priority, preconditions, error conditions, dependencies,
test coverage): [FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md).

P0 FRs: FR-001–FR-013, FR-015–FR-017, FR-023, FR-024. P1: FR-014, FR-018–FR-022, FR-025, FR-030. P2: FR-026–FR-029.

## 10. Non-functional requirements

Canonical list: [NON_FUNCTIONAL_REQUIREMENTS.md](../requirements/NON_FUNCTIONAL_REQUIREMENTS.md).
Headlines: WCAG 2.1 AA target; p95 API latency < 400 ms excluding LLM; assistant reply
p95 < 6 s; 99.5% monthly availability target for cloud environments; TLS 1.2+ everywhere;
data encrypted at rest; log redaction of content; RPO ≤ 24 h, RTO ≤ 4 h (see DISASTER_RECOVERY.md).

## 11. Product assumptions

| # | Assumption | If wrong |
|---|---|---|
| A-1 | Users accept manual recording in exchange for recall (no auto-tracking) | Value proposition weakens; revisit P2 integrations |
| A-2 | Single-owner accounts suffice for MVP; households are P2 | Shared-space data model changes (bigger blast radius) |
| A-3 | English-only UX acceptable at MVP | Locale work moves into P1 |
| A-4 | Groq availability/latency is acceptable for interactive use | Fallback path (deterministic search) carries more weight; provider swap via abstraction |
| A-5 | A simple 3-level location hierarchy covers most homes | Flat locations + free-text notes might be simpler; hierarchy is capped and can be flattened |
| A-6 | Users will confirm AI-proposed writes (one extra tap) | Friction may hurt capture; consider direct-write mode as opt-in later |
| A-7 | Supabase Auth-managed flows are acceptable UX (proxied through our `/api/auth/*` routes so the session cookie stays httpOnly) | Switch to Auth.js + email service (documented alternative in SECURITY.md) |

## 12. Constraints

- **C-1** Groq is the required initial LLM provider (product decision; abstraction keeps it swappable).
- **C-2** PostgreSQL is the source of truth; AWS is the cloud platform.
- **C-3** Modular monolith; no microservices for the MVP (ADR-001).
- **C-4** MVP budget target ≤ USD 25/month (excluding one-off free-tier usage).
- **C-5** No AWS branding, logos, or proprietary assets in the UI (AWS-inspired only).
- **C-6** Design must remain an information-dense management dashboard, not a chatbot landing page.

## 13. Dependencies

| Dependency | Type | Risk |
|---|---|---|
| Groq API | External service | Outage/rate limits → mitigated by timeouts, bounded retries, deterministic fallback (FR-013) |
| Supabase (PostgreSQL + Supabase Auth) | PaaS (Supabase) | Vendor coupling noted in ADR-005; JWT verification is standard, migration bounded |
| AWS account + Amplify Hosting | Platform | Requires account setup before Phase 8 |
| Node.js LTS, Next.js, Prisma | OSS toolchain | Version drift → pinned in scaffold (T-010) |
| Email delivery (Supabase built-in email; custom SMTP for staging/prod) | Supabase | Free tier built-in email is rate-limited (~2–3 emails/hour) — configure custom SMTP or disable confirmations in dev (R-10) |

## 14. Success metrics

| Metric | Definition | MVP target |
|---|---|---|
| Activation | New users who create ≥ 1 item and ≥ 1 location within 24 h of signup | ≥ 50% (manual tracking during beta) |
| Capture rate | Location events recorded per active user per week | ≥ 3 |
| Answer correctness (offline eval) | % of AI-evaluation cases with correct, grounded answers | ≥ 70% (AIE suite) |
| Fabrication rate | Evaluated answers containing unsourced item/location claims | 0% |
| Assistant availability | % of assistant requests answered without provider failure UX | ≥ 99% (fallback counted as degraded, not failed) |
| p95 assistant latency | Server-measured, request → first byte of reply | < 6 s |

**Explicitly not tracked (privacy):** conversation content beyond evaluation fixtures; no
third-party analytics in the MVP. Product analytics events are limited to anonymized
functional events (§15).

## 15. Analytics events

Privacy-preserving, first-party, opt-out-respecting functional events (emitted server-side
where possible; P1 task T-088):

| Event | Properties (no content, no PII beyond user id) |
|---|---|
| `item_created` | source: `ui` \| `assistant`, category? |
| `location_event_recorded` | source, occurred_at_offset_hours |
| `search_performed` | result_count_bucket, used_fuzzy |
| `assistant_message_sent` | intent, fallback_used, latency_ms_bucket |
| `assistant_write_confirmed` / `assistant_write_cancelled` | action_type |
| `auth_signup` / `auth_login` | via: supabase |

Forbidden: message text, item names, location names, free-text payloads.

## 16. Risks

Full register with mitigations: [RISKS.md](../planning/RISKS.md). Top risks:

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | LLM fabricates an answer | Trust collapse | Retrieval-first pipeline, strict grounding prompts, zero-fabrication eval gate, citations |
| R-02 | Prompt injection via item names/user text | Data leak or rogue writes | Untrusted-content delimiters, no tool escalation, writes require user confirmation, authz outside LLM |
| R-03 | Groq outage/429s | Assistant unusable | Bounded retries + timeouts + deterministic search fallback (FR-013) |
| R-04 | Cross-tenant data exposure | Privacy breach | Ownership scoping in repositories, integration tests per endpoint, security review gate |
| R-05 | Supabase Free tier cost or quota surprises (500 MB storage, 2 projects, compute caps) | Budget breach | Budget alarms, Supabase Auth 50k-MAU free tier, documented Free-tier caps and Pro upgrade path, cost doc assumptions labeled |
| R-06 | Schema migration failure in cloud | Downtime | Expand-contract migrations, `migrate deploy` in pipeline, backup/restore drill (DR doc) |
| R-07 | Scope creep (tracking, households, voice) | MVP never ships | P0 freeze; roadmap discipline in §8.2 |

## 17. Release criteria (MVP exit)

- [ ] All P0 FRs implemented with passing `AC-` criteria recorded in test results.
- [ ] Every P0 FR mapped to ≥ 1 automated test (UT/IT/E2E/AIE) per TRACEABILITY_MATRIX.md.
- [ ] Security review gate passed (SECURITY_REVIEW_AGENT checklist: authz matrix, secrets scan, injection/XSS/CSRF, prompt-injection tests).
- [ ] AI evaluation suite run: ≥ 70% correct, 0% fabricated; results recorded.
- [ ] Production build passes CI (lint, types, tests, build).
- [ ] Staging deploy + smoke test (auth → item create → event → search → assistant round-trip) recorded.
- [ ] Backup configured; one restore drill executed and documented.
- [ ] Budget alarms active; COST_ESTIMATION assumptions updated with actuals.
- [ ] CHANGELOG updated; DoD checklists complete.
