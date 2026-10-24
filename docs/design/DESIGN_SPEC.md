# SmartHomeAI — Design Specification

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Design Agent |
| Scope | Page-by-page specification for all 14 specified pages, plus dashboard / inventory table / AI assistant interface detail sections |

**Companion documents:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (tokens, components, themes) ·
[INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md) (routes, navigation, sitemap) ·
[USER_FLOWS.md](USER_FLOWS.md) · [WIREFRAMES.md](WIREFRAMES.md) · [ACCESSIBILITY.md](ACCESSIBILITY.md)

**Canonical inputs:** [documentation index — locked decisions D1–D7](../index.md) ·
[PRD](../product/PRD.md) · [FUNCTIONAL_REQUIREMENTS](../requirements/FUNCTIONAL_REQUIREMENTS.md) ·
[API_SPEC](../architecture/API_SPEC.md). ASCII wireframes for every page live in
[WIREFRAMES.md](WIREFRAMES.md); this document is normative for behavior and states.

---

## 0. Conventions

### 0.1 Design direction (locked decision D7)

- **AWS-inspired enterprise cloud-console aesthetic, zero AWS branding.** No AWS logos, service
  names, screenshots, color schemes as literal assets, or proprietary iconography. Inspiration is
  structural: dense console layout, persistent navigation, operational status clarity (PRD C-5).
- **The main experience is a functional management dashboard with AI integrated into the workflow —
  not a chatbot landing page** (PRD C-6). The assistant is one navigation destination and one
  dashboard entry point among working management surfaces.
- Light theme is the default; dark theme is optional and user-selectable (D7, FR-021 P1).
- Deep navy navigation, neutral gray surfaces, restrained blue primary actions, clear typography,
  compact readable tables, consistent 4 px spacing scale, subtle borders/shadows, accessible
  contrast, responsive desktop/tablet/mobile, clear operational status indicators,
  information-dense without clutter.

### 0.2 Stack targets (implementation constraints for every page below)

Next.js (App Router) · Tailwind CSS · shadcn/ui primitives · Lucide icons ·
React Hook Form + Zod (all forms) · TanStack Table v8 (inventory table).

### 0.3 Layout-region vocabulary

| Region | Definition |
|---|---|
| `PublicShell` | Centered content on neutral surface; brand header + footer. Used by landing and auth pages. |
| `AppShell` | Authenticated frame: `Sidebar` (deep navy) + `Topbar` + `Main` + optional `Drawer` (sidebar < 1024 px). |
| `PageHeader` | Title, optional subtitle, breadcrumbs (nested pages only), primary page action(s). |
| `Content` | Page body; may use a 12-column grid with a max width of 1280 px (`2xl` centered). |
| `SidePanel` | Context panel (location detail, conversation list) that becomes a `Sheet` on small screens. |

### 0.4 State vocabulary (applies to every page)

