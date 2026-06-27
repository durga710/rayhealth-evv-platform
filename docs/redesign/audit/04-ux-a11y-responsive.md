# RayHealth EVV — UX, Accessibility & Responsiveness Audit

**Scope:** `packages/web/src` React 19 + Tailwind 4 + shadcn-style admin/landing frontend.
**Method:** Static read of representative pages across every feature area (`agency`, `auth`,
`authorizations`, `clients`, `evv`, `landing`, `learning`, `scheduling`, `staff`), the shared
layout/shell (`App.tsx`), shared `PageHeader`, the `ui/*` primitives, and `index.css` tokens.
**Standard:** WCAG 2.2 Level AA + enterprise-SaaS UX heuristics + HIPAA-conscious UI patterns.

Severity tags: **CRITICAL** (blocker / legal/clinical risk), **HIGH** (real bug or AA failure),
**MEDIUM** (maintainability / partial failure), **LOW** (polish).

---

## 0. Executive snapshot

The build is a competent, *consistent* shadcn admin: `PageHeader` + `Card` + `Table` + `Badge`
are reused everywhere, every page ships an `EmptyState`, form labels are almost universally
wired with `htmlFor`, and error/success banners carry `role="alert"`/`role="status"`. That puts
it above "basic CRUD." But it stops at the 70% mark of premium enterprise SaaS, and three classes
of problem keep it from AA and from feeling finished:

1. **The admin shell is not responsive at all** — a fixed 256px sidebar with no mobile drawer.
2. **Primary text color fails AA contrast** (`--muted-foreground #5b8fc9` ≈ 3.3:1) and it is the
   single most-used text color in the product (descriptions, table cells, placeholders, hints).
3. **Interaction-state plumbing is half-built** — Sonner is installed and themed but never
   mounted; "toasts" are hand-rolled `setTimeout` divs; loading states are bare `Loading…`
   strings; route changes never move focus; and one core flow uses `window.prompt()`.

---

## 1. Information hierarchy & layout quality

**Strengths**
- Shared `PageHeader` (`src/components/PageHeader.tsx`) gives every admin page a consistent
  display-font H1, muted subtitle, border rule, and right-aligned action slot. Good.
- The form-left / list-right split (`grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]`) is used
  identically on Clients, Staff, Authorizations, and Assignments — coherent IA.
- `LearningDashboardPage.tsx` is the strongest page: KPI row, status cards with left-accent
  borders, a stacked compliance bar, and a contextual "needs attention" banner. This is the
  visual bar the rest of the app should reach.

**Issues**

- **MEDIUM — Dual, competing styling systems.** `index.css:168-219` keeps a legacy bare-element
  layer (`button:not([data-slot])`, `input:not([data-slot])`, `label:not([data-slot])` with
  forced `text-transform: uppercase` + letter-spacing) alongside the Tailwind/shadcn layer. It
  only works because shadcn primitives carry `data-slot`. Any raw `<label>`/`<input>`/`<button>`
  a future dev adds will silently inherit 2024-era styling. The raw `<textarea>` elements in
  `VisitCorrectionsQueuePage.tsx:357` and `CopilotChatPage.tsx:336` already sit outside the design
  system. Fragile; should be deleted once migration completes.
- **MEDIUM — Bare loading layouts break the shell rhythm.** `AgencySetupPage.tsx:55`
  `if (loading) return <div>Loading...</div>;` returns an unstyled, header-less div — the page
  chrome vanishes and reappears. `VisitReviewPage.tsx:109`, `VisitCorrectionsQueuePage.tsx:200`,
  `LearningDashboardPage.tsx:98` all render a plain `Loading…` paragraph instead of skeletons.
  No skeleton component exists anywhere in `ui/`.
- **MEDIUM — Raw UUIDs leak into primary content columns.** `VisitReviewPage.tsx:127`
  (`visit.caregiverId.slice(0, 8)...`), `AuthorizationsPage.tsx:242` (`Client: …slice(0,6)`),
  and the entire `VisitCorrectionsTrackingPage.tsx` grid (visitId/requesterId/approverId rendered
  as truncated `<code>` at lines 253, 264, 268) show machine IDs where humans expect names.
  `AssignmentsPage.tsx:171-187` *does* resolve IDs→names via a lookup map — that pattern should be
  lifted into Visit Review and the corrections pages.
- **LOW — Density inconsistency.** KPI numerals use `font-medium` (`LearningDashboardPage.tsx:196`)
  while the brand is otherwise heavy/black display weights; metrics read underweight for a
  dashboard hero.

---

## 2. Navigation & onboarding

