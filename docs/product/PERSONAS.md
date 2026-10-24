# SmartHomeAI — Personas

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Product Manager (agent: PRODUCT_AGENT) |
| Source | Expanded from [PRD.md](PRD.md) §5 (summaries there are authoritative for name/age) |

Personas are composite archetypes, not real individuals. They exist to make trade-off
decisions concrete: when a decision serves P1 but hurts P3, we know we owe P3 a mitigation.
FR references use IDs from
[FUNCTIONAL_REQUIREMENTS.md](../requirements/FUNCTIONAL_REQUIREMENTS.md).

---

## Summary

| ID | Persona | Age | Core job | Primary pain | Key FRs |
|---|---|---|---|---|---|
| P1 | Busy Professional Sam | 32 | Get a 5-second answer before leaving the house | Daily misplacement of keys/wallet/charger; no time for heavy apps | FR-006, FR-008, FR-005, FR-024, FR-013 |
| P2 | Household Manager Priya | 45 | Structure and recall across rooms, documents, and kids' gear | Information spread everywhere; no history or structure | FR-017, FR-004, FR-002, FR-005, FR-018 |
| P3 | Minimalist New User Noah | 27 | Capture in seconds without learning a system | Allergic to heavy apps; abandons tools that demand setup | FR-024, FR-030, FR-015, FR-009, FR-023 |

---

## P1 — "Busy Professional Sam" (32)

| Field | Value |
|---|---|
| Demographics | 32, urban professional, single occupancy apartment, high smartphone usage, commutes daily; income comfortable but cost-conscious about *recurring* gadget fees |
| Context | Rushed mornings. Keys, wallet, badge, laptop charger, motorcycle keys rotate between desk, hallway drawer, jacket pocket, and shelf. Misplaces something at least once a day; the search always happens at the worst moment |
| Goals | 1. An answer in ~5 seconds on the phone while walking out the door. 2. Capture a placement in one or two taps when putting things down. 3. Never waste time maintaining the system itself (no taxonomy projects, no tagging rituals) |
| Frustrations | Apps that need setup before value; trackers that need charging and only cover one object; notes he never finds again; chatbots that confidently invent an answer; anything slower than the search itself |
| Quoted line | *"Just tell me where I last put my motorcycle keys — I'm already late."* |
| Technical comfort | High (uses multiple apps daily) but low patience; expects instant load, remembers-last-state, and mobile-first flows. Will not read documentation |
| Accessibility considerations | Uses the app one-handed and often in motion — needs large tap targets, fast perceived performance (NFR-002, NFR-003), and readable contrast in both light and dark contexts; keyboard/screen-reader access still required for the days he is at a desk |
| Serves them most | **FR-006** ask in natural language · **FR-008** last recorded location + timestamp + caveat · **FR-005** instant deterministic search · **FR-024** one-tap confirmation of assistant writes · **FR-013** graceful degradation so inventory never blocks him · **FR-015** dashboard with recent items and quick actions |

## P2 — "Household Manager Priya" (45)

| Field | Value |
|---|---|
| Demographics | 45, parent of two, manages a shared home; organizes documents, tools, school gear, seasonal items; desktop at home plus phone |
| Context | Holds the family's "where is everything" knowledge in her head: passports in the office cabinet, Halloween costumes in the upstairs closet, the drill in the garage shelf, each child's consent forms somewhere. When she is away, the household cannot find things |
| Goals | 1. A dependable structure: rooms → drawers/shelves so items have an address. 2. History — *when* did we last put the tax folder away, and has it moved since? 3. Fast retrieval across hundreds of records with filters and search. 4. Correction when records go stale, without losing what was there before |
| Frustrations | Flat lists that collapse under volume; apps that overwrite history; no way to see what changed recently; tools that assume a single-item use case; being the single point of failure for household memory |
| Quoted line | *"I don't need a chatbot. I need the history of where the insurance papers went — and for it not to disappear when someone edits the record."* |
| Technical comfort | Moderate-to-high; comfortable with forms, tables, filters, and hierarchies. Values clear labels and predictable navigation over novelty. Will use the desktop layout heavily |
| Accessibility considerations | Long sessions at a dense dashboard: needs information-dense but legible typography (14px base, clear hierarchy), WCAG 2.1 AA contrast (NFR-001), visible focus states for keyboard navigation, and no motion-dependent meaning |
| Serves them most | **FR-017** location hierarchy (depth ≤ 3, sibling uniqueness) · **FR-004** append-only history with `occurredAt`/`recordedAt` · **FR-002** create/view/edit items at scale · **FR-005** filtered search · **FR-018** recent activity timeline (P1) · **FR-011** corrections that preserve history · **FR-016** archive/delete without destroying records |

## P3 — "Minimalist New User Noah" (27)

| Field | Value |
|---|---|
| Demographics | 27, early-career, renter, owns few but meaningful belongings (camera, laptop, bike lock, one good toolkit); digital minimalist — actively resists apps that demand ongoing attention |
| Context | Downloads tools reluctantly and abandons them within days if the first session is confusing. Willing to spend 90 seconds *once* if the payoff is obvious, zero patience for configuration. Skeptical of AI that overpromises |
| Goals | 1. Onboarding in under 2 minutes with a working example, not a feature tour. 2. Capture through talking ("I put the camera in the hall closet") rather than filling forms. 3. Quick exit — export or delete everything if he leaves (trust through control) |
| Frustrations | Feature walls, mandatory categorization, notification spam, dark patterns around deletion, chatbots that answer confidently but cannot show receipts. Anything that feels like a database admin job |
| Quoted line | *"If it takes longer to set up than to just look for the thing, I'm out."* |
| Technical comfort | High technically, but chooses simplicity; comfortable with keyboard shortcuts and CLI-like efficiency, hostile to busywork. Prefers defaults that are right |
| Accessibility considerations | Uses dark theme by default (P1 preference, FR-021) — dark mode must meet contrast requirements too; may use the app at night → needs theme switching without system-wide changes; respects reduced-motion settings |
| Serves them most | **FR-030** guided onboarding ≤ 3 steps, skippable (P1) · **FR-024** assistant-driven capture with confirmation cards · **FR-015** empty states with guided first steps · **FR-009** clarification instead of wrong guesses · **FR-010** honest "no records" answers · **FR-023** delete a conversation at will · **FR-014**/**FR-022** account deletion and export (P1) for the exit promise |

---

## Persona-driven decisions (traceable)

| Decision | Driven by | Reference |
|---|---|---|
| Assistant writes require confirmation (one extra tap) | P1 wants speed, P3 wants control — confirmation satisfies both, at the cost of friction we accept explicitly | FR-024, assumption A-6 |
| "Last recorded" caveat is mandatory in answers | P2's trust in history; P3's hatred of overclaiming | FR-008, product principle 2 |
| Information-dense dashboard, not a chat landing page | P2's volume needs; P1's "everything on one screen" | C-6, D7, FR-015 |
| Clarification questions instead of guessing | P1 would rather tap a candidate than be wrong; P3 distrusts confident guesses | FR-009 |
| Dark theme and dense-but-legible typography | P3's default dark usage; P2's long desktop sessions | FR-021, NFR-001, NFR-014 |
| Export + deletion in the retention policy | P3's exit-first trust model | FR-014, FR-022, BR-08 |
