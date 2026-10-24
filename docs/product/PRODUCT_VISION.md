# SmartHomeAI — Product Vision

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Canonical scope lives in | [PRD.md](PRD.md) — this document elaborates vision, positioning, and metrics; it does not add scope |

---

## 1. Vision statement

**Help people remember where they last placed their belongings through a searchable personal
memory system and a natural-language AI assistant.**

Supporting framing (one breath): SmartHomeAI is a private, per-user *memory* for everyday
belongings. You record where you put things — manually or by telling the assistant — and you
*ask* for them in plain language. Every answer is grounded in your own recorded facts, cites
the records it used, and says honestly that the item may have moved since it was last
recorded.

The product succeeds when a user in a hurry gets a trustworthy answer in seconds, and when a
skeptical user can verify that answer by clicking through to the underlying records.

## 2. Problem elaboration

The problem has three layers (see also [PRD.md](PRD.md) §2):

1. **Recall failure is frequent and costly.** Keys, wallets, chargers, tools, documents,
   children's gear — people misplace small belongings several times a week. The cost is not
   only the wasted search minutes; it is the low-grade anxiety and the interruption of the
   morning routine. Existing responses are mental notes ("I put it… somewhere") that decay
   within hours.
2. **Existing recording options have no retrieval intelligence.** People who do write things
   down scatter them across notes apps, chat threads with themselves, or paper. Retrieval is
   then a manual scan: the user must remember *where they wrote it down* before they can
   remember where the item is. There is no structure (item → location → time) and no way to
   ask a question.
3. **Existing tracking options are heavy and over-promising.** Physical trackers solve a
   different problem: knowing where an object is *right now*. They cost money per object,
   need batteries/charging, cover only the tagged items, and say nothing about objects you
   never tagged — the document folder, the borrowed drill, the spare keys. They also raise a
   privacy question the user never asked for (always-on location beacons).

The gap: a lightweight, private, *conversational* way to ask "where did I last put X?" and
get a trustworthy, grounded answer — with the honesty to say "last recorded", not "it is
there now".