**Strengths**
- `App.tsx:60-92` defines a sectioned sidebar (Organization / Scheduling / Visits / Workforce)
  with Lucide icons and a `NavLink` active state — clear, grouped, scannable.
- Onboarding/empty-first-run is handled thoughtfully in places: `StaffPage.tsx:275` distinguishes
  "no staff yet" from "no search match," and the invite flow surfaces the acceptance URL + copy
  button + "email not configured" fallback (`StaffPage.tsx:213-218`).
- `AcceptInvitePage.tsx` is a genuinely good onboarding surface: status-aware (expired/revoked/
  accepted), inline validation, success state, auto-redirect.

**Issues**

- **HIGH — No breadcrumbs anywhere.** Deep routes (`/admin/learning/courses/:id`,
  `/admin/learning/caregivers/:id`, `/admin/learning/copilot`) rely on ad-hoc "← Learning Hub"
  back links (`CopilotChatPage.tsx:247`). There is no location trail, so a coordinator three
  levels into Learning has no orientation and no one-click path back to a mid-level page.
- **MEDIUM — Sidebar section headings are not real headings.** `App.tsx:134` renders group
  titles as `<p>`. Screen-reader users get no landmark/heading structure for the nav; the `<nav>`
  also has no `aria-label` (`App.tsx:120`), so multiple navs (landing has its own) are
  indistinguishable in a rotor.
- **MEDIUM — No first-run agency-setup wizard.** `AgencySetupPage.tsx` is a single name field +
  disabled state field; a brand-new agency lands on a near-empty form with no guided
  "next: add staff → add clients → build templates" path. The landing page advertises a 4-step
  operating model (`LandingPage.tsx:22-43`) that the product never scaffolds for new admins.
- **LOW — Default admin route** is `/admin/agency` (`App.tsx:188`), i.e. a settings form, not a
  dashboard/worklist. A coordinator's daily landing surface should be the Visit Review or
  Corrections queue, not agency config.

---

## 3. Accessibility (WCAG 2.2 AA)

- **CRITICAL — Body/primary muted text fails 1.4.3 contrast.** `index.css:70`
  `--muted-foreground: #5b8fc9` on `--background #f0f4f8` / `--card #fff` computes to ≈ **3.3:1**,
  below the 4.5:1 AA threshold for normal text. This token drives nearly all secondary copy:
  `PageHeader` descriptions (`PageHeader.tsx:30`), every `CardDescription`, table secondary cells
  (e.g. `ClientsPage.tsx:203`, `VisitReviewPage.tsx:128`), input placeholders, and form hints
  (`AcceptInvitePage.tsx:282`). Single highest-impact a11y defect.
- **HIGH — Accent orange on light fails contrast.** `--accent #f97316` used as text on light
  backgrounds (hero eyebrow `index.css:309`, `.resource-card span` `index.css:579`,
  `.mobile-visit-card span`) is ≈ 2.9:1. As *text* it fails AA; as a badge background with white
  text it is fine.
- **HIGH — Unlabeled textarea (4.1.2 / 3.3.2).** `CopilotChatPage.tsx:336-343` renders a
  `<textarea>` with only a `placeholder` — no `<Label htmlFor>`, no `aria-label`. The primary
  input of the AI Copilot is unnamed for assistive tech. (The reject-reason textarea in
  `VisitCorrectionsQueuePage.tsx:356` *is* correctly labeled — copy that.)
- **HIGH — `window.prompt()` for a required, audited field.** `AssignmentsPage.tsx:250` collects
  the compliance-override reason — a value written to the agency audit log — via a native
  `window.prompt`. It is unstyleable, not announced consistently, traps focus outside the app
  shell, and is blocked in some embedded/kiosk contexts. Replace with a `Dialog` + labeled
  textarea.
- **HIGH — Table headers lack `scope`.** `ui/table.tsx:66-77` `TableHead` renders `<th>` with no
  `scope="col"`. Multi-column tables (Tracking page has 8 columns, `VisitCorrectionsTrackingPage.tsx:151-161`)
  are exactly where SR users need explicit header association.
- **MEDIUM — Field-level errors are not programmatically linked.** Forms surface a single
  top-of-form `role="alert"` banner (e.g. `AcceptInvitePage.tsx:258`, `LoginPage.tsx:56`) but
  invalid inputs never get `aria-invalid` or `aria-describedby` pointing at the message, so SR
  users can't tell *which* field failed. The primitives support it (`ui/input.tsx:13` styles
  `aria-invalid`) — it's just never set.
- **MEDIUM — Color-only data viz.** The compliance bar `LearningDashboardPage.tsx:233-244`
  encodes five statuses purely by color segment width with a `title` tooltip (not keyboard
  reachable, 1.4.1). A legend follows, which mitigates, but the bar itself has no `role`/text
  alternative. Same color-only pattern in the landing burn-meter (`index.css:476`).
