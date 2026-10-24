# SmartHomeAI — Design System

| Field | Value |
|---|---|
| Version | 0.1.0 |
| Status | Draft for review |
| Date | 2026-10-15 |
| Owner | Design Agent |
| Scope | Semantic tokens (color, type, spacing, radius, elevation, borders, breakpoints), component variant inventory mapped to shadcn/ui, light + dark theming rules |

**Companion documents:** [DESIGN_SPEC.md](DESIGN_SPEC.md) (pages/states) ·
[INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md) · [ACCESSIBILITY.md](ACCESSIBILITY.md)
· [WIREFRAMES.md](WIREFRAMES.md) · [USER_FLOWS.md](USER_FLOWS.md).
Canonical inputs: [index.md — D7](../index.md), [PRD §12 C-5/C-6](../product/PRD.md).

**Golden rule:** components contain **no hardcoded hex/rgb values**. Every color, size, radius, and
shadow is consumed through semantic tokens exposed as Tailwind utility classes
(e.g. `bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`,
`shadow-raised`). Raw token names exist only in `app/globals.css` and the Tailwind config.

---

## 1. Color palette

### 1.1 Primitive scales (defined once, referenced by semantic tokens)

**Navy — navigation and brand identity (D7: deep navy navigation):**

| Token | Value | Typical use |
|---|---|---|
| `--navy-600` | `#1E4E7E` | Accents on navy, hover affordances |
| `--navy-700` | `#173D63` | Active nav item background (light theme) |
| `--navy-800` | `#112D4B` | Sidebar hover |
| `--navy-900` | `#0B1E34` | **Sidebar background (light theme)** |
| `--navy-950` | `#080D16` | **Sidebar background (dark theme)** |

**Gray — neutral surfaces (slightly cool, pairs with navy):**

| Token | Value | Typical use |
|---|---|---|
| `--gray-50` | `#F7F8FA` | Page background (light) |
| `--gray-100` | `#F1F3F7` | Muted surfaces, table header, hover rows |
| `--gray-200` | `#E1E4E8` | Default borders, dividers |
| `--gray-300` | `#CDD2DA` | Non-interactive structural emphasis (card outlines on tinted surfaces); **not** for control borders |
| `--gray-400` | `#98A2B3` | Placeholder text, disabled text (dark `--muted-foreground`) |
| `--gray-500` | `#667085` | Secondary text (light `--muted-foreground`) |
| `--gray-600` | `#475467` | Body secondary emphasis |
| `--gray-700` | `#344054` | Headings on muted surfaces |
| `--gray-800` | `#1D2939` | Dark-theme strong text |
| `--gray-900` | `#101828` | Primary text (light `--foreground`) |

**Blue — restrained primary actions:**

| Token | Value | Typical use |
|---|---|---|
| `--blue-50` | `#EFF5FE` | Primary subtle backgrounds, selection tint |
| `--blue-100` | `#DCEAFB` | Active nav tint, info surfaces |
| `--blue-300` | `#8AB2EF` | Focus ring on navy surfaces |
| `--blue-500` | `#3B82F6` | **Primary (dark theme)** |
| `--blue-600` | `#1769E0` | **Primary action (light theme) — our blue-600** |
| `--blue-700` | `#1257BE` | Primary hover |
| `--blue-800` | `#0E4AA6` | Primary active/pressed |

> `--blue-600` is deliberately a *restrained* enterprise blue (slightly deeper than Tailwind's
> default `#2563EB`) to satisfy D7 "restrained blue primary". Components never reference palette
> steps directly — only `--primary` and friends.