| State | Rule |
|---|---|
| **Loading** | Render a skeleton that mirrors the final layout geometry (same row/heading counts). No full-page spinners except auth redirects. Assistant uses a dedicated streaming indicator (§4). |
| **Empty** | Explain what will appear here + one primary next action. Never a bare "No data". |
| **Error** | Inline, human-readable message + **Retry**; keep previously loaded content visible on partial failure (FR-015 error condition). Show `requestId` from the [error envelope](../architecture/API_SPEC.md#2-error-envelope-all-non-2xx-json-responses) when present. |
| **Success** | Confirm with a toast (non-blocking) or inline confirmation; never navigate away from unsaved form errors. |
| **Permission-denied** | Missing/expired session → redirect to sign-in preserving `next` (FR-001, FR-012). Resource owned by another user → indistinguishable **404** treatment (FR-012, never leak existence). Deleted account during grace period → blocked state with sign-out only (FR-014). |

**Metric rule:** any number shown must be derivable from stored data (FR-015.3). No invented
vanity metrics, trend percentages, or "AI accuracy" figures anywhere in the UI.

### 0.5 Bahasa antarmuka & added layout requirements (decided 2026-10-24, product owner)

| Topic | Rule |
|---|---|
| **UI language** | All **user-visible copy** — page titles, buttons, labels, empty/error states, assistant UI chrome, print labels — is written in **Bahasa Indonesia**. Audience: family members, including elderly parents. **English is retained** for code identifiers, log output, documentation prose, and API error `code` fields (machine-readable, stable, never localized). This amends the English-only copy assumed by the page specs below: structure and behavior stay as specified, the strings are Indonesian. |
| **Mobile bottom navigation** | On viewports < 1024 px the authenticated `AppShell` gains a persistent **bottom-navigation bar** with the primary destinations (dashboard, inventory, assistant, search, more) *in addition to* the top-bar `Sheet` drawer of §5.2 (amends §5.2); the bar hides on print and on auth/landing pages. |
| **Elderly-friendly sizing** | Interactive targets ≥ **44 × 44 px** and base body text ≥ **16 px** on app surfaces (the 44 px rule already required by §5.2 / [ACCESSIBILITY.md](ACCESSIBILITY.md) is extended to text size); no tiny icon-only controls without accessible names. |
| **Print labels page (`/labels`)** | A dedicated `/labels` route renders printable labels (item name + location path + category) from the existing items/locations API, with print-only CSS so application chrome never prints — FR-031 / US-030, **in progress** (decided 2026-10-24). |
| **Search page extras (`/search`)** | The existing `/search` page (§1.11) additionally shows the last 10 queries as removable chips (browser `localStorage`) plus quick suggestion chips from recent items/locations — FR-032 / US-031, **in progress** (decided 2026-10-24); purely client-side, §1.11 behavior unchanged. |

---

## 1. Page specifications

### 1.1 Landing page

| Field | Value |
|---|---|
| Route | `/` (public) |
| Purpose | Set honest expectations (a memory/record system, **not** live tracking) and convert visitors into sign-ups; establish the console visual language. |
| FR refs | Context: PRD §1, §3; no direct P0 FR. |

**Layout regions:** `PublicShell` → `SiteHeader` (wordmark, "Sign in" ghost button, "Create account"
primary button) → `Hero` → `ProductPreview` → `ValueProps` → `PrinciplesStrip` → `SiteFooter`.

**Key components:** `Button` (primary/secondary), `Card`, `Badge`, `Separator`, Lucide icons
(`Search`, `MapPin`, `ShieldCheck`, `History`).

**Content rules:**
- Headline and copy describe "record where you put things" + "ask in plain language"; always
  phrased around *last recorded* location, never "live tracking" or "real-time position".
- `ProductPreview` uses a product screenshot placeholder — no AWS console screenshots or logos.
- No fabricated testimonials, customer logos, user counts, or success-rate claims.
- Footer: Privacy, Terms, Contact, "Data export & deletion" pointer (JTD-5).

**Interactions:** CTA → `/signup` and `/login`; all links keyboard reachable; page renders static
(no client fetch); `prefers-reduced-motion` disables hero motion (static hero otherwise).

**States:** Loading — static pre-render, no skeleton needed. Empty — n/a. Error — client error
boundary → generic error page (§1.14). Success — n/a. Permission-denied — an already
authenticated visitor hitting `/` is redirected to `/dashboard`.

### 1.2 Authentication pages (sign-up, login, recovery, verify)

| Field | Value |
|---|---|
| Routes | `/signup` · `/login` · `/forgot-password` · `/reset-password` · `/verify-email` |
| Purpose | Register, sign in, recover password, complete e-mail verification — the identity boundary for all data isolation. |
| FR refs | FR-001 (P0). |

**Layout regions:** `PublicShell` → centered `AuthCard` (max width 400 px) on `background`;
at ≥ 1024 px an optional navy brand panel sits left (no AWS branding). `PageHeader` omitted;
breadcrumbs omitted.

**Key components:** `Input`, `PasswordInput` (show/hide toggle with Lucide `Eye`/`EyeOff`),
`Button` (submit, full width), `FormField` + `ErrorMessage`, `Alert` (form-level errors),
`Separator`, links ("Forgot password?", "Create an account", "Back to sign in").

**Content rules:**
- Labels are always visible above inputs (never placeholder-only).
- Sign-up: e-mail + password + confirm password; password policy text rendered *below* the field.
- Errors are **generic** — invalid credentials never reveal whether an account exists (FR-001
  error conditions, no account enumeration).
- Verify page: 6-digit code entry + "Resend code" with countdown; copy explains where the code came
  from. Recovery: request (e-mail) → Supabase Auth link → `/reset-password` (new password + confirm).
- Each page carries one alternate-path link; no marketing content.

**Interactions:** React Hook Form + Zod; Enter submits; submit button shows spinner + `disabled`
while pending; on validation failure focus moves to the first invalid field; `429 RATE_LIMITED`
renders "Too many attempts — try again in Ns" from `Retry-After` (API_SPEC §1.6 rate limits);
successful sign-in redirects to `next` or `/dashboard`.

**States:** Loading — button spinner + disabled inputs; skeleton only for session-restore check.
Empty — n/a. Error — field-level messages associated via `aria-describedby` (see
[ACCESSIBILITY.md](ACCESSIBILITY.md#4-understandable)) plus form-level `Alert`; network error →
retryable Alert. Success — redirect (sign-up → `/verify-email`; verified → `/login`).
Permission-denied — authenticated user visiting `/login` or `/signup` → redirect `/dashboard`;
deleted account → blocked state (§0.4).

### 1.3 Onboarding (P1)

| Field | Value |
|---|---|
| Route | `/onboarding` (redirects to `/dashboard` when completed or skipped) |
| Purpose | Guided first run: seed locations → first item → try an example question; ≤ 3 steps, skippable, never repeated (FR-030). |
| FR refs | FR-030 (P1), FR-015.2 (empty state), FR-017, FR-002. |

**Layout regions:** `AppShell` (sidebar visible but step content is the focus) → `StepHeader`
(step counter + progress indicator) → `StepBody` → `StepFooter` (Back / Next / Skip).

**Key components:** `Stepper` (3 steps), suggestion chips (pre-filled location names),
`Input`/`Textarea`, `Button`, `Card`, example-question chips.

**Content rules:** Step 1 "Create your locations" with pre-filled suggestions (Home, Bedroom,
Kitchen, Garage…) — user may accept, edit, or add; enforce depth ≤ 3 and sibling uniqueness
server-side with inline errors (FR-017). Step 2 "Add your first item" (name required,
optional starting location). Step 3 "Try asking" with 3 example questions that prefill the
assistant composer and open `/assistant`. Copy is plain, non-judgmental, no jargon.

**Interactions:** Skip at any step → confirm-less redirect to `/dashboard` and mark onboarding
complete (never repeated); Back preserves entered data; completing step 3 lands on `/assistant`
with the question prefilled; completion always reachable from the dashboard empty state.

**States:** Loading — skeleton per step (data hydrates from `/api/locations`, `/api/items`).
Empty — expected for new users (this *is* the empty path). Error — inline field errors + retry on
fetch failure. Success — toast "All set" + redirect `/dashboard`.
Permission-denied — not signed in → sign-in redirect; signed in and already onboarded → redirect
`/dashboard`.

### 1.4 Main dashboard

| Field | Value |
|---|---|
| Route | `/dashboard` |
| Purpose | The product's home surface: orientation (what I have, what changed), quick search, AI entry point, quick actions, and first-run guidance (FR-015, PRD C-6). |
| FR refs | FR-015 (P0), FR-005, FR-006, FR-002, FR-003. |

**Layout regions:** `AppShell` → `PageHeader` ("Dashboard", no breadcrumbs) → `QuickSearchBar`
→ `StatCardsRow` → two-column `Content` (`RecentItemsCard` | `RecentLocationsCard`) →
`AssistantEntryCard` + `QuickActionsCard`.

**Key components:** `Card`, `StatCard`, `Button`, `Input` (search with Lucide `Search`),
`Badge`, `Table` (compact) or list rows, `EmptyState`, `Skeleton`, `Alert` (inline retry).

**Content rules:** Full requirements in §2 (Dashboard requirements). Summary: total active items,
recently updated items (last 7 days), recently recorded location events, quick search, AI
assistant entry point, quick actions (Add item, Record location), onboarding empty state. Every
number is a stored-data count; timestamps use relative labels with absolute values in `title`/tooltip.

**Interactions:** Quick search submits to `/search?q=`; AI entry point → `/assistant`;
"Add item" → `/inventory/new`; "Record location" opens the record-location dialog (§1.9) with an
item picker; list rows navigate to `/inventory/:itemId`; all cards load independently so a single
failure does not blank the page.

**States:** Loading — per-card skeletons (same geometry). Empty — onboarding empty state with
guided first steps (§2.3). Error — per-card inline error + Retry; other cards still render
(FR-015 error condition). Success — no navigation; toasts only for actions started here.
Permission-denied — session expired → sign-in redirect; deleted account → blocked state.

### 1.5 AI memory assistant

| Field | Value |
|---|---|
| Routes | `/assistant` (new/current conversation) · `/assistant/:conversationId` (history) |
| Purpose | Natural-language recall and capture grounded strictly in the user's records, with clarification on ambiguity and confirmation before any write. |
| FR refs | FR-006, FR-007, FR-008, FR-009, FR-010, FR-013, FR-023, FR-024 (all P0). |

**Layout regions:** `AppShell` → `PageHeader` ("Assistant", actions: New conversation, conversation
list toggle) → `ConversationList` side panel (≥ 1024 px; `Sheet` below) → `MessageThread`
(scroll, `aria-live` polite for replies) → `Composer` (fixed bottom) → optional `FallbackBanner`.

**Key components:** `MessageBubble` (role-distinct), `CitationChip`, `CandidateButtons`,
`PendingActionCard`, `SuggestedQuestionChips`, `Textarea` + send `Button`, `Skeleton`,
`Alert` (error + Retry), `Badge` (status), `Dialog` (delete conversation).

**Content rules:** Detailed behavior in §4 (AI assistant interface). Non-negotiables: answers cite
source records and link to item detail; "last recorded … may have been moved since" caveat
(caveat required by FR-008); recorded facts vs inferred suggestions visually and textually distinguished;
no answer may contain IDs/names/timestamps not present in retrieved records (FR-010);
conversation deletion is a hard delete of its messages (FR-023, BR-09) behind a confirm dialog.

**Interactions:** Enter sends, Shift+Enter newline; composer disabled while a reply is pending;
suggested questions hidden when the preference is off (FR-021); citation chips open
`/inventory/:itemId` (event citations anchor the timeline row); candidate buttons continue the
clarification (max 2 rounds, then deterministic search link — FR-009); `pendingAction` Confirm /
Cancel / edit-before-confirm; New conversation resets the thread; Delete conversation requires
confirmation and navigates to `/assistant`.

**States:** Loading — composer remains usable; typing indicator + skeleton reply inside the thread;
`aria-live` announcement. Empty — welcome state with 3–5 suggested example questions and a line
stating the assistant answers only from your records. Error — `503 AI_UNAVAILABLE` renders the
fallback banner with deterministic results for the same query + **Retry** (FR-013, API_SPEC §3.6);
`409 CONFLICT` on expired/unknown `pendingAction` marks the card expired with "Ask again" action;
`429` → rate-limit message with `Retry-After`. Success — reply appended, citations rendered,
pending writes confirmed via toast with links to created records. Permission-denied — sign-in
redirect; the assistant never shows another user's records (FR-012, FR-007.3).

### 1.6 Inventory list

| Field | Value |
|---|---|
| Route | `/inventory` |
| Purpose | Browse, search, filter, sort, and act on all items — the primary management surface. |
| FR refs | FR-002, FR-005, FR-016, FR-019 (P1 aliases), FR-012. |

**Layout regions:** `AppShell` → `PageHeader` ("Inventory", breadcrumb root for nested pages,
primary action "Add item") → `Toolbar` (search input, filters, sort, result count) →
`TableWrap` (TanStack Table) → `Pagination` → `RowActionMenu` (per row).

**Key components:** `Table`, `Input` (debounced search), `Select`/`Combobox` (status, category,
location filters), `Button`, `Badge`, `DropdownMenu` (row actions), `Dialog` (destructive confirm),
`Toast`, `Pagination`, `Skeleton`, `EmptyState`.

**Content rules:** Columns and behaviors are specified in §3 (Inventory table). Duplicates are
**allowed but warned** (FR-002.4) — never hard-blocked in the UI. Archived items are excluded
from default views (status filter `active` default) and restorable (FR-016).

**Interactions:** Debounced search (300 ms) syncs to `?q=`; sortable headers toggle
asc/desc with `aria-sort`; row click opens `/inventory/:itemId` (action buttons stop propagation);
"Add item" → `/inventory/new`; row actions: View, Record location (dialog), Edit, Archive/
Restore, Delete (destructive dialog → toast with **Undo** restore within the 30-day retention
window, FR-016 / BR-07). Keyboard: rows reachable by Tab; `Enter` opens the focused row.

**States:** Loading — skeleton table with 10 placeholder rows. Empty — two variants: *no items yet*
("Add your first item" primary CTA) vs *no matches* (clear-filters secondary CTA). Error — inline
error + Retry above the table, toolbar stays usable. Success — optimistic row updates with toast
for archive/restore/delete. Permission-denied — sign-in redirect; foreign ID → 404.

### 1.7 Item detail

| Field | Value |
|---|---|
| Route | `/inventory/:itemId` |
| Purpose | Single source of truth for one item: identity, current derived location, full append-only history, correction actions. |
| FR refs | FR-002, FR-003, FR-004, FR-011, FR-016, FR-025 (P1 image), FR-019 (P1 aliases). |

**Layout regions:** `AppShell` → `PageHeader` with breadcrumbs
(Inventory › *item name*) and actions (Edit, Record location, ⋯ menu: Archive/Restore, Delete) →
`ItemSummaryCard` → two-column `Content` (`FactsCard` + `LastLocationCard` | `TimelineCard`
embedded history, §1.10) → optional `ImageCard` (P1).

**Key components:** `Card`, `Badge` (record status, archived, source), `Button`, `Timeline`
(embedded), `Dialog` (delete confirm), `Alert`, `Table` (facts), `Skeleton`, `EmptyState`.

**Content rules:** Show name, category (or "No category"), description, created/updated timestamps,
`createdVia` source when `ASSISTANT` (FR-002.5), and the **derived** last recorded location with
`occurredAt` + caveat line "Last recorded — the item may have moved since." The item's location is
always derived from the newest event; never displayed as a stored, authoritative field (FR-003.3).
Aliases (P1) and image (P1, alt-text rules per [ACCESSIBILITY.md §2.2](ACCESSIBILITY.md#22-text-alternatives))
render in dedicated cards when present.

**Interactions:** Edit → `/inventory/:itemId/edit`; Record location → dialog (§1.9); timeline rows
are linkable anchors (`#event-<id>`) cited from the assistant; Delete → destructive `Dialog`
explaining soft delete + 30-day restore → toast with Undo (FR-016); Archive → confirm-light toast
with Undo; failed archive because of referenced locations shows the server count message (409).

**States:** Loading — header + card skeletons. Empty — item with **no location events** shows an
empty timeline with "Record where you put it" CTA (this is legitimate: items may be created
without a location). Error — `404` → not-found state (item may be deleted or not yours, FR-012);
other errors → inline retry. Success — toasts for each mutation; timeline appends new events.
Permission-denied — sign-in redirect or 404 treatment as above.

### 1.8 Create / edit item

| Field | Value |
|---|---|
| Routes | `/inventory/new` (create) · `/inventory/:itemId/edit` (edit) |
| Purpose | Capture or correct item identity fields, optionally with an initial location in one step. |
| FR refs | FR-002, FR-003 (initial location), FR-011 (correction), FR-019 (P1 aliases). |

**Layout regions:** `AppShell` → `PageHeader` with breadcrumbs
(Inventory › New item / *item* › Edit) → centered `FormCard` (max 720 px).

**Key components:** `Form` (React Hook Form + Zod), `Input` (name), `Textarea` (description),
`Combobox` (category suggestions + free text), `LocationPicker` (searchable hierarchy combobox
with **create-inline** option), `FormField` + `ErrorMessage`, `Button` (Cancel / Save),
duplicate-name `Alert` (warning), `Skeleton` (edit hydration).

**Content rules:** Name required, 1–120 chars (FR-002.1); description optional; category optional
(lowercase free text); initial location optional and labeled "Where is it right now? (optional)".
Duplicate normalized name for the same owner → non-blocking **warning** with a link to the
existing item (FR-002.4); it never prevents saving. Archived locations are excluded from the
picker; if referenced anyway (raced), show the FR-003 error condition "unarchive or pick another".

**Interactions:** Unsaved-changes guard (browser confirm + in-app dialog) on navigation; Save
disables + spinner; on success → toast + redirect to the new/updated item detail; edit never
touches location events (FR-002.3) and the form says so in helper text ("Editing details never
changes your location history."); create-inline location flow opens a nested mini-dialog
(name + optional parent, depth ≤ 3, sibling uniqueness errors inline).

**States:** Loading — edit: form skeleton; create: immediate render. Empty — n/a. Error —
field errors (`VALIDATION_ERROR` details mapped per `path`), 409 conflict inline, network → retry
banner retaining input. Success — redirect + toast. Permission-denied — unauthenticated →
sign-in; foreign item → 404 state.

### 1.9 Location management

| Field | Value |
|---|---|
| Routes | `/locations` · `/locations/:id` (detail panel; deep-linkable) |
| Purpose | Maintain the simple location hierarchy (depth ≤ 3) used by pickers, search, and the assistant. |
| FR refs | FR-017 (P0), FR-003.2 (pickers), BR-04/BR-05 rules (hierarchy + archive). |

**Layout regions:** `AppShell` → `PageHeader` ("Locations", primary action "New location") →
two-pane `Content`: `LocationTree` (left, 340 px) | `LocationDetailPanel` (right) →
`SidePanel` becomes a `Sheet` < 1024 px.

**Key components:** `Tree` (accessible list with expand/collapse), `Button`, `Input`/`Textarea`,
`Dialog` (new/edit location, archive confirmation), `Badge` (archived), `Table` (referenced-by
summary), `EmptyState`, `Skeleton`, `Alert`.

**Content rules:** Name 1–80 chars; optional description; optional parent with **max depth 3**
(server error surfaced verbatim when exceeded); unique per owner among siblings (409 `CONFLICT`
→ inline "That name is already used at this level."). Archive is blocked while active items or
events reference the location — show the exact counts from the 409 body
(`referencedByItems`, `referencedByEvents`) with a link to those items (BR-05, FR-017.2).
Archived locations are hidden from pickers but visible via an "Include archived" toggle.

**Interactions:** Select node → panel loads detail + "Items last recorded here" list (derived from
stored events) → rows link to item detail; rename/re-parent inline in the panel (re-parent
re-validates depth); New location dialog supports parent pre-selection from the selected node;
keyboard tree navigation (arrows) per the tree pattern in
[ACCESSIBILITY.md](ACCESSIBILITY.md#6-specific-patterns).

**States:** Loading — tree skeleton + panel skeleton. Empty — "No locations yet" with suggested
starter locations (same seeds as onboarding). Error — inline retry for tree; rule violations
inline. Success — toast + tree refresh preserving selection. Permission-denied — sign-in redirect;
foreign `locationId` → 404.

### 1.10 Location history (timeline view)

| Field | Value |
|---|---|
| Routes | `/inventory/:itemId/history` (full timeline) · embedded `TimelineCard` on `/inventory/:itemId` (§1.7) |
| Purpose | Show the append-only record of where an item was placed, with provenance — history is the memory (FR-004). |
| FR refs | FR-004 (P0), FR-003 (record action), FR-011 (correction = append), FR-018 (P1 cross-item feed is separate). |

**Layout regions:** `AppShell` → `PageHeader` with breadcrumbs
(Inventory › *item* › Location history) → `TimelineToolbar` (record-location button, sort
newest-first default) → `TimelineList` → `Pagination` (events are paginated, newest first).

**Key components:** `Timeline` (ordered list), `TimelineEvent` (marker + content), `Badge`
(source `MANUAL`/`ASSISTANT`, confidence `CONFIRMED`/`INFERRED`), `Dialog` (record location),
`Button`, `EmptyState`, `Skeleton`.

**Content rules:** Each event shows: location name + full path, **occurredAt** ("Placed: 14 Oct
2026, 20:30"), **recordedAt** ("Recorded: 15 Oct 2026, 18:31" — may differ from occurredAt),
source badge, confidence badge, optional note. History is append-only: there is no edit or delete
control on events (FR-004.2); corrections happen by recording a **new** event (FR-011.2), and the
UI states this inline ("History can't be edited — record a new entry to correct it.").

**Interactions:** "Record location" dialog: `LocationPicker` (incl. create-inline), optional
backdated `occurredAt` (defaults to now; > +5 min in the future → validation error, FR-004.4),
optional note; on success the event appends to the timeline top with a highlight + toast. Event
anchors support citation deep links (`#event-<id>`). Filter by source (optional, low priority).

**States:** Loading — timeline skeleton (5 rows). Empty — "No location recorded yet" + primary
CTA "Record location". Error — inline retry; `VALIDATION_ERROR` on occurredAt shown inline.
Success — appended event highlighted; toast. Permission-denied — sign-in redirect; foreign item →
404.

### 1.11 Search results

| Field | Value |
|---|---|
| Route | `/search?q=<query>` (also reachable from the top-bar global search) |
| Purpose | Deterministic recall without the AI: ranked results over items and locations with visible match provenance — also the AI fallback destination (FR-005, FR-013). |
| FR refs | FR-005 (P0), FR-020 (P1 "did you mean"), FR-013 (fallback link target). |

**Layout regions:** `AppShell` → `PageHeader` ("Search") with the query echoed in a large
`SearchInput` → `FilterTabs` (All / Items / Locations) → `ResultsList` (two sections) →
`Pagination`.

**Key components:** `Input`, `Tabs`, `Card`/`ResultRow`, `Badge` (match type), `Button`,
`EmptyState`, `Skeleton`, `Alert`.

**Content rules:** Result rows show item name, category, last recorded location + timestamp, and a
**match-type badge**: `exact` | `prefix` | `fuzzy` | `fulltext` (API_SPEC §3.5 `matchType`).
Ranking: exact > prefix > fuzzy > full-text, archived below active (FR-005.2). Locations results
show their path and depth. Query < 2 chars → no request, prompt "Keep typing — 2 characters
minimum."; query > 200 chars → truncated with an inline notice (FR-005 error conditions).
P1: "Did you mean …?" suggestion from trigram scoring (FR-020). Fallback arrivals (from the
assistant outage banner) render an informational `Alert` explaining results are deterministic
search because the assistant is unavailable.

**Interactions:** Submitting the top-bar search navigates here (URL is the state, shareable);
refining re-queries without losing scroll; result rows → item/location detail; empty state offers
`Create item "<query>"` → `/inventory/new?name=`.

**States:** Loading — skeleton result rows. Empty — helpful empty state with suggestions
(create item / refine query) per FR-005.4. Error — inline retry (rate limit shows `Retry-After`).
Success — count line ("N results") — a stored-data count, nothing more.
Permission-denied — sign-in redirect; results are always owner-scoped (FR-012).

### 1.12 Activity history (P1)

| Field | Value |
|---|---|
| Route | `/activity` |
| Purpose | Cross-item "what changed" chronological feed (last 30 days) for the MRU recall pattern. |
| FR refs | FR-018 (P1). Hidden from the primary sidebar until enabled, but specified now. |

**Layout regions:** `AppShell` → `PageHeader` ("Activity") → `FilterBar` (type: all / location
events / item changes) → `FeedList` → `Pagination`.

**Key components:** `FeedItem` (icon + text + link), `Tabs`/`Select` (filter), `Badge` (source,
confidence), `Timeline` reuse, `EmptyState`, `Skeleton`.

**Content rules:** Each entry links the item and the location it references and shows occurredAt vs
recordedAt for events. Window is fixed to the last 30 days with an explicit label — no invented
trends or aggregations beyond counts derivable from stored rows.

**Interactions:** Filter persists in `?type=`; rows open item detail (anchor to the event);
pagination via `limit`/`offset`.

**States:** Loading — feed skeleton. Empty — "Nothing in the last 30 days" + link to inventory.
Error — inline retry. Success — plain list, no toasts. Permission-denied — sign-in redirect.

### 1.13 Settings & privacy

| Field | Value |
|---|---|
| Routes | `/settings` (profile + preferences) · `/settings/privacy` (privacy & data) |
| Purpose | Account identity, display preferences, and the privacy/exit promises: review conversations, export, delete account. |
| FR refs | FR-001 (session), FR-021 (P1 preferences), FR-022 (P1 export), FR-014 (P1 deletion), FR-023 (conversation deletion), FR-012. |

**Layout regions:** `AppShell` → `PageHeader` ("Settings", breadcrumb root) → `SettingsNav`
(horizontal `Tabs` on ≥ 768 px; vertical nav list below) → `SettingsPanel` per tab
(Profile · Preferences · Privacy & data).

**Key components:** `Tabs`, `Form` + `Input` (display name), `Select`/`RadioGroup` (theme:
Light / Dark / System), `Switch` (show suggested questions), `Button`,
`Dialog` (destructive: delete conversation confirm, delete account confirm), `Alert`,
`Table` (data summary), `Badge`.

**Content rules:** Privacy tab explains, in plain language: what is stored (items, locations,
events, conversations), retention (soft-deleted items purged after 30 days per BR-07), that
conversation content is never written to logs (FR-023.3), and how to export or delete. Export
(P1) downloads JSON for the authenticated owner only and notes `includeConversations=false`
default. Delete account (P1) states the exact consequence: sign-in blocked immediately, 7-day grace
period, then full purge (FR-014.1) — the confirmation dialog requires typing the e-mail address.
Theme preference is P0-visible as a control with Light default; persistence lands with FR-021 (P1)
— until then the toggle is local-session only (documented, not hidden).

**Interactions:** Every destructive action requires a `Dialog` with explicit consequence copy;
export shows a progress state then a download toast; changing theme applies instantly with no page
reload; session state (signed in as *e-mail*) always visible.

**States:** Loading — panel skeletons per tab. Empty — privacy tab still renders explanatory copy
even with zero data. Error — inline retry; `429` on repeated deletion requests → "already
requested" idempotent success message (FR-014.4). Success — toasts; account deletion navigates to
a goodbye/blocked state + sign-out. Permission-denied — sign-in redirect; deleted account →
blocked state with no access to settings.

### 1.14 Error and not-found pages (404, 500, maintenance)

| Field | Value |
|---|---|
| Routes | `app/not-found.tsx` → 404 · `app/error.tsx` → 500 (client boundary) · maintenance page served on 503 |
| Purpose | Keep the user oriented and actionable when something breaks — never a blank screen, never leaked internals. |
| FR refs | FR-012 (404 semantics), FR-013 (AI outage ≠ site outage), API_SPEC §2 (error envelope). |

**Layout regions:** `AppShell` for 404 inside the app (sidebar preserved) or `PublicShell` for
public 404/500 → centered `ErrorState` (icon, title, explanation, actions) + optional technical
`details` disclosure showing `requestId`.

**Key components:** `ErrorState` (Lucide `FileQuestion` / `TriangleAlert` / `Wrench`),
`Button` (primary "Back to Dashboard", secondary "Retry"), `Alert`, collapsible `requestId` row.

**Content rules:**
- **404** — "We can't find that page or record." It may have been deleted, or it isn't yours
  (FR-012: identical treatment, no existence leaks). Actions: Back to Dashboard, Search inventory.
- **500** — "Something went wrong on our side." Show `requestId` for support; never stack traces,
  provider messages, or SQL (API_SPEC §2 `INTERNAL`).
- **Maintenance** — expected downtime copy with a "Try again" action; explicitly states inventory
  data is safe. Distinct from the AI-degradation state: if only the assistant is degraded, users
  stay inside the app with the fallback banner (FR-013) rather than seeing this page.
- Wording is plain and non-accusatory; no AWS branding or infrastructure details.

**Interactions:** Retry re-runs the failed navigation/request; Back to Dashboard always present for
authenticated contexts; global `error.tsx` boundary resets on route change.

**States:** Loading — n/a (rendered after failure). Empty — n/a. Error — this *is* the error
surface. Success — n/a. Permission-denied — 401 renders sign-in redirect (or the blocked
deleted-account state), not this page.

---

## 2. Dashboard requirements

### 2.1 Required content (FR-015.1 — exhaustive)

| # | Element | Data source (stored-data only) |
|---|---|---|
| 1 | **Total active items** | Count of non-deleted items with status active |
| 2 | **Recently updated items** (last 7 days) | Items with `updatedAt` within 7 days, newest first, capped at 5 with "View all" → `/inventory?sort=updatedAt` |
| 3 | **Recent recorded locations** (last 7 days) | Location events with `recordedAt` within 7 days, newest first, capped at 5 → `/activity` (P1) or item detail |
| 4 | **Quick search** | Client control → `/search?q=` |
| 5 | **AI assistant entry point** | Card/button → `/assistant` with one example prompt |
| 6 | **Quick actions** | "Add item" → `/inventory/new`; "Record location" → record-location dialog |
| 7 | **Onboarding empty state** | Shown when the user has 0 items and 0 locations (§2.3) |

### 2.2 Explicitly forbidden

No percentages, trends, scores, "health", "accuracy", usage charts, or any figure not directly
countable from stored rows (FR-015.3). No AI-quality claims. No third-party analytics widgets.

### 2.3 Onboarding empty state (FR-015.2)

Rendered instead of cards 1–3 when both counts are zero: `EmptyState` with title "Let's record your
first things", supporting copy, three guided steps (Add a location · Add an item · Ask the
assistant), primary CTA "Start setup" → `/onboarding` (P1; until FR-030 ships, the same steps link
directly to `/locations`, `/inventory/new`, `/assistant`), secondary "Skip — explore the dashboard".

### 2.4 Aggregation behavior

Cards load independently in parallel; a failure in one shows an inline error + Retry in that card's
slot while the rest render (FR-015 error condition, partial failure rule). All counts and lists are
owner-scoped server-side (FR-012).

---

## 3. Inventory table

### 3.1 Columns (TanStack Table v8)

| # | Column | Key / source | Width | Behavior |
|---|---|---|---|---|
| 1 | **Item name** | `item.name` | flex, min 220 px | Left aligned; row link to `/inventory/:itemId`; archived items also show an `Archived` badge inline; duplicates are not flagged in the table (only warned at entry time) |
| 2 | **Category** | `item.category` | 140 px | Lowercase free text; empty → em dash with visually-hidden "No category"; filterable via toolbar |
| 3 | **Last recorded location** | derived `lastLocation.name` (+ path in tooltip) | 240 px | Derived from newest event (`occurredAt`); null → "Never recorded" |
| 4 | **Last recorded timestamp** | derived `lastLocation.occurredAt` | 170 px | Relative label ("2 days ago") with absolute RFC 3339 value in `title` and `<time datetime>`; sortable |
| 5 | **Record status** | derived | 140 px | Badge set — `Recorded` (success), `Never recorded` (neutral outline), plus `Archived` (muted) when lifecycle status is archived; status is never conveyed by color alone (icon + text) |
| 6 | **Actions** ⋯ | — | 56 px | `DropdownMenu` trigger; not a data column (hidden from screen-reader column headers) |

### 3.2 Toolbar: search, filters, sort, pagination

- **Search:** debounced (300 ms) input bound to `?q=`, server-side per `GET /api/items?q=`
  (FTS + trigram, FR-005). < 2 chars → no request.
- **Filters:** status `active | archived | all` (default `active`), `category` select built from
  distinct stored categories, `locationId` hierarchy `Combobox` (non-archived only). Active filters
  render as removable chips with a "Clear all" action.
- **Sort:** `name | updatedAt | lastRecordedAt`, order `asc|desc` (API_SPEC §3.2), driven by
  TanStack Table column headers; state mirrored in the URL for shareable views.
- **Pagination:** `limit`/`offset` per API_SPEC §1 (default 20, max 100); page-size selector
  20 / 50 / 100; result total shown as "N items" (stored-data count only).
- **Row actions:** View, Record location, Edit, Archive/Restore, Delete (destructive `Dialog` →
  toast with **Undo** restore inside the 30-day retention window, FR-016 / BR-07).

### 3.3 Responsive fallback and accessibility

- **< 768 px** the table becomes a **card list**: one card per item showing name + status badge,
  category, last recorded location, timestamp, and a trailing actions menu (see
  [WIREFRAMES.md §11](WIREFRAMES.md#11-mobile-inventory-card-list)). Sorting and filtering move into a
  bottom `Sheet` ("Filter & sort"); pagination becomes "Load more" + count.
- Table semantics: `<caption>` (visually hidden), `scope="col"` headers, `aria-sort` on sortable
  headers, `Enter`/`Space` activation on row links, visible focus rings, 44 px touch targets on
  mobile cards. Full rules in [ACCESSIBILITY.md](ACCESSIBILITY.md#6-specific-patterns).

---

## 4. AI assistant interface

### 4.1 Conversation area

- Single-column thread inside `Main`; messages newest at the bottom, auto-scrolled, history loaded
  paginated from `GET /api/assistant/conversations/:id`.
- **User vs assistant messages are distinct by layout, label, and icon — not color alone:** user
  messages right-aligned with a `User` icon and visible "You" label; assistant messages left-aligned
  with a `Sparkles`/`Bot` icon and "Assistant" label, plus a left accent rule.
- Long answers clamp with "Show more"; code-free plain prose; timestamps shown per message
  (`<time datetime>`).

### 4.2 Suggested example questions

- Rendered as chips above the composer in an **empty conversation only**: "Where did I last put my
  motorcycle keys?", "What's in the bedroom drawer?", "I put my wallet in the bedroom drawer".
- Chips fill the composer without sending; they are hidden when the *show suggested questions*
  preference is off (FR-021).

### 4.3 Loading indicator

- On send: composer keeps focus, send button becomes a stop/disabled state, and an inline
  typing indicator appears with the announced text "Assistant is thinking" (`aria-live="polite"`).
- Optional staged hint after ~2 s: "Searching your records…" — informational only, no fabricated
  progress percentages. Target reply latency p95 < 6 s (PRD §10).

### 4.4 Error and retry (FR-013, API_SPEC §3.6)

- `503 AI_UNAVAILABLE` → assistant turn is replaced by a **degradation banner**: "The assistant is
  temporarily unavailable. Your records are safe." plus the deterministic `fallback.results` list
  (name + last location + timestamp) and two actions: **Retry** (re-sends the same message) and
  **Open full search** (`/search?q=<fallback.searchQuery>`). Inventory, search, and history remain
  fully usable — the banner never blocks the app.
- Other failures (`429`, `500`, timeout) → inline error bubble with **Retry**; the typed message is
  preserved in the composer.

### 4.5 Source records (citations)

- Every data-dependent reply renders `citations` as chips under the text: item chips
  (type `item`) → `/inventory/:itemId`; event chips (type `event`) → the item's timeline anchored
  at `#event-<id>` with the `occurredAt` value visible in the chip label.
- Chips are keyboard focusable links; a reply with citations shows the line "Based on N recorded
  entries."

### 4.6 Recorded facts vs inferred suggestions

- **Recorded fact** — text backed by a cited record: `Badge` variant `success` + `Database` icon +
  label "Recorded". Includes the mandatory caveat wording: "last recorded … may have moved since"
  (FR-008.1).
- **Inferred suggestion** — anything not directly recorded (e.g., a best-guess container): rendered
  in a bordered note block with `Badge` variant `warning` + `Lightbulb` icon + label "Suggestion —
  not recorded". Inferences must never appear as plain body text, and must never include
  invented IDs, names, or timestamps (FR-010).
- **No records found** — explicit statement ("I don't have a record for that.") plus next steps
  (record it / refine the question), never a guess.

### 4.7 Clarification for ambiguity (FR-009)

- When the reply contains `candidates`, render **candidate buttons** (item name + optional reason)
  under the question "Which one did you mean?". Selecting a button sends a structured continuation
  message; the thread shows the selection as a user message.
- After the 2nd clarification round, auto-append an "Open search instead" link (FR-009.4).
- Candidates are stored data only — every option must be an item the user owns.

### 4.8 Confirmation UI for proposed writes (FR-024, `pendingAction`)

- Replies with `status = PENDING_ACTION` render a **confirmation card** containing: action type
  label ("Record location" / "Create item" / "Correct location"), item (existing name or proposed
  name), location path, `occurredAt` (editable before confirming), an **expires in 24 h** note with
  `expiresAt` value, and actions **Confirm** and **Cancel** (plus "Edit details" for
  `locationId`/`occurredAt` overrides via `overrides` on
  `POST /api/assistant/actions/:actionId/decision`).
- Confirm → button spinner → success toast with links to the created/updated records; the card
  flips to a "Recorded ✓" summary with links. Nothing is written before confirmation (FR-024.2);
  the card states "Nothing has been saved yet." before the first Confirm.
- Cancel → card flips to "Cancelled" (terminal, no write).
- Expiry/unknown action (`409 CONFLICT`) → card shows "This proposal expired" with **Ask again**
  (re-sends the original message). Pending actions are **never** auto-executed (FR-024.3).

### 4.9 Conversation reset and history (FR-023, privacy BR-09)

- `ConversationList` (side panel ≥ 1024 px, `Sheet` below): title or first message excerpt +
  `lastMessageAt`; active conversation highlighted; **New conversation** button starts a blank
  thread (`/assistant` without an id).
- **Delete conversation** → destructive `Dialog`: "This permanently deletes the messages in this
  conversation. It cannot be undone." → `DELETE /api/assistant/conversations/:id` (hard delete,
  BR-09 via FR-023) → toast, navigate to a fresh conversation.
- Conversation content never appears in toasts, titles beyond the excerpt, or logs (FR-023.3);
  the document title shows "Assistant — SmartHomeAI", not message text.

---

## 5. Responsive behavior and breadcrumbs

### 5.1 Breakpoints (from [DESIGN_SYSTEM.md §4](DESIGN_SYSTEM.md#4-breakpoints))

`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536` — see
[DESIGN_SYSTEM.md §4](DESIGN_SYSTEM.md#4-breakpoints).

### 5.2 Shell behavior

| Viewport | Behavior |
|---|---|
| ≥ 1024 px (`lg`) | Persistent deep-navy sidebar (240 px; collapsible to 64 px icon rail with tooltips), top bar with global search, notifications slot (reserved, unused in MVP), account menu, help link. |
| < 1024 px | Sidebar collapses into a `Sheet` **drawer** opened from the top-bar menu button; drawer traps focus and closes on `Esc` or scrim click. Top bar keeps search (icon expands to full-width input) + account menu. |
| < 768 px (`md`) | Tables → card lists (§3.3); two-column dashboard and item-detail grids stack; toolbar controls move into a filter `Sheet`; conversation list becomes a full-screen `Sheet`; composers stick above the safe area. |
| < 640 px (`sm`) | Page padding reduces to 16 px; stat cards become a horizontal scroll row or 2-column grid; dialogs become full-width bottom sheets. |

Content max width 1280 px; touch targets ≥ 44 × 44 px; no horizontal scrolling of the page body.

### 5.3 Breadcrumb rules

- **Shown** on nested routes only: `/inventory/:itemId`, `/inventory/:itemId/edit`,
  `/inventory/:itemId/history`, `/inventory/new`, `/settings/privacy`.
- **Format:** `Inventory › Item name › Location history`; the final crumb is plain text (current
  page), all ancestors are links; separators are `ChevronRight` icons marked `aria-hidden`.
- Item-name crumb truncates at 40 chars with the full value exposed to assistive tech.
- **Not shown** on `/dashboard`, `/assistant`, `/inventory`, `/locations`, `/search`, `/activity`,
  `/settings` (these are sidebar roots), nor on landing/auth/error pages.
- Breadcrumbs render inside `PageHeader`, above the page title on < 768 px to preserve width.