- **MEDIUM — No focus management on route change.** `App.tsx` SPA navigation never moves focus to
  the new page's `<h1>` nor announces the change via a live region; keyboard/SR users stay
  parked on the clicked nav link. No skip-link exists in `AdminLayout` (one exists only on the
  public `LandingPage.tsx:747`).
- **MEDIUM — No `prefers-reduced-motion` handling (2.3.3 / 2.2 motion).** `tw-animate-css` powers
  dialog zoom/fade (`ui/dialog.tsx:37,56`), and `index.css` has `transform: translateY(-4px)`
  card-hover (`:574`) and several transitions, none gated behind `motion-reduce:`/a media query.
- **LOW — Sidebar section labels at 60% opacity.** `App.tsx:134` `text-sky-200/60` on the blue
  gradient is borderline for the heading text.
- **LOW — Icon-only affordances mostly OK** (`aria-hidden` is applied consistently to decorative
  Lucide icons), and the search inputs carry real `aria-label`s (`ClientsPage.tsx:178`) — credit
  where due.

---

## 4. Responsiveness

- **CRITICAL — Admin shell does not adapt to mobile/tablet.** `App.tsx:118-160`: the layout is
  `flex min-h-screen` with `<nav class="w-64 shrink-0 …">` permanently rendered. There is **no**
  breakpoint to collapse it, no hamburger/drawer, no `md:hidden`/`lg:hidden` anywhere in the
  codebase (grep confirms zero mobile-nav toggles). On a phone the sidebar consumes ~256px of a
  ~375px viewport, leaving the actual workspace crushed into ~120px. The product is effectively
  desktop-only despite caregivers/coordinators being mobile-first users.
- **MEDIUM — Wide tables degrade to horizontal scroll only.** `ui/table.tsx:9` wraps tables in
  `overflow-x-auto` — acceptable as a floor, but the 8-column Tracking grid
  (`VisitCorrectionsTrackingPage.tsx:151`) and 5-column Visit Review will side-scroll awkwardly on
  mobile with no card/stacked fallback. No responsive table transform exists.
- **LOW (positive) — Page-body grids stack correctly.** The form/list two-up grids use `lg:`
  prefixes and collapse to one column below (`ClientsPage.tsx:88`, etc.), and the public
  `LandingPage` has real `@media (max-width: 840px|560px)` rules (`index.css:801-869`). The
  *content* is responsive; only the *shell* is not.

---

## 5. Interaction states

- **HIGH — Sonner is installed, themed, and never mounted.** `ui/sonner.tsx` exports a configured
  `Toaster`, but grep finds **no** `<Toaster/>` in `main.tsx`/`App.tsx` and **no** `toast()` call
  anywhere. Every page therefore reinvents notifications as inline `setTimeout` divs
  (`VisitReviewPage.tsx:72`, `VisitCorrectionsQueuePage.tsx:115-120`, `StaffPage.tsx:129`),
  producing inconsistent placement, no stacking, and dead dependency weight. Pick one model.
- **HIGH — Free-text ISO timestamp entry for corrections.** Approving a visit correction asks the
  coordinator to type `2026-05-10T09:00:00.000Z` into a plain text input
  (`VisitCorrectionsQueuePage.tsx:317-336`). For a compliance-critical, audited time adjustment
  this is error-prone and hostile; should be a `datetime-local` picker with validation.
- **MEDIUM — No loading skeletons; spinner-less text swaps.** Covered in §1 — every async surface
  flips between a `Loading…` string and content, causing layout shift. Buttons *do* handle their
  own pending state well (`aria-busy` + label swap, e.g. `AssignmentsPage.tsx:385`,
  `VisitReviewPage.tsx:146`) — that discipline just isn't extended to page/section loads.
- **MEDIUM — No optimistic UI / refetch churn.** Mutations append to local state then often
  `await refresh()` (`VisitCorrectionsQueuePage.tsx:131`), double-rendering; and silent catches
  hide failures: `AgencySetupPage.tsx:35` and several list loads swallow errors to `console.error`
  (`VisitReviewPage.tsx:53`, `AuthorizationsPage.tsx:49`) so a failed fetch looks like an empty
  list.
- **LOW (positive) — Empty states are excellent and consistent.** Dashed-border, icon + message,
  search-aware variants everywhere (`StaffPage.tsx:312`, `ClientsPage.tsx:224`, etc.). Copy/clipboard
  feedback (`StaffPage.tsx:229`) and the Copilot suggested-prompt chips
  (`CopilotChatPage.tsx:293`) are nice micro-interactions.

