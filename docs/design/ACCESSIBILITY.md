# SmartHomeAI — Accessibility

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Design Agent |
| Scope | Accessibility requirements for all 14 specified pages: perceivable, operable, understandable, robust, component patterns, testing |
| Related | **NFR-001** (accessibility target in the non-functional requirements register) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (tokens) · [DESIGN_SPEC.md](DESIGN_SPEC.md) (states) |

**Canonical inputs:** [PRD §10 — WCAG 2.1 AA target](../product/PRD.md),
[FUNCTIONAL_REQUIREMENTS](../requirements/FUNCTIONAL_REQUIREMENTS.md) (states, FR-012, FR-015),
[API_SPEC](../architecture/API_SPEC.md) (error messaging).

> **Registry note (for the Review Agent, not silently diverged):** this document targets
> **WCAG 2.1 AA** as required by the design brief and PRD §10. The identifier *NFR-001* is used
> per the design brief; [../CONTRACT.md §6](../CONTRACT.md) currently lists NFR-001 as API latency
> and NFR-003 as accessibility (WCAG 2.2 AA). If the NFR registry assigns different IDs, update the
> "Related" reference here — the requirements in this document do not change. WCAG 2.2 success
> criteria (focus appearance, dragging movements, accessible authentication) are followed as
> *should-have* where they cost nothing (e.g. `autocomplete` attributes, no pointer-only paths).

---

## 1. Target, scope, and conformance approach