### 1.2 Semantic tokens (shadcn naming, defined in `:root` and `.dark`)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--background` | `#F7F8FA` | `#0F1420` | Page surface |
| `--foreground` | `#101828` | `#E6EAF2` | Default text |
| `--card` | `#FFFFFF` | `#161C2A` | Card/panel surface |
| `--card-foreground` | `#101828` | `#E6EAF2` | Text on card |
| `--popover` | `#FFFFFF` | `#161C2A` | Menus, dialogs, combobox popups |
| `--popover-foreground` | `#101828` | `#E6EAF2` | Text in popovers |
| `--primary` | `#1769E0` | `#3B82F6` | Primary action background |
| `--primary-foreground` | `#FFFFFF` | `#0B1220` | Text on primary |
| `--primary-hover` | `#1257BE` | `#2E71E0` | Hover state of primary |
| `--primary-active` | `#0E4AA6` | `#2563EB` | Pressed state |
| `--secondary` | `#F1F3F7` | `#1C2434` | Secondary button / subtle fill |
| `--secondary-foreground` | `#344054` | `#E6EAF2` | Text on secondary |
| `--muted` | `#F1F3F7` | `#1C2434` | Muted surfaces (table headers, chips) |
| `--muted-foreground` | `#667085` | `#98A2B3` | Secondary text |
| `--accent` | `#EFF5FE` | `#1A2740` | Hover/selection tint (ghost buttons, nav highlight) |
| `--accent-foreground` | `#1257BE` | `#93C0F5` | Text on accent |
| `--destructive` | `#B42318` | `#F97066` | Destructive actions/errors |
| `--destructive-foreground` | `#FFFFFF` | `#2B0F0C` | Text on destructive |
| `--border` | `#E1E4E8` | `#2A3345` | Default borders/dividers |
| `--border-strong` | `#7A8496` | `#6B7899` | Emphasized **interactive** boundaries (active panes, secondary button outline) — ≥ 3:1 vs surface |
| `--input` | `#7A8496` | `#6B7899` | Form control borders — ≥ 3:1 vs `--card` (WCAG 1.4.11) |
| `--ring` | `#1769E0` | `#3B82F6` | Focus ring color |
| `--sidebar-background` | `#0B1E34` | `#080D16` | Deep navy navigation |
| `--sidebar-foreground` | `#E4E9F0` | `#CBD5E1` | Nav labels |
| `--sidebar-accent` | `#173D63` | `#13213A` | Nav hover/active background |
| `--sidebar-border` | `#123055` | `#1B2537` | Sidebar dividers |
| `--success` | `#15803D` | `#4ADE80` | Success states |
| `--warning` | `#B45309` | `#FBBF24` | Warning states |
| `--info` | `#0E7090` | `#38BDF8` | Informational states |
| `--radius` | `6px` | `6px` | Default component radius |

**Derived surface tokens:** `--success-surface` / `--warning-surface` / `--danger-surface` /
`--info-surface` are the corresponding colors at ~8 % opacity over `--card`
(light values: `#ECFDF3`, `#FFFAEB`, `#FEF3F2`, `#ECFDFF`; dark values: `#0E2A1B`, `#2C2109`,
`#2E1512`, `#082830`) used for badge and alert backgrounds so that status text keeps ≥ 4.5:1
contrast on its own surface.

### 1.3 Status indicator colors