---

## 6. Healthcare-specific UX (EVV / compliance / HIPAA)

- **HIGH — Unmasked PHI in the clinical roster.** `ClientsPage.tsx:206` renders the full Medicaid
  number as a `Badge`, and `:203` shows full DOB, in a plain always-on table with no masking,
  reveal-on-demand, or access logging surfaced in the UI. Medicaid ID + DOB + name together is a
  strong re-identification set; for a HIPAA-conscious product these should be masked by default
  (`•••• 1234`) with an explicit reveal. The landing page even advertises "PHI scoped per agency
  and capability" (`LandingPage.tsx:71`) — the UI should reflect minimum-necessary display.
- **MEDIUM — Family role can request PHI through the Copilot with no visible guardrail.**
  `CopilotChatPage.tsx:87-91` seeds family-role suggested prompts like "Read me the visit notes
  from this morning." Authorization is asserted to be backend-enforced, but the UI presents no
  scope indicator/disclaimer for family users beyond the generic footer.
- **MEDIUM — EVV verification surface is thin.** `VisitReviewPage.tsx` lists clock-in/out
  timestamps + status, but the six federal EVV elements the marketing site promises
  (GPS accuracy, identity, location, service code — `LandingPage.tsx:36`) are **not shown** in the
  review row. A coordinator can't actually *verify* the visit (no map, no GPS coordinates, no
  service-code/task detail, no visit timeline) — only request a correction. This is the core
  workflow and it's underbuilt.
- **MEDIUM — No GPS / map / visit-timeline component exists** anywhere in the web package. For an
  EVV product this is a notable gap on the review side (presumably it lives in the Capacitor mobile
  app, but coordinators reviewing on web get none of it).
- **LOW (positive) — Signature & audit affordances are present and well-modeled.** The corrections
  queue surfaces caregiver/client signature presence with pass/fail pills and an incomplete-
  signature justification (`VisitCorrectionsQueuePage.tsx:392-434`), reason/correction code
  dictionaries are decoded to human labels (`:61-85`), the override flow explicitly states the
  reason is written to the audit log (`AssignmentsPage.tsx:251`), and the compliance gate blocks
  non-credentialed assignments with a "Resolve training →" deep link
  (`AssignmentsPage.tsx:492-538`). These are the healthcare-savvy bright spots.

---

## 7. Prioritized remediation

| # | Severity | Fix | Anchor |
|---|----------|-----|--------|
| 1 | CRITICAL | Make `AdminLayout` responsive: off-canvas drawer + hamburger below `lg` | `App.tsx:118-160` |
| 2 | CRITICAL | Darken `--muted-foreground` (and accent-as-text) to ≥4.5:1 | `index.css:70,71` |
| 3 | HIGH | Mount a single `<Toaster/>`, migrate inline `setTimeout` banners to `toast()` | `main.tsx`, `ui/sonner.tsx` |
| 4 | HIGH | Replace `window.prompt` override with a `Dialog` + labeled textarea | `AssignmentsPage.tsx:250` |
| 5 | HIGH | Replace ISO text inputs with `datetime-local` pickers | `VisitCorrectionsQueuePage.tsx:317-336` |
| 6 | HIGH | Label the Copilot textarea; add `scope="col"` to `TableHead` | `CopilotChatPage.tsx:336`, `ui/table.tsx:66` |
| 7 | HIGH | Mask Medicaid # + DOB by default with reveal-on-demand | `ClientsPage.tsx:203,206` |
| 8 | HIGH | Add breadcrumbs to deep Learning routes | `App.tsx:182-187` |
| 9 | MEDIUM | Skeleton loaders; stop swallowing fetch errors into empty lists | §1, §5 |
| 10 | MEDIUM | Wire `aria-invalid`/`aria-describedby` field-level errors; focus `<h1>` on route change; add admin skip-link; `prefers-reduced-motion` | §3 |
| 11 | MEDIUM | Resolve UUID→name in Visit Review & corrections pages | `VisitReviewPage.tsx:127`, `VisitCorrectionsTrackingPage.tsx` |
| 12 | MEDIUM | Build a real EVV verification panel (GPS/map/timeline/EVV elements) | `VisitReviewPage.tsx` |

### Quick wins (low effort, high payoff)
- Mount `<Toaster/>` (one line) and the notification story becomes consistent product-wide.
- Bump two CSS custom properties (#2) clears the single largest pile of AA failures.
- Add `scope="col"` once in `ui/table.tsx` fixes every table.
- Swap `window.prompt` and the ISO inputs — small, removes the two ugliest interaction moments.
- Add `aria-label` to the Copilot textarea and `aria-label`/section `<h2>`s in the sidebar nav.