| Topic | Requirement |
|---|---|
| Target | **WCAG 2.1 Level AA** for every page in [DESIGN_SPEC.md §1](DESIGN_SPEC.md#1-page-specifications), both themes, all breakpoints |
| Scope | Public pages, auth pages, onboarding (P1), dashboard, assistant, inventory, item detail, forms, locations, history, search, activity (P1), settings/privacy, error pages |
| Principle | Accessibility is a **design-time obligation** implemented through tokens and component variants ([DESIGN_SYSTEM.md §5](DESIGN_SYSTEM.md#5-component-variant-inventory-mapped-to-shadcnui-primitives)), not a page-by-page patch |
| Out of scope for MVP | Native apps, voice output (P2), in-player media controls (no media in MVP) |
| Evidence status | **No test results exist yet** — this is the documentation phase. Results are recorded only after a run actually happens (docs/index.md ground rule 3). §7 defines *what* will be run. |

---

## 2. Perceivable

### 2.1 Contrast (≥ 4.5:1 text, ≥ 3:1 UI)

Contrast obligations are enforced **at token level** so every page inherits them. Values below are
computed from the token definitions in [DESIGN_SYSTEM.md §1](DESIGN_SYSTEM.md#1-color-palette) at
design time; they must be re-verified by the automated checks in §7 before release.

| Pair | Theme | Approx. ratio | Requirement |
|---|---|---|---|
| `--foreground` `#101828` on `--background` `#F7F8FA` | light | ≈ 16:1 | ≥ 4.5:1 ✓ |
| `--muted-foreground` `#667085` on `--background` | light | ≈ 4.7:1 | ≥ 4.5:1 ✓ (never lighter for body text) |
| White on `--primary` `#1769E0` (button label) | light | ≈ 5.1:1 | ≥ 4.5:1 ✓ |
| White on `--destructive` `#B42318` | light | ≈ 6.5:1 | ≥ 4.5:1 ✓ |
| `--success` `#15803D` / `--warning` `#B45309` / `--info` `#0E7090` on white or their `-surface` tints | light | ≈ 5:1 each | ≥ 4.5:1 ✓ |
| `--sidebar-foreground` `#E4E9F0` on `--sidebar-background` `#0B1E34` | light | ≈ 13:1 | ≥ 4.5:1 ✓ |
| `--foreground` `#E6EAF2` on `--background` `#0F1420` | dark | ≈ 15:1 | ≥ 4.5:1 ✓ |
| `--muted-foreground` `#98A2B3` on `--background` `#0F1420` | dark | ≈ 7:1 | ≥ 4.5:1 ✓ |
| `--primary-foreground` `#0B1220` on `--primary` `#3B82F6` | dark | ≈ 5:1 | ≥ 4.5:1 ✓ — *dark primary deliberately uses a **dark** label; white on `#3B82F6` would only reach ≈ 3.1:1 and is forbidden* |
| Input/select border (`--input`) on `--card` | both | light ≈ 3.8:1, dark ≈ 3.9:1 | ≥ 3:1 (UI component boundary, 1.4.11) ✓ |
| Focus ring `--ring` on `--background` / `--card` | both | ≥ 3:1 | ≥ 3:1 (focus indicator, 1.4.11) ✓ |
| Icon-only controls and status icons vs. their surface | both | ≥ 3:1 | ≥ 3:1 ✓ |

Rules:
- `--border` (`#E1E4E8` light / `#2A3345` dark) is for **decorative** dividers and card outlines
  only; any border whose absence makes a control hard to identify (inputs, selects, secondary
  button outlines, active tree nodes) uses `--border-strong`/`--input`, which meets 3:1.
- Text over images (P1 item photos): no text is placed over images in MVP; if added later, apply
  an opaque scrim meeting 4.5:1.
- New token pairs must document their ratio in DESIGN_SYSTEM before use in components.

### 2.2 Text alternatives

- **Icons:** Lucide icons adjacent to text are `aria-hidden="true"` (text carries the meaning).
  Icon-only controls (menu, send, show/hide password, row `⋯`) require an accessible name via
  `aria-label` or a visible `Tooltip` **plus** label — the tooltip alone is insufficient.
- **P1 item images (FR-025):** `alt` describes the object using the item name —
  `alt="Photo of motorcycle keys"`. Images are supplementary (visual hint); no information is
  conveyed *only* by the image, and status/archived state is always text. Purely decorative
  imagery (empty-state illustrations) uses `alt=""` and `aria-hidden`.
- **Empty-state illustrations and brand marks:** decorative → hidden from assistive tech; the
  wordmark link has an accessible name ("SmartHomeAI home").
- **Charts/media:** none in MVP. If charts are ever added, they need a text summary derived from
  stored data.

### 2.3 No color-only meaning (status indicators)

- Every status badge = **color + icon + text** (DESIGN_SYSTEM §1.3): Recorded/CONFIRMED,
  INFERRED, Archived, Deleted, Never recorded, AI degraded.
- Match-type badges on search results, source badges (`MANUAL`/`ASSISTANT`), and confidence badges
  on the timeline include readable labels, not just hues.
- Validation states pair color with an error icon and text; success hints pair color with a check.
- The sidebar's active item combines background tint, a 3 px indicator bar, and
  `aria-current="page"`.
- Charts are not used, so no chart-specific color rules are needed; table row striping is never
  the only row-identification cue (borders + focus are present).

---

## 3. Operable

### 3.1 Keyboard

- **Every** functionality is operable by keyboard: navigation, search, table sort/filter/pagination,
  row action menus, dialogs, the location tree, the combobox picker, the assistant composer,
  candidate buttons, and confirmation cards (F-05–F-08 flows must be completable hands-free).
- Shortcuts: `Enter` submits forms/sends messages, `Shift+Enter` inserts a newline in the
  composer, `Esc` closes any overlay, `Enter`/`Space` activate rows and tree items. Optional
  `Cmd/Ctrl+K` search shortcut is additive only — the input itself always works.
- **Tab order** follows DOM/reading order; `tabindex` stays `0` or negative only for intentional
  roving-focus widgets (tabs, tree, listbox) — never positive.
- No keyboard traps: overlays intentionally trap focus **while open** and always release it back
  to the trigger on close (§6.2). The composer never captures focus permanently while a reply is
  loading.

### 3.2 Focus visibility

- `:focus-visible` renders the `--ring` 2 px outline with 2 px offset on **all** interactive
  elements; `outline: none` without a replacement is forbidden (lint/review rule).
- The ring must be ≥ 3:1 against the adjacent surface **in both themes**, including on the navy
  sidebar (use `--blue-300` ring there — DESIGN_SYSTEM §1.1).
- Focused elements are never obscured by sticky headers/composers (scroll-margin on targets;
  the assistant composer reserves bottom padding for it).
- **Skip link:** the first focusable element in the app shell is "Skip to main content" → `#main`;
  it becomes visible on focus. Landing/auth shells include it too (targets `main`).

### 3.3 Focus management

| Situation | Required behavior |
|---|---|
| Route change (client navigation) | Focus moves to the new page's `h1` (programmatically) or, if that is impractical, the `main` landmark — never left on a removed node |
| Dialog / drawer opens | Focus moves to the dialog title (or the safe first control); focus is trapped; background is inert |
| Dialog / drawer closes | Focus returns to the element that opened it |
| Toast appears | Focus is **not** moved; the toast is announced politely (§5.4) |
| Inline validation on submit | Focus moves to the first invalid field |
| Assistant reply arrives | Focus stays in the composer; the reply is announced via the live region |
| Citation / candidate click | Focus follows normal link/button behavior to the target page control |

### 3.4 Timing, motion, and pointer

- No session-timeout warnings below 60 s without extension; auth errors never appear for < 5 s
  without the ability to retry (rate limits expose `Retry-After` numerically).
- `prefers-reduced-motion: reduce` disables non-essential motion: skeleton shimmer, page/scroll
  animations, thread auto-scroll (instant jump), toast slide-in, tree expand animation. State
  changes remain perceivable through color/icon/text.
- **Touch targets** ≥ 44 × 44 px for primary mobile actions (cards, chips, candidate buttons,
  nav items) per [DESIGN_SPEC.md §5.2](DESIGN_SPEC.md#52-shell-behavior).
- No hover-only information: tooltips open on focus too; row actions are reachable without hover.
- No dragging is required anywhere (WCAG 2.5.7 is 2.2, but no drag paths exist anyway).

---

## 4. Understandable

### 4.1 Forms: labels and error association

- Every control has a **programmatic label** (`<label for>`); placeholders are never the only
  label (DESIGN_SPEC §1.2).
- Error messages are associated with their control through `aria-describedby` (the error node's
  id is referenced even when empty), the control sets `aria-invalid="true"`, and the error node
  uses `role="alert"` when it appears dynamically.
- Related helper text (password policy, char counters, "Editing never changes history") is also
  linked via `aria-describedby`, so SR users hear label → helper → value → error in order.
- Auth fields declare `autocomplete` (`email`, `new-password`, `current-password`, `one-time-code`)
  — supports cognitive/motor users and WCAG 2.2 accessible authentication.

### 4.2 Inline validation UX

1. Validate **on submit** first (never while the user is still typing their first attempt), then
   re-validate a field on `blur` once it has failed.
2. Keep errors adjacent to the field **and** render a summary at the top of the form on failed
   submit with links that focus the field (works for long forms like create/edit item).
3. Messages are plain language and say how to fix: "Required, 1–120 characters" — mirroring the
   API `details[].issue` strings (API_SPEC §2) so UI and API wording never disagree.
4. Never clear entered values on error; never rely on the toast alone for form errors.
5. Duplicate-item warning is advisory (FR-002.4) → uses `role="status"`, not `alert`, so it does
   not interrupt typing.

### 4.3 Consistent navigation and plain language

- Nav labels, order, and icons are identical on every app page; the sidebar is the same component
  everywhere (INFORMATION_ARCHITECTURE §2). Breadcrumb format is uniform
  (DESIGN_SPEC §5.3).
- Page titles follow `Page — SmartHomeAI`; every page has exactly one `h1` and a logical heading
  outline (no skipped levels).
- **Assistant copy:** short sentences, no jargon ("LLM", "grounding", "token") in user-facing
  text; consistent stock phrases for the honesty rules — "last recorded location", "may have moved
  since", "I don't have a record for that", "Nothing has been saved yet" (FR-008, FR-010,
  FR-024). Ambiguity is always *asked about*, never guessed (FR-009).
- Errors (404/500/maintenance, 503 fallback) use the same plain-language tone defined in
  DESIGN_SPEC §1.14 and §4.4 — no stack traces, no provider internals.

---

## 5. Robust

### 5.1 Semantic HTML first

- Native elements carry the semantics: `<button>` for actions, `<a>` for navigation, `<table>` for
  tabular data, `<ol>` for the timeline, `<nav>`/`<main>`/`<header>` landmarks, `<form>` around
  forms, `<time datetime="…">` for all timestamps.
- Correct heading order (`h1` page title → `h2` sections → `h3` cards); lists for sidebar nav and
  card lists; nested interactive elements are avoided (card lists are `<li>` with one primary link
  plus a separate menu button).
- The app requires JavaScript (Next.js client interactivity), but static pages (landing, error
  pages) must render server-side with meaningful content without client fetches.

### 5.2 ARIA only where needed

- No ARIA on plain HTML equivalents ("first rule of ARIA: don't use ARIA" when a native element
  works). ARIA appears only on the custom widgets: dialog (`role="dialog" aria-modal`),
  combobox/listbox, tree, tabs, toast/live regions, badge/status text, and the assistant thread.
- Decorative icons and separators: `aria-hidden="true"`. Hidden content uses `hidden`,
  `inert`, or `aria-hidden` correctly — focusable content is never inside `aria-hidden`.

### 5.3 Live regions (assistant streaming/loading)

| Region | Polarity | Content |
|---|---|---|
| Assistant thread status | `aria-live="polite"` (`role="status"`) | "Assistant is thinking", "Searching your records…", reply arrival ("Assistant replied"), fallback banner appearance |
| Assistant errors | `role="alert"` (assertive) | Provider failure, validation failure of the message |
| Toasts | `role="status"` polite; destructive/failure toasts `role="alert"` | Action results incl. Undo availability |
| Search results count | `aria-live="polite"` (debounced) | "12 results" after filtering; "No results" |
| Combobox filtering | `aria-live="polite"` | Result count while typing |
| Loading containers | `aria-busy="true"` while fetching | Tables, dashboard cards, conversation load |
| Skeletons | `aria-hidden="true"` | Never announced |

Live regions are **created with the page** (not injected at the moment the message is needed) so
screen readers reliably announce updates. Assistant streaming is a single bounded reply in MVP
(API_SPEC §5 — no SSE), so announcements fire on completion, not per token.

### 5.4 Compatibility

- Valid, single-root markup; unique ids per page (combobox/tree ids are namespaced).
- Verified against current **VoiceOver** (macOS Safari, iOS) and **NVDA** (Windows
  Firefox/Chrome) per §7; no browser-specific ARIA that only one SR understands.
- Zoom to 200 % without loss of content or horizontal scrolling (WCAG 1.4.4/1.4.10 reflow);
  layout reflows at the breakpoints in DESIGN_SYSTEM §4.

---

## 6. Specific patterns

### 6.1 Table (inventory, search, activity)

- `<table>` with a visually hidden `<caption>` ("Inventory — your recorded items"), `scope="col"`
  on every header cell, item-name cell as `scope="row"` header.
- Sortable headers contain a `<button>`; the `<th>` carries
  `aria-sort="none|ascending|descending"` reflecting current state; toggling is announced by the
  live result count.
- Rows are not click-only: the name cell holds the primary link (`<a>`); the `⋯` menu is a separate
  button with an accessible name including the row ("Actions for Motorcycle keys").
- Pagination is a `<nav aria-label="Pagination">` with `aria-current="page"` and real disabled
  states (`disabled` + `aria-disabled` on prev/next at bounds).
- Below 768 px the same data renders as a `<ul>` card list (one link + one menu button per card) —
  never a horizontally scrolling table (WIREFRAMES §11).
- Result totals ("24 items") are plain text counts from stored data — announced, not implied.

### 6.2 Dialog / destructive confirmation

- Radix `Dialog`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = title,
  `aria-describedby` = consequence copy; focus moves to the title on open; initial focus lands on
  the **non-destructive** control (Cancel) for destructive dialogs; focus trapped; `Esc` closes;
  background `inert`; page scroll locked; focus restored to the trigger.
- Destructive dialogs state the outcome and the recovery path in text ("restorable for 30 days") —
  consequence is never conveyed by red color alone.

### 6.3 Combobox / location picker

Follows the WAI-ARIA APG combobox (listbox) pattern:
- Input: `role="combobox"`, `aria-expanded`, `aria-controls=<listbox id>`,
  `aria-autocomplete="list"`, `aria-activedescendant` pointing at the active option.
- Popup: `role="listbox"`; options `role="option"` with `aria-selected`; hierarchy is conveyed as
  text path ("Home / Living room / Shelf") plus `aria-level` on options — not by nested lists
  inside the listbox.
- Keyboard: `↓/↑` move (wrapping), `Home/End`, `Enter` select, `Esc` close and restore value,
  `Tab` closes and moves on.
- The **create-inline** entry is an option labelled `Create "…" — new location` (distinct from
  matches); selecting it opens a nested dialog with standard dialog semantics.
- Typing announces the match count via a polite live region; archived locations are excluded
  (their absence is a product rule, not an accessibility gap).

### 6.4 Timeline (location history)

- Semantic `<ol>` of `<li>` entries, newest first; each entry has a visible location name as its
  heading (`h3` within the card), then two labelled timestamps: visually hidden prefix **"Placed"**
  + `<time datetime="{occurredAt}">`, and **"Recorded"** + `<time datetime="{recordedAt}">` —
  screen-reader users hear which is which (they differ visually by label, not position alone).
- Source and confidence badges include text (`Manual`, `Assistant`, `Confirmed`, `Inferred`);
  inferred entries additionally carry an icon; void/correction states (P1) add explicit text.
- Entries are anchor targets (`#event-<id>`) and receive a visible focus/highlight when navigated
  to from an assistant citation.
- No drag/edit controls exist (append-only, FR-004), so no drag-related accessibility burden.

### 6.5 Tree (location management)

WAI-ARIA APG tree: `role="tree"` with `role="treeitem"` nodes and `role="group"` children;
`aria-expanded` on collapsible nodes, `aria-selected` on the active node, single tab stop with
roving focus, `↑/↓` movement, `→/←` expand/collapse, `Home/End`, `Enter` activates. Depth
(level ≤ 3) is exposed via `aria-level`. The tree never requires drag-and-drop for re-parenting —
re-parenting happens through the detail panel form.

### 6.6 Reduced motion, skeletons, and empty states

- Global `@media (prefers-reduced-motion: reduce)` rule kills shimmer, slide, and smooth-scroll
  (DESIGN_SYSTEM components must not define motion outside tokenized durations).
- Skeletons are `aria-hidden` with the container `aria-busy`, so SR users hear "Loading" once.
- Empty states use a real heading + one clearly labelled primary action; illustration is decorative.

---

## 7. Testing requirements

All items are **planned** — nothing has been executed yet; results are recorded only after a real
run (documentation-phase honesty rule).

| # | Check | When | Pass criterion |
|---|---|---|---|
| 1 | **Manual keyboard pass, per page** (all 14 pages): tab order, visible focus, `Esc`, `Enter`, arrow-key widgets, focus return from dialogs/drawers, skip link, no traps | Before each release; once per P0 page at first implementation | Checklist signed off per page with no blocking findings |
| 2 | **axe automated checks in CI** (planned: `@axe-core/playwright` against every P0 route in light **and** dark theme) | CI on every PR (Phase 8 pipeline; test-plan task TBD by QA_AGENT) | Zero `critical`/`serious` violations on P0 routes |
| 3 | **Token contrast suite** (script computing all foreground/background pairs from `globals.css` per theme) | CI alongside #2 | Every pair meets 4.5:1 (text) / 3:1 (UI) per §2.1 |
| 4 | **Screen-reader smoke — VoiceOver** (macOS Safari + iOS) and **NVDA** (Windows Firefox/Chrome): auth flow (signup → verify → sign-in) and item flow (create → record location → timeline → search) | Before release | Key steps completable and announced correctly; no missing labels/announcements |
| 5 | **Reduced-motion spot check** (`prefers-reduced-motion: reduce`) on dashboard + assistant | Before release | No shimmer/auto-scroll; all state changes still perceivable |
| 6 | **200 % zoom / reflow check** on dashboard, inventory, assistant | Before release | No content loss, no horizontal page scrolling |
| 7 | **Keyboard-only completion of F-03, F-04, F-05, F-07 flows** (see [USER_FLOWS.md](USER_FLOWS.md)) | Before release (pairs with E2E tests) | Flows complete without a pointer |

**Responsibility:** design specifies (this document), frontend implements, QA_AGENT executes and
Recorded before release — see [../planning/TEST_PLAN.md](../planning/TEST_PLAN.md). Findings that
require token or component changes are fed back into [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) rather
than patched per page.
