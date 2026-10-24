# SmartHomeAI — Wireframes

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Design Agent |
| Scope | ASCII wireframes for the app shell, dashboard, inventory, item detail, forms, locations, assistant, search, settings, mobile views, and the empty dashboard |

> **Indicative, not pixel-specs.** These blocks communicate region hierarchy, relative placement,
> and information density only. Exact spacing, type sizes, and colors come from
> [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md); page behavior and states from
> [DESIGN_SPEC.md](DESIGN_SPEC.md); responsive rules from
> [DESIGN_SPEC.md §5](DESIGN_SPEC.md#5-responsive-behavior-and-breadcrumbs).
> Icons are named (Lucide) rather than drawn. `¹` marks P1-only regions.
> No AWS branding appears anywhere in these layouts (D7 / PRD C-5).

---

## 1. App shell (sidebar + top bar)

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ ☰  SmartHomeAI      [ ⌕ Search items and locations...          ]   ◇  ?   (avatar) ▾ │
├────────────────┬──────────────────────────────────────────────────────────────────────┤
│  DEEP NAVY     │  Breadcrumb (nested pages only):  Inventory › Motorcycle keys         │
│  SIDEBAR       │  ─────────────────────────────────────────────────────────────────── │
│                │  PageHeader:  Page title                    [ primary action ]  [⋯] │
│  ◤ Dashboard   │                                                                      │
│  ▣ Inventory   │  ┌────────────────────────────────────────────────────────────────┐  │
│  ◉ Locations   │  │                                                                                    │  │
│  ✦ Assistant   │  │                          MAIN CONTENT                          │  │
│  ⏱ Activity¹  │  │                    (max width 1280 px, centered)                │  │
│  ⚙ Settings   │  │                                                                                    │  │
│                │  └────────────────────────────────────────────────────────────────┘  │
│  ────────────  │                                                                      │
│  Collapse ⟲    │                                                                      │
└────────────────┴──────────────────────────────────────────────────────────────────────┘
```

**Annotations:** sidebar is persistent ≥ 1024 px and collapsible to a 64 px icon rail (labels stay
exposed to assistive tech); `< 1024 px` the sidebar becomes a `Sheet` drawer behind the `☰`
button. Top bar regions, left→right: menu (small screens only), wordmark, **global search**
(submits to `/search?q=`), **notifications slot** (reserved, unused in MVP), help `?`, account
menu avatar. Current nav item = accent background + left indicator bar + `aria-current="page"`.

---

## 2. Dashboard (cards grid)

```text
┌ PageHeader: Dashboard ────────────────────────────────────────────────┐
│ [ 🔍  Quick search — type and press Enter............ ]               │
└───────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────┐
│ Total active items  │ │ Updated (7 days)    │ │ Locations (7 days)  │ │ ✦ Ask the       │
│ 24                  │ │ 5                   │ │ 8                   │ │    assistant    │
│ items tracked       │ │ recently changed    │ │ events recorded     │ │ "Where are my…" │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘ └─────────────────┘

┌ Recently updated items ────── [View all] ┐ ┌ Recent recorded locations ─── [View all] ┐
│ ▣ Motorcycle keys     keys    2h ago     │ │ ◉ Home / Bedroom / Drawer   1h ago       │
│ ▣ Passport            docs    yesterday  │ │ ◉ Home / Garage / Shelf     3h ago       │
│ ▣ Laptop charger      elec    2 days ago │ │ ◉ Home / Entry / Hook       yesterday    │
│ ▣ Blue backpack       bags    3 days ago │ │ ...                                    │
└──────────────────────────────────────────┘ └──────────────────────────────────────────┘

┌ Quick actions ────────────────────────────────────────────────────────────────────────┐
│ [ + Add item ]    [ ⌖ Record location ]                                               │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** four-up stat row collapses to 2×2 at `md` and a horizontal scroll row at `sm`.
Only stored-data counts appear (FR-015.3) — no percentages or trends. Each card loads
independently; a failed card shows an inline error + Retry in its own slot. AI entry point is one
card among management cards (never a chatbot hero).

---

## 3. Inventory list (toolbar + table)

```text
┌ PageHeader: Inventory                                   [ + Add item ] ─────────────┐
│ [ 🔍 Search inventory................ ]  Status ▾  Category ▾  Location ▾  Sort ▾  │
│ Active filters: [category: keys ✕] [location: Home ✕]            Clear all · 24 items│
├────────────────────────────────────────────────────────────────────────────────────┤
│ Item name ᵃ   Category ᵃ   Last recorded location ᵃ  Last recorded ᵃ  Status ᵃ   ⋯ │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Motorcycle keys  keys      Home / Living room / Shelf   2 hours ago   ● Recorded   │
│ Passport         docs      Home / Bedroom / Drawer      yesterday     ● Recorded   │
│ Laptop charger   elec      —                            —             ○ Never rec. │
│ Blue backpack ᶜ  bags      Home / Entry / Hook          3 days ago    ● Rec. Archive│
├────────────────────────────────────────────────────────────────────────────────────┤
│ ‹ 1  2  3 ›        Rows per page: 20 ▾                     Showing 1–20 of 47       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** `ᵃ` = sortable header with `aria-sort` and a Lucide sort chevron; each row's name
is a link to `/inventory/:itemId` (whole row clickable, actions stop propagation); `⋯` opens the
row menu (View · Record location · Edit · Archive/Restore · Delete). Status is icon + text + color
(never color alone). Row hover = `--muted`; focus ring on each interactive cell. Archived rows only
appear when the status filter includes them. `< 768 px` → card list (§11).

---

## 4. Item detail (header + timeline)

```text
┌ Breadcrumb: Inventory › Motorcycle keys ────────────────────────────────────────────┐
│ Motorcycle keys                                              [ Record location ][Edit][⋯]│
│ keys · Created 12 Oct 2026 · Created via Assistant ✦                                    │
│ Status: ● Recorded                                                                     │
├───────────────────────────────┬──────────────────────────────────────────────────────┤
│ FACTS                         │ LOCATION HISTORY (append-only)                        │
│ Name     Motorcycle keys      │ ● ● 14 Oct 2026, 20:30  Home / Living room / Shelf    │
│ Category keys                 │   Placed 14 Oct 20:30 · Recorded 15 Oct 18:31         │
│ Description Spare key + fob   │   [MANUAL] [CONFIRMED]                       #event-e5│
│ Last recorded  Home / Living  │ ● ● 12 Oct 2026, 09:00  Home / Entry / Hook          │
│   room / Shelf (2 h ago)      │   Placed 12 Oct 09:00 · Recorded 12 Oct 09:02         │
│ ⚠ Last recorded — the item    │   [ASSISTANT] [CONFIRMED]                     #event-3a│
│   may have moved since.       │ ● ○ 10 Oct 2026, 18:00  Home / Garage (INFERRED)      │
│ [ P1: image thumbnail ]       │ ...                                       [ Load more ]│
│ [ P1: aliases: "bike key" ]   │ ✏ History can't be edited — record a new entry.       │
└───────────────────────────────┴──────────────────────────────────────────────────────┘
```

**Annotations:** two columns stack at `md`; the timeline is the same component embedded on this
page and rendered in full at `/inventory/:itemId/history`. Each event row is an anchor target
(`#event-<id>`) for assistant citations; timestamps use `<time datetime>` with relative labels.
`⋯` menu contains Archive/Restore and Delete (destructive dialog → toast with Undo).

---

## 5. Create / edit item

```text
┌ Breadcrumb: Inventory › New item ───────────────────────────────────────────────────┐
│                                                                                      │
│   ┌ Create item ────────────────────────────────────────────────────────────────┐   │
│   │ Item name *                                                                 │   │
│   │ [ Motorcycle keys........................................]  15/120          │   │
│   │                                                                             │   │
│   │ ⚠ "Motorcycle key" already exists —                                        │   │
│   │   [ View existing item ]                        (warning, never blocks)     │   │
│   │                                                                             │   │
│   │ Category                Description                                        │   │
│   │ [ keys..........▾ ]     [ Spare key + fob............................... ]  │   │
│   │                                                                             │   │
│   │ Where is it right now? (optional)                                           │   │
│   │ [ 🔍 Home / Living room / Shelf............................ ▾ ]             │   │
│   │   └─ Home › Living room › Shelf          [ + Create new location ]          │   │
│   │                                                                             │   │
│   │ Helper: Editing details never changes your location history.               │   │
│   │                                        [ Cancel ]   [ Save item ]           │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** dedicated pages (`/inventory/new`, `/inventory/:itemId/edit`); the dashboard
"Record location" quick action and item-row "Record location" open a compact `Dialog`/`Sheet`
variant of the location fields only. Errors render under their field (`aria-describedby`), the
first invalid field receives focus on submit, Save becomes a spinner while pending. Duplicate-name
copy is a warning with a link (FR-002.4). Create-inline location opens a nested mini-dialog.

---

## 6. Locations management (tree + panel)

```text
┌ PageHeader: Locations                                 [ + New location ] ───────────┐
├──────────────────────────────┬──────────────────────────────────────────────────────┤
│ LOCATION TREE                │ Home › Living room › Shelf          [ Edit ][Archive]│
│                              │ Description: Where keys and wallets usually go.      │
│ ▾ 🏠 Home                    │ ──────────────────────────────────────────────────── │
│   ▾ 🚪 Entry                 │ Items last recorded here (3)                         │
│     • Hook                   │ ▣ Motorcycle keys      2 hours ago                   │
│   ▾ 🛋 Living room           │ ▣ Wallet               yesterday                     │
│     ◆ Shelf ◀ (selected)     │ ▣ Spare glasses        6 days ago                    │
│   ▾ 🛏 Bedroom               │ ──────────────────────────────────────────────────── │
│     • Drawer                 │ Referenced by 2 events · 3 active items              │
│ ▸ 📦 Garage (collapsed)      │ Archive blocked until these move (409 shows counts)   │
│ ☐ Include archived           │                                                      │
│                              │ [+ New child location]   (depth ≤ 3: max reached →) │
└──────────────────────────────┴──────────────────────────────────────────────────────┘
```

**Annotations:** tree is an accessible disclosure list with arrow-key navigation; selection syncs
with the URL (`/locations/:id`) so the panel is deep-linkable. `< 1024 px` the panel becomes a
`Sheet` opened from the tree. Depth and sibling-uniqueness rules surface as inline errors with the
server's message; archive with references shows the exact counts from the 409 body and links to
the referencing items.

---

## 7. Assistant page (conversation + composer + confirmation card)

```text
┌ PageHeader: Assistant   [ New conversation ] [ ☰ history ] ─────────────────────────┐
├─ CONVERSATIONS (≥1024px) ─┬─────────────────────────────────────────────────────────┤
│ ▸ Where are my keys?      │  YOU                                                    │
│   (last: 2 min ago)       │  Where did I last put my motorcycle keys?              │
│ ▸ Passport location       │                                                         │
│ ▸ (untitled)              │  ASSISTANT                          [Recorded] ✓        │
│                           │  Your last recorded entry says the keys were placed on │
│ [+ New conversation]      │  the living room shelf yesterday at 20:30. This is the  │
│                           │  last recorded location, so they may have moved since. │
│                           │  Based on 1 recorded entry:                            │
│                           │  [▣ Motorcycle keys] [⌖ event · 14 Oct 20:30]           │
│                           │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                           │  YOU                                                   │
│                           │  I put my wallet in the bedroom drawer                │
│                           │                                                         │
│                           │  ASSISTANT — CONFIRMATION CARD                         │
│                           │  ┌ Record location ─────────────────────────────────┐  │
│                           │  │ Item      Wallet                                 │  │
│                           │  │ Location  Home / Bedroom / Drawer                │  │
│                           │  │ When      15 Oct 2026, 19:00  [ change ]          │  │
│                           │  │ ⏳ Expires in 24 h (16 Oct, 19:00)                │  │
│                           │  │ ⚠ Nothing has been saved yet.                    │  │
│                           │  │            [ Cancel ]   [ Confirm ]               │  │
│                           │  └───────────────────────────────────────────────────┘  │
├───────────────────────────┴─────────────────────────────────────────────────────────┤
│ Suggested: [ Where are my keys? ] [ What's in the bedroom drawer? ]                 │
│ ┌ Message composer ................................................. [ ➤ Send ] ┐ │
│ └ Enter to send · Shift+Enter for a new line ────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** user/assistant messages differ by alignment, visible role label **and** icon —
never color alone. Citations are links (item → detail, event → timeline anchor). Inferred
suggestions appear in a bordered note with a "Suggestion — not recorded" warning badge. During a
reply: composer disabled + typing indicator with `aria-live` announcement. On `503 AI_UNAVAILABLE`
the confirmation/thread area is replaced by the degradation banner: "The assistant is temporarily
unavailable. Your records are safe." + fallback results + **Retry** / **Open full search**.
Delete conversation lives in the history menu behind a destructive dialog (hard delete, BR-09).

---

## 8. Search results

```text
┌ PageHeader: Search ─────────────────────────────────────────────────────────────────┐
│ [ 🔍 motoorbike keys..............................✕ ]          Did you mean          │
│                                                                "motorcycle keys"?    │
│ ( All · Items 12 · Locations 3 )                              [ try it ]            │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ℹ Results from deterministic search — the assistant is temporarily unavailable.    │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ITEMS                                                                                │
│ ▣ Motorcycle keys     keys      Home / Living room / Shelf    2 hours ago  [ fuzzy ] │
│ ▣ Motorcycle key sp.  keys      Home / Entry / Hook           12 Oct       [ exact ] │
│ ▣ Keyring (archived)  keys      Home / Garage                 30 Sep       [ prefix] │
├────────────────────────────────────────────────────────────────────────────────────┤
│ LOCATIONS                                                                            │
│ ◉ Home / Living room / Shelf        depth 3                    [ fulltext ]         │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ‹ 1  2 ›                                                                            │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** the query lives in the URL (`/search?q=`); match-type badges expose ranking
provenance (exact > prefix > fuzzy > fulltext, archived demoted). The info banner appears **only**
when the user arrives via the assistant fallback (F-11). Empty result state offers
"Create item `\"<query>\"`" and "Clear filters". Items and locations are visually separated sections
with headings, not one mixed list.

---

## 9. Settings & privacy

```text
┌ PageHeader: Settings ───────────────────────────────────────────────────────────────┐
│ [ Profile ]  [ Preferences ]  [ Privacy & data ]                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│ PROFILE                                                                             │
│ Signed in as        sam@example.com                                                 │
│ Display name        [ Sam Talwar......................... ]   [ Save ]              │
│                                                                                     │
│ PREFERENCES (P1)                                                                    │
│ Theme               ( • Light ) ( ○ Dark ) ( ○ System )      ← instant, no reload   │
│ Suggested questions [ ▮ ON ]  hide/show assistant example questions                 │
│                                                                                     │
├────────────────────────────────────────────────────────────────────────────────────┤
│ PRIVACY & DATA                                                                      │
│ What's stored     Items, locations, location events, conversations                 │
│ Retention         Deleted items are restorable for 30 days, then purged (BR-07)     │
│ Logging           Conversation content is never written to application logs         │
│                                                                                     │
│ [ ⇩ Export my data (JSON) ]        P1 · downloads owner data only                   │
│ [ ✕ Delete my account ]            P1 · destructive                                 │
│   └ Dialog: 7-day grace, then full purge · type your e-mail to confirm              │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** horizontal `Tabs` ≥ 768 px, vertical nav list below. Every destructive action
opens a `Dialog` with explicit consequence copy (delete conversation / delete account), focus
initially on the non-destructive button. Privacy copy is plain language; no legal boilerplate is
invented here. Theme changes apply immediately and persist server-side when FR-021 ships.

---

## 10. Mobile dashboard (< 768 px)

```text
┌ ☰  SmartHomeAI   🔍 .........................  (avatar) ▾ ┐  ← top bar, sidebar = drawer
├───────────────────────────────────────────────────────────┤
│ Dashboard                                                 │
│ ┌ Quick search ──────────────────────────┐                │
│ │ 🔍 Where did I leave…                  │                │
│ └───────────────────────────────────────┘                │
│                                                           │
│ ┌ 24 ────────────┐ ┌ 5 ─────────────┐  ← horizontal scroll│
│ │ Active items   │ │ Updated (7d)   │    or 2-col grid     │
│ └────────────────┘ └────────────────┘                      │
│ ┌ 8 ─────────────┐ ┌ ✦ Ask ────────┐                       │
│ │ Locations (7d) │ │ the assistant │                       │
│ └────────────────┘ └────────────────┘                      │
│                                                           │
│ Recently updated items                        [ View all ]│
│ ▣ Motorcycle keys           keys            2 h ago       │
│ ▣ Passport                  docs            yesterday     │
│                                                           │
│ Recent recorded locations                     [ View all ]│
│ ◉ Home / Bedroom / Drawer                   1 h ago       │
│ ◉ Home / Garage / Shelf                     3 h ago       │
│                                                           │
│ ┌ + Add item ─────────┐ ┌ ⌖ Record location ┐             │
│ └─────────────────────┘ └───────────────────┘             │
└───────────────────────────────────────────────────────────┘
```

**Annotations:** single column; cards stack in the order of FR-015; touch targets ≥ 44 px; the
`☰` opens the navy sidebar drawer (focus-trapped `Sheet`); quick actions become full-width button
pairs; relative timestamps gain absolute values in tooltips/`<time>`.

---

## 11. Mobile inventory card list (< 768 px)

```text
┌ ☰  Inventory                          [ + ] 🔍 ────────────────────────────────────┐
│ Status ▾   Category ▾   Location ▾   Sort ▾        24 items      [ Filter & sort ] │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────────┐   │
│ │ Motorcycle keys                                   ● Recorded            ⋯  │   │
│ │ keys · Home / Living room / Shelf                                       │   │
│ │ Last recorded  2 hours ago                                              │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────────────────┐   │
│ │ Passport                                     ● Recorded               ⋯  │   │
│ │ docs · Home / Bedroom / Drawer                                         │   │
│ │ Last recorded  yesterday                                                │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌─────────────────────────────────────────────────────────────────────────┐   │
│ │ Laptop charger                             ○ Never recorded          ⋯  │   │
│ │ elec · No location recorded                                            │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│                     [ Load more — 20 of 24 ]                                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** one card per item (same fields as the table columns, no information loss); `⋯`
opens an action `Sheet` (View · Record location · Edit · Archive/Restore · Delete); sorting and
filtering move into a bottom `Sheet` behind **Filter & sort**; pagination becomes "Load more"
plus a stored-data count. Cards are full-width links with a nested menu button (separate hit
targets, correct nesting for screen readers).

---

## 12. Empty dashboard state (new user)

```text
┌ PageHeader: Dashboard ──────────────────────────────────────────────────────────────┐
│ [ 🔍 Quick search — nothing to search yet, but you can try ]                        │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│                    ┌ ┌─────────────────────────────────────────┐ ┐                  │
│                    │ │   ✦  Let's record your first things     │ │                  │
│                    │ │                                         │ │                  │
│                    │ │   1. Add a location  — rooms, drawers…  │ │                  │
│                    │ │   2. Add your first item                │ │                  │
│                    │ │   3. Ask the assistant where it is      │ │                  │
│                    │ │                                         │ │                  │
│                    │ │   [ Start setup ]   [ Skip — explore ]   │ │                  │
│                    │ └─────────────────────────────────────────┘ ┘                  │
│                                                                                     │
│  (Stat cards, recent lists, and quick actions render below once records exist)      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Annotations:** shown when the user has **0 items and 0 locations** (FR-015.2); "Start setup"
goes to `/onboarding` (P1 — until FR-030 ships the steps deep-link to `/locations`,
`/inventory/new`, `/assistant`); "Skip" keeps the dashboard usable in its degraded-empty form.
No counts of zero are shown as misleading `0` stat cards — the empty state replaces them.
