# RayHealth EVV — UI/UX Transformation: Executive Audit & Roadmap

> Phase 0–1 deliverable. Synthesizes the five dimension audits in `./audit/`.
> Baseline: React 19, React Router 7, Tailwind 4, shadcn-style primitives (Radix
> + CVA + clsx + tailwind-merge + lucide), feature-folder architecture.
> Scope: `packages/web` — 19 routed screens, 9 UI primitives, ~48 files.

## Verdict

This is **not a broken codebase to rescue — it's a solid foundation to elevate.**
The bones are modern and right: genuine shadcn primitives (zero `any`, zero
`React.FC`, clean `HttpError` typing), a real persistent `AdminLayout` shell with
a grouped sidebar, a shared `PageHeader`, an `EmptyState` on every list, and a
standout Learning vertical (4–5/5) that is the template for the rest of the app.

The gap to "premium enterprise SaaS" is concentrated in five areas, each
actionable.

## Critical findings (must-fix)

| # | Finding | Source | Severity |
|---|---|---|---|
| C1 | **Contrast failures on the most-used styles.** `--muted-foreground #5b8fc9` (~2.5–3.3:1, all secondary text) and accent orange `#f97316` + white (~2.3–2.9:1, primary CTA + EVV badge) fail WCAG AA. | 01, 04 | CRITICAL |
| C2 | **No dark mode.** No `.dark` block, zero `dark:` utilities — despite shadcn/tw-animate conventions. | 01 | CRITICAL |
| C3 | **Shell is desktop-only.** Fixed `w-64` sidebar, no breakpoint/drawer/hamburger; eats 256px of a 375px phone. Caregivers/coordinators are mobile. | 03, 04 | CRITICAL |
| C4 | **No executive dashboard.** Post-login lands on *Agency Setup* (a name-edit form), not a command center. App shell has no top header → no home for global search, ⌘K, notifications, or profile. | 05 | CRITICAL |
| C5 | **PHI exposed.** Full Medicaid # + DOB render unmasked in the client roster (`ClientsPage.tsx:203,206`). | 04 | CRITICAL |

## High-impact themes

- **Component duplication** (audit 02): `EmptyState` redefined 13×, ~34 hand-rolled
  status banners (no `Alert`), the "form + searchable table" roster layout cloned
  across 5 pages, `AgencySettingsPage.tsx` at **1816 lines** (Sandata/HHAeXchange
  sections ~95% duplicate). Building `Alert` + `EmptyState` alone deletes ~47 copies.
- **State & data** (audit 03): no server-state cache; every page fetches into
  `useState`/`useEffect` (refetch-on-mount; `/api/staff` fetched 6×); several list
  pages have **no loading state** and **silently swallow fetch errors**
  (`catch → setClients([])`), making an outage look like an empty agency.
- **Routing** (audit 03): no code splitting — all ~20 pages eager-loaded, shipped
  even to landing visitors; legacy element model, no `errorElement`, 404 silently
  redirects to marketing.
- **Interaction plumbing half-built** (audit 04): Sonner installed + themed but
  `<Toaster/>` never mounted and `toast()` never called; loading = bare "Loading…"
  strings; route changes don't move focus; an audited compliance-override reason is
  collected via `window.prompt()`.
- **Healthcare depth** (audit 04): EVV Visit Review shows only timestamps + status,
  omitting the six federal EVV elements (GPS/location/identity/service code) the
  product advertises — coordinators can't truly *verify* a visit.

## Design-system direction (audit 01)

Replace the stalled dual token system (legacy brand vars + ~700 lines of bespoke
`.landing-*`/`.admin-*` CSS, co-existing with shadcn semantic tokens) with a
single handcrafted system:

- **OKLCH color ramps** (50→950) for brand-blue, teal (data/insight), a *demoted*
  amber accent, slate neutrals, and four state families (success/warning/error/info,
  each solid + subtle) — kills the copy-pasted `emerald-50/200/800` banners.
- **Full light + dark semantic roles** mapped off the ramps; fix `muted-foreground`
  to slate-600 and `accent-foreground` to dark text (clears C1).
- Formal **typography scale**, **8px spacing**, **radius** (derive 2xl/3xl from
  `--radius`), **brand-tinted shadow elevation**, **motion** tokens, and tasteful
  **glass** tokens.
- Then migrate + delete the legacy CSS and lint-gate `text-[…]`/`bg-[#…]`/raw palette.

## Recommended roadmap

Sequenced so each milestone ships independently and never leaves the repo broken.

- **M1 — Foundation (design system + shell + critical a11y).** New token system
  (light+dark), fix contrast (C1), add dark mode (C2), responsive collapsible
  sidebar + new top header with profile/search/notification slots (C3/C4), mount
  `<Toaster/>`. *Unblocks everything; highest value, lowest churn.*
- **M2 — Component library.** Build P0/P1 primitives & patterns: `Alert`,
  `EmptyState`, `SearchInput`, `DataTable`+`Pagination`, `StatCard`, `Skeleton`,
  form controls, `DropdownMenu`, `Tabs`, `Tooltip`, plus a `useApiResource` hook.
  Adopt TanStack Query for server state. Each step deletes duplication on landing.
- **M3 — Executive Dashboard** at `/admin`, cloning the Learning KPI/Insights pattern.
- **M4 — Screen redesigns**, priority order: roster/CRUD lift (Clients 360°, Staff,
  Authorizations) → Scheduling calendar/board → live EVV/Visits board with GPS &
  the six federal elements → Agency settings refactor (kill the 1816-line file).
- **M5 — Premium layer.** Command palette (⌘K), global search, notification center,
  micro-interactions/transitions, optimistic UI, breadcrumbs.
- **M6 — New verticals** (as scoped): Timesheets → Payroll → Billing, Documents,
  Messaging, Reports/Analytics center, Calendar.
- **Cross-cutting:** code splitting + route data APIs, PHI masking (C5), focus
  management, WCAG 2.2 AA pass, performance (lazy/memo/virtualized tables).

## Engineering guardrails

Strict TS, feature folders, `ui/` (primitives) vs `patterns/` vs `layout/`, no inline
styles, no duplicate logic, reusable hooks. After every milestone: lint → typecheck →
test → verify responsive + a11y → commit. Work on the consolidation branch / feature
branches off it; keep PR #79's green CI green.
