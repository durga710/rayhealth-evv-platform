# Agent 03 — Design System

**Authored by Durga Ghimeray**

---

## 1. Scope & approach

Per the non-negotiable in `docs/agent-reports/02-product-strategy.md` ("Handoffs" section) and Agent 00's #2 priority ("One design system on the demo path"), this pass built reusable React primitives under `packages/web/src/components/`, sourced every color/spacing/radius/shadow from CSS variables in `packages/web/src/index.css` (adding new variables where none existed), and refactored `CommandCenterPage.tsx` — the flagship, most-demoed, worst-inline-style-offender screen — to consume them. No other screen was rewritten (scope discipline, per the brief). No Tailwind or CSS-in-JS was introduced; the existing "CSS variables + class names" system was extended, not replaced.

`EmptyState`, `ErrorRetry`, `LoadingSkeleton` already existed under `components/state/` with passing tests — they were **not** duplicated. They're re-exported from the new central barrel (`components/index.ts`) for ergonomic imports, left otherwise untouched.

## 2. Primitives created

All primitives are typed function components using `.js`-suffixed relative imports (matching the codebase's existing ESM/NodeNext convention, e.g. `components/state/index.ts`).

| Primitive | Location | Prop API |
|---|---|---|
| `PageShell` | `components/layout/PageShell.tsx` | `{ children, className? }` — the outer `flex-column, gap` wrapper every page hand-rolled inline. |
| `PageHeader` | `components/layout/PageHeader.tsx` | `{ eyebrow?: { label, to }, title: ReactNode, subtitle?: ReactNode, actions?: ReactNode }` — title row with optional back-link and right-aligned actions. |
| `SectionCard` | `components/layout/SectionCard.tsx` | `{ title: ReactNode, action?: ReactNode, children, bordered?: boolean, className? }` — a labeled `<section>`/`<h2>` grouping; `bordered` opts into a white card surface for screens that need it. |
| `MetricCard` | `components/MetricCard.tsx` | `{ label, value: ReactNode, sub?: ReactNode, tone?: 'primary'\|'accent'\|'success'\|'warning'\|'danger'\|'info'\|'neutral', alert?: boolean, to?: string }` — generalizes the old inline `Kpi` helper; tone drives the top-border accent via `data-tone`, `alert` forces danger; optional `to` renders it as a click-through `Link` (not yet used by any consumer, ready for the Command Center click-through work in `02-product-strategy.md` §4). |
| `StatusPill` | `components/StatusPill.tsx` | `{ label, tone?: StatusTone, dot?: boolean }` — thin wrapper over the existing `.badge`/`.badge-*` classes, with an optional leading dot. |
| `AttentionCard` | `components/AttentionCard.tsx` | `{ severity: 'critical'\|'warning'\|'info', title, detail, to }` — the "attention queue" row (dot + title/detail + `StatusPill` + arrow), used for Command Center's "Needs attention" list and reusable for any future queue screen. |
| `CommandPanel` | `components/CommandPanel.tsx` | `{ eyebrow: ReactNode, icon?: ReactNode, action?: ReactNode, children }` — the dark gradient "AI briefing" surface, generalized. |
| `DataTable<T>` | `components/DataTable.tsx` | `{ columns: { key, header, render, align? }[], rows: T[], getRowKey, loading?, loadingRows?, error?, onRetry?, empty?: { title, body? }, caption? }` — wraps the existing `.table-scroll`/`.data-table` classes and composes `LoadingSkeleton`/`ErrorRetry`/`EmptyState` for the three list states every screen re-implements by hand. Not yet wired into a consumer (no table exists on `CommandCenterPage`); built for `TodayBoardPage`/`StaffPage`/etc. follow-up. |
| `Timeline` | `components/Timeline.tsx` | `{ items: { id, timestamp, title, description?, tone? }[], emptyLabel? }` — vertical event trail for audit-trail / Audit Defense style screens (Agent 00 #3). Not yet wired into a consumer. |
| `TrustBadge` | `components/TrustBadge.tsx` | `{ icon, label, detail?, tone?: 'primary'\|'accent' }` — claim+mechanism callout for the future Trust Center/landing work (Agent 00/02's "claim → mechanism → where to see it" pattern). Not yet wired into a consumer. |
| `WorkflowStepper` | `components/WorkflowStepper.tsx` | `{ steps: { id, label, description?, status: 'complete'\|'active'\|'upcoming'\|'blocked' }[], orientation?: 'horizontal'\|'vertical' }` — numbered step progress for Go-Live Readiness / onboarding. Not yet wired into a consumer. |
| `EmptyState`/`ErrorRetry`/`LoadingSkeleton` | `components/state/*` (pre-existing) | Unchanged — re-exported from the new barrel. |

`components/index.ts` is the new central barrel re-exporting all of the above plus `BrandLogo` and `RouteErrorBoundary`, so future call sites can `import { MetricCard, SectionCard } from '../../components/index.js'` instead of reaching into individual files (though `CommandCenterPage.tsx` itself imports from the more specific paths, matching how the pre-existing `state/index.ts` barrel is used elsewhere in the codebase).

## 3. CSS variables — added vs. used

**Added to `:root` in `index.css`:**
- `--color-success-text: #047857`, `--color-danger-text: #BE123C`, `--color-warning-text: #B45309`, `--color-info-text` (aliases `--color-primary-dark`), `--color-info-border: rgba(16, 116, 128, 0.25)` — named the text colors that `.badge-*` classes were already hardcoding inline, so `AttentionCard`/`StatusPill` reference the same tokens instead of re-deriving the hex.
- `--color-slate-800: #1E293B`, `--color-slate-100: #F1F5F9` — named the two bare-hex neutrals `CommandCenterPage` and the skeleton shimmer were hardcoding.
- `--space-1` … `--space-10` (8px-grid spacing scale, `0.25rem`–`2.5rem`) — none existed before; used for `PageShell`'s gap, `SectionCard` header spacing, grid gaps, and card padding. Values were chosen to match the rem literals already in use (e.g. `--space-7: 1.75rem` = the existing outer page gap), so no visual value changed, only named it.
- `--gradient-panel-dark: linear-gradient(135deg, var(--color-sidebar) 0%, var(--color-slate-800) 100%)` — named the dark gradient `CommandPanel` uses, replacing the inline `linear-gradient(135deg, #0F172A 0%, #1E293B 100%)`.

**Existing variables reused (not modified):** `--color-primary`, `--color-primary-dark`, `--color-primary-light`, `--color-primary-bg`, `--color-accent`, `--color-accent-dark`, `--color-accent-bg`, `--color-success/-bg/-border`, `--color-danger/-bg/-border`, `--color-warning/-bg/-border`, `--color-info/-bg`, `--color-border`, `--color-border-strong`, `--color-text/-secondary/-muted`, `--color-surface`, `--radius-sm/md/lg`, `--shadow-md/lg/focus`, `--font-mono`.

**New CSS classes added** (all token-driven, zero new hex literals): `.sr-only`, `.page-shell`, `.page-header__eyebrow/__subtitle/__actions`, `.section-card__header`, `.section-eyebrow`, `.section-card--bordered`, `.metric-card` + `[data-tone]`/`[data-alert]` variants, `.metric-grid` + `--today`/`--compliance` modifiers, `.quick-actions-grid`, `.action-card__link/__title/__cta`, `.page-footnote`, `.page-loading`, `.status-dot` + `[data-tone]`, `.attention-list`, `.attention-card` + tone variants, `.command-panel` + its `__header/__eyebrow/__icon/__body/__cta/__link-btn` parts, `.data-table__align-right/-center`, `.timeline` + parts, `.trust-badge` + parts, `.workflow-stepper` + parts, `.info-banner__title/__detail`. Also refactored `.badge-success/-danger/-warning/-info/-neutral` to reference the new text-color/neutral tokens instead of their previous inline hex (identical rendered colors — pure consolidation).

## 4. What changed in `CommandCenterPage.tsx`

- Removed all 20+ inline `style={{...}}` objects and the file-local `Kpi` helper + `SEV` severity-color map.
- Outer wrapper → `<PageShell>`.
- Title/subtitle/refresh-button row → `<PageHeader title=… subtitle=… actions=…>`.
- Dark AI-briefing gradient panel → `<CommandPanel eyebrow="AI briefing" action=…>{…}</CommandPanel>`; the mint `#14B8A6` CTA button and `#5EEAD4` inline "Refresh" link were replaced with `--color-primary-light`/`--color-primary-dark` tokens (`.command-panel__cta`, `.command-panel__link-btn`) — this intentionally pulls the panel's accent color onto the brand teal instead of an unrelated ad hoc mint, per the "one design system" mandate.
- "Needs attention" section → `<SectionCard title="Needs attention">`; the all-clear state now reuses the pre-existing `.info-banner.banner-success` class (no new component needed) and each attention row is an `<AttentionCard>`.
- "Today" and "Compliance & readiness" KPI grids → `<SectionCard>` + `.metric-grid` + `<MetricCard>` per tile. Tone mapping consolidates ~11 ad hoc hex tints (`#4F46E5`, `#16A34A`, `#0891B2`, `#D97706`, `#64748B`, `#7C3AED`, `#BE185D`, `#0EA5E9`, `#0F766E`, …) down to the 7-tone design-system palette (`primary`/`accent`/`success`/`warning`/`danger`/`info`/`neutral`). This is a deliberate, visible consolidation (e.g. "Auths expiring" moves from a one-off violet to `accent` orange, "Credentials expiring" moves from a one-off pink to `primary` teal) — the two cards still keep distinct hues from each other, and every other KPI's tone is a close-or-exact match to its previous color family.
- "Quick actions" grid → `<SectionCard>` + `.quick-actions-grid`, same `.action-card` class as before with the ad hoc heading/CTA inline styles moved to `.action-card__title`/`.action-card__cta`.
- Footer timestamp line → `.page-footnote` class instead of an inline style object.
- **No prop, data-flow, or behavior changes**: same state, same fetch calls, same 60s polling interval, same conditional branches for loading/error/briefing states. Verified by the pre-existing `CommandCenterPage.test.tsx` passing unmodified (it asserts on rendered text and link `href`s, not markup/classes).

## 5. Accessibility notes

- **Semantic elements:** `PageHeader` renders a real `<header>`+`<h1>`; `SectionCard` renders `<section>`+`<h2>` (previously bare `<div>`s with a styled `<h2>`-less label) — screen readers now get real landmarks/headings for "Needs attention", "Today", "Compliance & readiness", "Quick actions".
- **Focus states:** `AttentionCard` and `MetricCard`'s optional link wrapper both get `:focus-visible { box-shadow: var(--shadow-focus) }` (the same teal focus ring used by inputs/buttons elsewhere), so keyboard users tabbing through the attention queue or a click-through KPI see a clear ring instead of the browser default (or nothing, in the old inline-style version, which had no focus treatment on the attention `<Link>` rows at all — this is a strict improvement).
- **Contrast:** all new text-on-background pairings reuse the pre-existing badge/banner color pairs, which were already documented as WCAG AA (see `index.css` header comment); no new hex was introduced, so no new contrast risk.
- **Reduced motion:** added a global `@media (prefers-reduced-motion: reduce)` block at the end of `index.css` that zeroes out animation/transition durations for every rule in the file — this covers the new components' hover-lift transitions (`MetricCard`, `AttentionCard`) *and*, as a side benefit, the pre-existing skeleton shimmer and sidebar-drawer slide, which had no reduced-motion guard before.
- **Target size:** `AttentionCard` rows and `MetricCard` tiles keep the existing generous padding (0.85rem/1.25rem) — no regression in tap target size.
- **Decorative glyphs:** the AI-briefing sparkle icon, attention/status dots, and workflow-stepper checkmarks are all `aria-hidden="true"`.

## 6. Verification

Run from repo root:

| Command | Result |
|---|---|
| `npm run typecheck --workspace=@rayhealth/web` (`tsc --noEmit`) | **Pass** — no errors. |
| `npm run lint --workspace=@rayhealth/web` (`eslint . --ext ts,tsx`) | **Pass** — no errors/warnings. |
| `npm run test --workspace=@rayhealth/web` (`vitest run`) | **Pass** — 13 test files, 30 tests, all green, including `CommandCenterPage.test.tsx` (unmodified) and the three `components/state/__tests__/*` suites (unmodified). |

No test files were modified — the refactor preserved all rendered text and link semantics the existing tests assert on, so no snapshot/markup updates were needed.

## 7. Deferred follow-ups (deliberately out of scope for this pass)

- `DataTable`, `Timeline`, `TrustBadge`, and `WorkflowStepper` are built and typed but have no consumer yet — they're ready for `TodayBoardPage`/`StaffPage` (DataTable), Audit Defense (Timeline), a Trust Center page (TrustBadge), and Go-Live Readiness (WorkflowStepper), all named in `02-product-strategy.md` but out of this agent's scope (CommandCenterPage-only refactor).
- `EmptyState`/`ErrorRetry`/`LoadingSkeleton` still use inline `style={{}}` objects with hardcoded hex internally (not touched, per the brief's explicit "do NOT duplicate... reuse/re-export" instruction) — a future pass could migrate them to the token system without changing their public API.
- Other screens with the same inline-style pattern (`TodayBoardPage.tsx`'s `STATUS_META`/filter-tab styles, etc.) were left untouched by design — this was scoped to `CommandCenterPage.tsx` only, per "avoid a giant refactor."
- The landing page's self-contained `<style>` block (Agent 00 #2's other half) was not touched — different file, different agent's mandate per `02-product-strategy.md`'s Handoffs section ("Landing agent").
- Web/mobile token sync (`packages/mobile/src/features/common/tokens.ts`) was not attempted — cross-package, larger effort flagged as the "long pole" in Agent 00's estimate, not part of this agent's file list.