**Why an AI assistant, and why now.** The retrieval problem above is fundamentally a
natural-language problem: users remember things as phrases ("the blue bag", "my
mother-in-law's folder"), not as database keys. A capable LLM behind a strict
retrieval-first pipeline turns a messy phrase into a deterministic lookup over structured
records — while the records themselves remain the source of truth (see
[../index.md](../index.md) §6, ground rule 1).

**Non-problem we deliberately accept (assumption A-1).** The user must record placements
manually. We trade automation for honesty and privacy: no beacons, no background tracking, no
claims the system cannot verify. Capture friction is mitigated by fast UI actions and the
assistant write flow (FR-024), not by surveillance.

## 3. Target market

| Dimension | Description |
|---|---|
| Who | Individuals (single-owner accounts) who regularly misplace everyday belongings and own a smartphone/computer; primary personas P1–P3 in [PERSONAS.md](PERSONAS.md) |
| Segment | Consumer prosumer / "personal productivity" users comfortable with a web app; the *form factor* is an enterprise-style dashboard because the data model (inventory, hierarchy, history, search) is naturally a management console |
| Size (qualitative) | Broad: anyone household-level who owns more than ~20 tracked-worthy belongings; no precise market sizing is claimed in this documentation phase — the MVP validates demand before any paid acquisition |
| Geography/language | English-first MVP (assumption A-3); locale field reserved in preferences (FR-021) |
| Entry motion | Self-serve signup; free during beta; activation measured per [PRD.md](PRD.md) §14 |
| Explicitly not the market (MVP) | Households sharing one inventory (P2, FR-028), enterprises/IT asset management, pet/vehicle/asset tracking with hardware, users requiring native apps or non-English UX at launch |

## 4. Product principles

Verbatim from [PRD.md](PRD.md) §3 — these are decision filters, not slogans:

| # | Principle | What it means in practice | Where it is enforced |
|---|---|---|---|
| 1 | **Recorded facts, not guesses.** | Every answer is traceable to a stored record; the LLM explains retrieved facts, it never supplies them | FR-007 (retrieval before generation), FR-010 (zero-fabrication), citations in FR-008 |
| 2 | **Honesty about uncertainty.** | Answers state "last recorded" and flag inferences; ambiguity produces a question, not a confident guess | FR-008 (caveat), FR-009 (clarification), `confidence: CONFIRMED\|INFERRED` in the schema |
| 3 | **The dashboard is the product.** | AI is embedded in a working management UI (inventory, locations, history, search), not a chatbot landing page | Constraint C-6; FR-015 dashboard; D7 |
| 4 | **Private by default.** | One owner per record; server-side isolation on every operation; content never logged | FR-012, BR-01, BR-09, NFR-013 |
| 5 | **Graceful degradation.** | Inventory operations work even when the AI provider is down; deterministic search carries the fallback | FR-013, NFR-012 |

## 5. Positioning vs. alternatives

| Alternative | What it does well | Where it fails for this problem | How SmartHomeAI differs |
|---|---|---|---|
| **Physical trackers** (Bluetooth/UWB tags) | Real-time "last seen" for *tagged* objects; no recording effort | Per-object cost + batteries; only tagged items; dependence on a phone/network proximity; no recall for documents or containers; raises always-on location privacy concerns | Zero hardware, covers *everything* you can name, records **history** (where it was placed over time), and is honest: it reports the last *recorded* placement instead of implying live position |
| **Notes apps / paper / chat-to-self** | Free, familiar, zero learning curve | No structure, no hierarchy, no timeline; retrieval = manual scanning; you must remember where you wrote it down; no "ask a question" affordance | Structured item/location/event model with search (FTS + trigram, D6) and a conversational front door that queries the records for you |
| **Generic chatbots (raw LLM chat)** | Fluent natural language, no setup | No access to your records → they guess or hallucinate; no ownership scoping, no history, no privacy boundary; nothing to click through to | Retrieval-first pipeline: the chatbot shape, but every claim is bound to retrieved record IDs, validated before display (FR-010), with citations into your inventory; the DB — not the model — is the source of truth |
| **"Do nothing" (memory + mental notes)** | No effort | Decays in hours; anxiety; re-searching the same items repeatedly | Seconds of capture buys repeatable recall; capture cost is minimized (quick actions, assistant confirmation cards) |

**Positioning statement (internal):** For people who repeatedly misplace everyday belongings,
SmartHomeAI is a private personal memory system that records where items were *placed* and
answers questions about them with cited, grounded facts — unlike trackers that only see
tagged objects, notes apps that cannot be asked, and generic chatbots that cannot be trusted.

## 6. What we are NOT

| We are not… | We are… | Boundary reference |
|---|---|---|
| A **tracking system** (real-time position, IoT, Bluetooth/UWB, GPS) | A **memory system**: we report the last *recorded* location and say so | PRD §1, §8.2; FR-008 caveat |
| A **chatbot landing page** | An enterprise-style management dashboard with an assistant embedded in it | Constraint C-6; D7 |
| A **shared household platform** (multi-user spaces, roles) in the MVP | Single-owner accounts; households are P2 with a data-model change and security review | Assumption A-2; FR-028 |
| A **vector/RAG search engine** | PostgreSQL full-text search + `pg_trgm` at personal-inventory scale | D6; PRD §8.2 |
| An **object recognition** system (photo → identity) in the MVP | Optional item images as visual hints only (P1); recognition is never claimed | PRD §8.2; FR-025, BR-10 |
| A **voice assistant** or native mobile app in the MVP | Responsive web app; voice is P2 | PRD §8.2; FR-026 |
| An **AWS-branded console** | An *AWS-inspired* dense enterprise design with zero AWS branding/logos/assets | Constraint C-5; D7 |
| A **guessing machine** | A zero-fabrication system: no record → it says so | FR-010; PRD §17 |

## 7. North-star metric and supporting metrics

### 7.1 North-star metric

> **Capture rate — location events recorded per active user per week — target ≥ 3**
> ([PRD.md](PRD.md) §14).

**Why this is the north star:** capture is the value-creation act of the entire product.
Every recorded event is a future recall answered correctly; recall quality (and therefore
trust, retention, and every other metric in the funnel) is bounded by what has been
recorded. Capture rate rising means users have adopted the habit; it is directly improvable
by the team (faster capture UX, assistant write flow, onboarding) and it is measurable
without touching conversation content (event counts only, per PRD §15 privacy rules).

**Guardrail on the north star:** capture must never grow at the expense of trust — hence
the zero-fabrication and correctness metrics below are hard gates, not tradeable targets.

### 7.2 Supporting metrics

| Metric | Definition | MVP target | Role relative to north star |
|---|---|---|---|
| Activation | New users who create ≥ 1 item **and** ≥ 1 location within 24 h of signup | ≥ 50% (beta, manual tracking) | Feeds the funnel: activated users are the only ones who can capture |
| **Capture rate (north star)** | Location events recorded per active user per week | ≥ 3 | North star — value creation |
| Answer correctness (offline eval) | % of AI-evaluation cases with correct, grounded answers | ≥ 70% (`AIE` suite) | Value *quality*: capture pays off only when recall works |
| Fabrication rate | Evaluated answers containing unsourced item/location claims | **0%** (release gate, PRD §17) | Trust guardrail — never traded against other metrics |
| Assistant availability | % of assistant requests answered without provider-failure UX (fallback = degraded, not failed) | ≥ 99% | Reliability of the recall experience (with NFR-012) |
| p95 assistant latency | Server-measured, request → first byte of reply | < 6 s (NFR-003) | Speed of the "5-second answer" promise (persona P1) |

**Business objectives alignment** ([PRD.md](PRD.md) §4): BO-1 (trust) ↔ fabrication +
isolation metrics; BO-2 (useful recall) ↔ answer correctness; BO-3 (cost ≤ USD 25/month) ↔
[NFR-011](../requirements/NON_FUNCTIONAL_REQUIREMENTS.md); BO-4 (swappable AI) ↔ provider
abstraction (D3); BO-5 (agent-ready codebase) ↔ traceability from FR → US → AC → tests.

**Explicitly not tracked (privacy):** conversation content beyond evaluation fixtures; no
third-party analytics in the MVP. Product analytics events are anonymized functional events
only (PRD §15).

## 8. Related documents

- Scope and business objectives: [PRD.md](PRD.md)
- Who it is for: [PERSONAS.md](PERSONAS.md)
- What will be built, in order: [ROADMAP.md](ROADMAP.md)
- Acceptable quality levels: [../requirements/NON_FUNCTIONAL_REQUIREMENTS.md](../requirements/NON_FUNCTIONAL_REQUIREMENTS.md)
- Requirement detail: [../requirements/FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md)