Status is **never color-only** — always color + icon + text (see
[ACCESSIBILITY.md §2.3](ACCESSIBILITY.md#23-no-color-only-meaning-status-indicators)).

| Status (badge) | Foreground token | Surface token | Icon (Lucide) |
|---|---|---|---|
| `Recorded` / `CONFIRMED` | `--success` | `--success-surface` | `CheckCircle2` |
| `INFERRED` (suggestion) | `--warning` | `--warning-surface` | `Lightbulb` |
| `Archived` | `--muted-foreground` | `--muted` | `Archive` |
| `Deleted` (pending purge) | `--destructive` | `--danger-surface` | `Trash2` |
| `Never recorded` | `--muted-foreground` | transparent + `--border` | `CircleDashed` |
| `Source: ASSISTANT` | `--info` | `--info-surface` | `Sparkles` |
| `Source: MANUAL` | `--muted-foreground` | `--muted` | `Pencil` |
| `AI degraded / fallback` | `--warning` | `--warning-surface` | `WifiOff` |

---

## 2. Typography

**Font stack:** `Inter`, `system-ui`, `-apple-system`, `"Segoe UI"`, Roboto, `"Helvetica Neue"`,
Arial, sans-serif — declared as `--font-sans`; Inter loaded with `font-display: swap` (ASSUMPTION:
self-hosted or next/font; no external font CDN dependency is required).

**Scale (px / line-height / Tailwind key):**

| Token | px | Line height | Tailwind key | Primary use |
|---|---|---|---|---|
| `--font-size-xs` | 12 | 16 | `text-xs` | Badges, captions, table meta, timestamps |
| `--font-size-dense` | 13 | 18 | `text-dense` | **Dense UI**: table cells, nav items, helper text (information density) |
| `--font-size-base` | 14 | 20 | `text-base` | Default body and controls (enterprise density, 14 px base) |
| `--font-size-lg` | 16 | 24 | `text-lg` | Lead paragraphs, assistant message body |
| `--font-size-xl` | 20 | 28 | `text-xl` | Section/card headings (h3) |
| `--font-size-2xl` | 24 | 32 | `text-2xl` | Page titles (h1 on dense pages), stat values |
| `--font-size-3xl` | 30 | 36 | `text-3xl` | Display: landing hero, empty-state titles |

**Weights:** `--font-normal` 400 (body) · `--font-medium` 500 (labels, table headers, nav,
buttons) · `--font-semibold` 600 (headings, stat values, emphasis) · `--font-bold` 700 (landing
hero, page titles ≥ 24 px).

**Rules:** never below 12 px in the UI; body copy ≤ 75 characters per line; headings use semantic
`h1–h3` in document order (one `h1` per page); timestamps and IDs use
`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` via `--font-mono`.

---

## 3. Spacing, radii, elevation, borders

### 3.1 Spacing — 4 px base unit

| Token | px | Token | px | Token | px |
|---|---|---|---|---|---|
| `--space-1` | 4 | `--space-5` | 20 | `--space-12` | 48 |
| `--space-2` | 8 | `--space-6` | 24 | `--space-16` | 64 |
| `--space-3` | 12 | `--space-8` | 32 | `--space-20` | 80 |
| `--space-4` | 16 | `--space-10` | 40 | | |

Tailwind keys `p-1…p-20`, `m-*`, `gap-*`, `space-*` map 1:1 to these tokens. Allowed exceptions:
2 px hairline offsets inside icons/dividers, and 44 px minimum touch targets (accessibility).

### 3.2 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Badges, chips, compact inputs |
| `--radius-md` | **6px (default)** | Buttons, inputs, cards, dialogs |
| `--radius-lg` | 8px | Cards with media, sheet corners |
| `--radius-full` | 9999px | Avatars, pills, icon buttons |

### 3.3 Elevation (3 levels, subtle by D7)

| Token | Value (light) | Use |
|---|---|---|
| `--shadow-subtle` | `0 1px 2px rgba(16,24,40,.06)` | Cards at rest |
| `--shadow-raised` | `0 4px 12px rgba(16,24,40,.10)` | Hovered cards, popovers |
| `--shadow-overlay` | `0 12px 32px rgba(16,24,40,.16)` | Dialogs, sheets, drawers |

Dark theme softens shadows and adds a 1 px top light (`inset 0 1px 0 rgba(255,255,255,.04)`) on
`--shadow-raised`/`--shadow-overlay` so overlays separate from surfaces.

### 3.4 Borders

| Token | Value | Use |
|---|---|---|
| `--border` | 1px solid `--border` | Card outlines, dividers, table grid (decorative) |
| `--border-strong` | 1px solid `--border-strong` | Inputs, selects, active panes — control boundaries meet ≥ 3:1 |
| `--border-focus` | 2px solid `--ring` + 2px offset | `focus-visible` ring everywhere |

---

## 4. Breakpoints

| Key | Min width | Design consequence |
|---|---|---|
| `sm` | 640 px | Compact paddings (16 px), single-column forms |
| `md` | 768 px | Tables ↔ card list switch point; toolbar moves out of `Sheet` |
| `lg` | 1024 px | Persistent sidebar appears (below → drawer), two-pane layouts |
| `xl` | 1280 px | Content max width 1280 px; denser tables (extra columns) |
| `2xl` | 1536 px | Centered content column with wider gutters |

Mobile-first CSS (`min-width` media queries / Tailwind default behavior).

---

## 5. Component variant inventory (mapped to shadcn/ui primitives)

Variants are implemented as Tailwind class variants on top of shadcn/ui primitives; every row's
accessibility states are **required** behavior (details in
[ACCESSIBILITY.md](ACCESSIBILITY.md)).

| Component | shadcn/ui primitive | Variants / sizes | Accessibility states (required) |
|---|---|---|---|
| **Button** | `button` (cva) | `primary` \| `secondary` \| `ghost` \| `destructive` \| `link`; sizes `sm` (32 px) / `md` (36 px); `icon` square variant; `loading` state | `:focus-visible` ring (`--ring`, 2 px + offset); `disabled` + `aria-disabled` with reduced contrast but ≥ 3:1; `loading` sets `aria-busy`; never color-only meaning |
| **Input / Textarea** | `input`, `textarea` | default; sizes `sm`/`md`; password w/ show-hide toggle; `error` styling | Label always present + `htmlFor`; error sets `aria-invalid` + `aria-describedby`; `:focus-visible` ring; disabled reads as disabled |
| **Select** | `select` (Radix) | sm/md, placeholder, `error` | Keyboard operable (Radix), `aria-invalid`, listbox semantics |
| **Checkbox / Radio** | `checkbox`, `radio-group` | default, `error`; group in fieldset with legend | Native focus order, `aria-describedby` for group errors, ≥ 44 px target on mobile |
| **Form field** | custom wrapper (`label` + `description` + `error`) | `default` \| `error` \| `success` (optional success hint) | Error text linked via `aria-describedby`, `role="alert"` on new errors; success uses icon + text |
| **Card** | `card` | `default` \| `interactive` (hover/`Enter` navigates) \| `stat` (dashboard) \| `flush` | Interactive cards are `<a>`/`<button>`; focus ring; headings remain semantic |
| **Table** | `table` + TanStack Table v8 | `default` \| `compact`; `sortable`; mobile → card list `< 768 px` | `<caption>` (visually hidden), `scope="col"`, `aria-sort`, row focus + `Enter`, `aria-rowcount` |
| **Dialog** | `dialog` (Radix) | `default` \| `destructive` (destructive confirmation) \| `fullscreen` on small screens | Focus trapped, moved to title on open, restored to trigger on close, `Esc` closes, `aria-describedby`, labelled title; scroll lock |
| **Drawer / Sheet** | `sheet` (Radix) | side `left` (nav) / `right` (filters) / `bottom` (mobile forms) | Same focus management as Dialog; scrim click + `Esc`; returns focus to opener |
| **Tabs** | `tabs` (Radix) | `line` (settings) / `pill` (search filters) | Arrow-key roving focus, `aria-selected`, `aria-controls`, visible tab stop |
| **Toast / notification** | `sonner` (toast) | `default` \| `success` \| `error` \| `info`; optional action (e.g. Undo) | `role="status"` + `aria-live="polite"` (errors `assertive`); auto-dismiss ≥ 5 s; action reachable before expiry |
| **Badge (status)** | `badge` | `success` \| `warning` \| `danger` \| `info` \| `muted` \| `outline` — see §1.3 | Icon + text always accompany color; contrast ≥ 4.5:1 of text on surface; never used as the only status cue |
| **Skeleton** | `skeleton` | row / card / chart-free block sizes | `aria-hidden="true"`; container marked `aria-busy`; respects reduced motion (no shimmer) |
| **Empty state** | custom | `default` \| `onboarding` (first run) \| `no-results` | Semantic heading, single primary action, illustration (if any) `aria-hidden` |
| **Pagination** | custom (links + buttons) | numbered desktop / "Load more" mobile | `nav` + `aria-label="Pagination"`, current page `aria-current="page"`, disabled state |
| **Tooltip** | `tooltip` (Radix) | default; icon-button labels | Opens on hover **and** focus, dismissible, `aria-describedby`; never the sole source of required information |
| **Breadcrumb** | custom | desktop / compact (last ancestor shown on `sm`) | `nav` + `aria-label="Breadcrumb"`, current = plain text with `aria-current`, `ChevronRight` `aria-hidden` |
| **Avatar** | `avatar` | `sm`/`md`, initials fallback | `aria-hidden` when decorative; account menu trigger carries the accessible name |
| **Combobox / location picker** | `command` + `combobox` (Radix) | `single-select` hierarchy picker; `create-inline` action row | Combobox pattern: `aria-expanded`, `aria-controls`, `aria-activedescendant`, option `role="option"` + `aria-selected`, `Esc` closes, typed filter announced (`aria-live` result count) — see [ACCESSIBILITY.md §6](ACCESSIBILITY.md#6-specific-patterns) |
| **Navigation sidebar** | custom (on shadcn `sheet` for mobile) | expanded (240 px) / icon rail (64 px) / drawer `< 1024 px` | `nav` + `aria-label="Primary"`, current item `aria-current="page"`, drawer = Dialog semantics, rail labels exposed via `Tooltip` + accessible name |
| **Timeline** | custom | `item` marker/line variant (recorded / inferred / voided) | Ordered list (`<ol>`), each entry a labelled `li`; timestamps in `<time>`; no reliance on marker color |

---

## 6. Themes (light default, dark optional)

### 6.1 Strategy

- **Single source of truth:** CSS custom properties. `:root` defines the **light** theme (default);
  `.dark` overrides the same property names. No component ever branches on theme.
- **Resolution order** (per FR-021 "system" option): stored preference
  (`light | dark | system`) → `system` applies `prefers-color-scheme` → manual override applies the
  `.dark` class on `<html>` immediately (no reload, no flash — inline script sets the class before
  first paint).
- **Toggle:** top-bar account/appearance control with three options (Light / Dark / System);
  instant application; persisted server-side once FR-021 ships (P1), local storage beforehand
  (documented in [DESIGN_SPEC.md §1.13](DESIGN_SPEC.md#113-settings--privacy)).
- **`prefers-color-scheme` support** is automatic via the `.dark` override block when the user
  chooses System (the default resolution for new users is **light**, per D7).

### 6.2 Example declaration (illustrative)

```css
:root {                       /* light = default (D7) */
  --background: #F7F8FA; --foreground: #101828;
  --primary: #1769E0;    --sidebar-background: #0B1E34;
  --radius: 6px; /* …all tokens from §1.2… */
}
.dark {
  --background: #0F1420; --foreground: #E6EAF2;
  --primary: #3B82F6;    --sidebar-background: #080D16;
  /* …same keys, dark values… */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { /* system mode → dark values */ }
}
```

### 6.3 Consumption rules

1. **No hardcoded hex/rgb in any component or page file** — lint rule target (color-no-hex,
   planned in Phase 2 tooling). Colors come only from `--*` tokens via Tailwind semantics
   (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`,
   `shadow-raised`, `bg-sidebar`…).
2. Primitive palette steps (`--navy-*`, `--gray-*`, `--blue-*`) are referenced **only** when
   composing semantic tokens in `globals.css` — never in JSX/TSX.
3. Every status color pairs with an icon and text (§1.3); components may not introduce a new
   status color outside this registry without amending this document.
4. Focus, error, and disabled states are tokenized (`--ring`, `--destructive`,
   `--muted-foreground`) so all pages inherit identical behavior.
5. Contrast is a token-level obligation: each foreground/background pair in §1.2 meets
   WCAG 2.1 AA (≥ 4.5:1 text, ≥ 3:1 UI) in **both** themes — verified per
   [ACCESSIBILITY.md](ACCESSIBILITY.md#7-testing-requirements).

---

## 7. Registry divergence notes

Recorded for the Review Agent (not silently diverged):

- Token values for `--background --card --foreground --sidebar-* --primary --border
  --muted-foreground --destructive --success --warning --info` and radius/spacing/breakpoints
  `sm 640 / md 768 / lg 1024 / xl 1280` match the design-token registry in
  [../CONTRACT.md §13](../CONTRACT.md). This document additionally defines `2xl 1536` and the
  13 px `text-dense` step required by the design brief; the registry scale lists 12/14/16/20/24/30.
- `--primary` light `#1769E0` is used as this system's `blue-600`; the design brief's "blue-600"
  is read as the *role* (restrained blue primary), not Tailwind's default `#2563EB`.
