# 05 — Screen Inventory & Gap Analysis

**Scope:** `packages/web` (RayHealth EVV web frontend)
**Date:** 2026-06-27
**Author:** Product Architect (screen inventory pass)
**Method:** Read `src/App.tsx` route map + every `*Page.tsx` / major panel & modal across `src/features/*`. Read-only; no source modified.

---

## 1. Stack & App-Shell Summary

- **Routing:** `react-router-dom` v6, single `<Routes>` tree in `src/App.tsx`.
- **Design system:** Tailwind + a thin shadcn/ui layer in `src/components/ui/` — present primitives: `badge, button, card, dialog, input, label, select, sonner (toast), table`. Notably **absent**: avatar, dropdown-menu, command, popover, tabs, sheet, breadcrumb, tooltip, skeleton.
- **Shared chrome:** `src/components/PageHeader.tsx` (title + description + actions slot) — used consistently across admin pages.
- **App shell:** `AdminLayout` (defined inline in `App.tsx`, lines 115-161): fixed 64-unit **left sidebar** with brand lockup, 4 grouped nav sections (Organization / Scheduling / Visits / Workforce), and a Sign Out button. **There is no top header bar** — no global search, no notification bell, no profile/avatar menu, no breadcrumbs, no command palette.
- **Auth gating:** `ProtectedRoute` (lines 38-46) checks `useAuth().isAuthenticated`, redirects to `/login`.

---

## 2. Route Map (from `App.tsx`)

| Path | Component | Layout | Access | Notes |
|------|-----------|--------|--------|-------|
| `/` | `LandingPage` | none (full-bleed) | Public | Marketing site |
| `/login` | `LoginPage` | none (centered card) | Public | |
| `/accept/:token` | `AcceptInvitePage` | none (centered card) | Public | Magic-link onboarding |
| `/admin` (index) | → redirect to `/admin/agency` | — | Auth | **No dashboard landing** |
| `/admin/agency` | `AgencySetupPage` | AdminLayout | Auth | Default post-login screen |
| `/admin/settings` | `AgencySettingsPage` | AdminLayout | Auth (admin-gated UI) | |
| `/admin/staff` | `StaffPage` | AdminLayout | Auth | |
| `/admin/clients` | `ClientsPage` | AdminLayout | Auth | |
| `/admin/authorizations` | `AuthorizationsPage` | AdminLayout | Auth | |
| `/admin/templates` | `TemplatesPage` | AdminLayout | Auth | |
| `/admin/assignments` | `AssignmentsPage` | AdminLayout | Auth | |
| `/admin/review` | `VisitReviewPage` | AdminLayout | Auth | |
| `/admin/corrections` | `VisitCorrectionsQueuePage` | AdminLayout | Auth | |
| `/admin/corrections/tracking` | `VisitCorrectionsTrackingPage` | AdminLayout | Auth | |
| `/admin/learning` | `LearningDashboardPage` | AdminLayout | Auth | Only true "dashboard" in app |
| `/admin/learning/courses` | `CourseCatalogPage` | AdminLayout | Auth | |
| `/admin/learning/courses/:id` | `CourseDetailPage` | AdminLayout | Auth | |
| `/admin/learning/caregivers/:id` | `CaregiverLearningPage` | AdminLayout | Auth | |
| `/admin/learning/analytics` | `LearningAnalyticsPage` | AdminLayout | Auth | |
| `/admin/learning/copilot` | `CopilotChatPage` | AdminLayout | Auth | AI add-on |
| `*` | → redirect to `/` | — | — | Catch-all |

**Observation:** The entire authenticated product is a single flat `/admin/*` namespace targeted at the **agency admin/coordinator** persona. There are no role-segmented home routes (caregiver, family, executive) despite the data model carrying `admin | coordinator | caregiver | family` roles.

---

## 3. Screen-by-Screen Inventory

UX maturity scale: **1** = raw/unstyled, **3** = standard component-library CRUD, **5** = polished enterprise SaaS.

| # | Screen / Route | Purpose | Primary Entities | Key Components | UX (1-5) | Data |
|---|----------------|---------|------------------|----------------|:---:|------|
| 1 | **LandingPage** `/` | Public marketing: product overview, compliance proof, roadmap, FAQ | Static content (stats, roles, roadmap, FAQs) | Sticky header, hero w/ gradients, stat strip, step/role/compliance grids, collapsible FAQ, CTA, footer, `HeroGraphic` | **5** | Static |
| 2 | **LoginPage** `/login` | Auth entry to admin console | Email + password | Centered Card, gradient bg, branded ShieldCheck badge, Input, Button w/ loading | **5** | Real (`AuthContext.login`) |
| 3 | **AcceptInvitePage** `/accept/:token` | Magic-link account creation + access-code validation | Invite (email, role, agency, expiry), new-account fields | Centered Card, multi-field form, alert states for expired/revoked/accepted | **5** | Real (GET/POST `/api/invites/accept/:token`) |
| 4 | **AgencySetupPage** `/admin/agency` | Configure agency identity (name; state read-only) | Agency | Card, Label, Input, Button, inline messages | **3** | Real (GET/PUT `/api/agencies/current`) |
| 5 | **AgencySettingsPage** `/admin/settings` | Agency-wide feature toggles + integrations (Sandata, HHAExchange, EVV aggregator, notifications, AI copilot) | AgencyFeatures, Sandata/HHAExchange configs, EvvConfig | Cards, Badges, option-card toggles, mapping editor tables, Select/Input, admin-gated save, saved-at timestamp | **4** | Real (GET/PUT `/api/agencies/me/features` + integration PUTs) |
| 6 | **StaffPage** `/admin/staff` | Invite/onboard staff + browse directory | Staff (email, role, status), Invite (acceptanceUrl, expiry, emailSent) | Two-col Card form+table, Select role, invite-result box w/ email-status badge, copy-to-clipboard, Table, Search | **4** | Real (GET `/api/staff`, POST `/api/invites`) |
| 7 | **ClientsPage** `/admin/clients` | Add clients + searchable roster | Client (name, DOB, medicaidNumber) | Two-col Card form+table, Input, Table, Badge, Search, empty state | **4** | Real (GET/POST `/api/clients`) |
| 8 | **AuthorizationsPage** `/admin/authorizations` | Record payer service authorizations | Authorization (client, payer, serviceCode, units, dates) | Two-col Card form+table, date/number Inputs, Table, Badge, Search | **3** | Real (GET/POST `/api/authorizations`) |
| 9 | **TemplatesPage** `/admin/templates` | Build reusable plan-of-care templates w/ task assignment | Template (name, clientId, tasks), PATask duties | Two-col Card, checkbox task list (scrollable), Search, Table, Badge | **4** | Real (GET `/api/templates`,`/api/tasks`; POST `/api/templates`) |
| 10 | **AssignmentsPage** `/admin/assignments` | Assign caregivers to visits w/ training-compliance gating + override | Assignment (caregiver, client, template, date), compliance blockers | Card form+table, Selects, debounced preflight compliance check, ComplianceBlockerBanner (audit-logged override), Table, Search | **4** | Real (GET staff/templates/clients/assignments + compliance-check; POST `/api/assignments`) |
| 11 | **VisitReviewPage** `/admin/review` | Review pending EVV visits, request correction/unlock | EVV visit (caregiver, clock in/out, status) | Card, Table, Badge, status banner, Button | **3** | Real (GET `/api/evv/visits`, POST `/api/maintenance/request-unlock`) |
| 12 | **VisitCorrectionsQueuePage** `/admin/corrections` | Approve/reject visit maintenance unlock requests (VMUR) w/ time adjustments | VMUR (reason/correction codes, timestamps, signatures, originator) | Card-based queue items, approve↔reject mode toggle, ISO datetime Inputs, textarea, signature blocks, Badges | **4** | Real (GET `/api/maintenance/queue`; approve/reject POSTs) |
| 13 | **VisitCorrectionsTrackingPage** `/admin/corrections/tracking` | Historical read-only VMUR audit w/ multi-axis filters | VMUR (all statuses), signatures, requester/approver | Filter-bar Card, Selects, Table, status/signature badges, empty state | **4** | Real (GET `/api/maintenance/history`) |
| 14 | **LearningDashboardPage** `/admin/learning` | Training compliance at-a-glance (the app's only dashboard) | LearningAgencyRollup (caregivers, enrollments, status counts, compliance rate) | PageHeader w/ actions, InsightsPanel, KPI cards, status grid, stacked ComplianceBar, alert banner, AICopilotPanel, EnrollCaregiverModal | **5** | Real (GET `/api/learning/dashboard`) |
| 15 | **CourseCatalogPage** `/admin/learning/courses` | Browse/search training courses | LearningCourse (title, code, cadence, duration, required, expiry) | Cards, Search, Badges, icons | **4** | Real (GET `/api/learning/courses`) |
| 16 | **CourseDetailPage** `/admin/learning/courses/:id` | Course detail + caregiver enrollment status grouped by state | LearningCourse, CourseEnrollment, caregiver rows | Cards, status-sorted Table, color Badges, links | **4** | Real (GET `/api/learning/courses/:id/caregivers`) |
| 17 | **CaregiverLearningPage** `/admin/learning/caregivers/:id` | Per-caregiver enrollments, mark complete, assign courses | CaregiverLearningProgress, enrollments, compliance flag | Card, Table, status Badges, Button w/ loading, EnrollCaregiverModal | **4** | Real (GET `/api/learning/caregivers/:id`, POST `/api/learning/complete`) |
| 18 | **LearningAnalyticsPage** `/admin/learning/analytics` | Per-course completion metrics + bottleneck signals | CourseAnalyticsRow (completion rate, overdue/expired/pending, avg days) | Metric cards, Table, custom CompletionBar (color gradient), action-count badges | **5** | Real (GET `/api/learning/analytics`) |
| 19 | **CopilotChatPage** `/admin/learning/copilot` | Role-scoped conversational AI w/ action-confirmation | CopilotStatus, conversation turns, proposed actions | Card, textarea, auto-scroll thread, suggested prompts, confirm/decline action UX, Badge | **4** | Real (GET status, POST ask/execute) |

### Supporting panels / modals (not routed)
| Component | Used by | Purpose | UX |
|-----------|---------|---------|:---:|
| `InsightsPanel` | Learning dashboard | Severity-ranked compliance signals (due/expired/stalled) | 4 |
| `AICopilotPanel` | Learning dashboard | Locked/unlocked AI add-on entry surface, feature-flag gated | 4 |
| `EnrollCaregiverModal` | Dashboard, caregiver page | Bulk enroll w/ smart due-date defaults | 4 |
| `HeroGraphic` | Landing | Decorative hero SVG | 5 |
| `PageHeader` | All admin pages | Shared title/description/actions block | 4 |

**Maturity distribution:** Public/auth screens and the Learning vertical are the strongest (4-5). Core agency/EVV CRUD screens cluster at 3-4 — functional, consistent shadcn styling, but plain two-column "form-left / table-right" patterns with little data visualization, bulk action, pagination, or detail-drill depth.

---

## 4. Gap Analysis vs. Target Feature Set

Legend: **EXISTS** (with quality note) / **PARTIAL** / **MISSING**

| Target Capability | Status | Evidence / Quality |
|-------------------|:------:|--------------------|
| **Executive Dashboard** | **MISSING** | No org-level home. `/admin` index redirects to Agency Setup. Only domain dashboard is Learning Hub. No KPIs for census, visits, revenue, compliance, alerts. |
| **App shell: Sidebar** | **EXISTS (3/5)** | Grouped sidebar in `AdminLayout`. Solid but static — no collapse, no role-awareness, no active-section breadcrumb. |
| **App shell: Top Header** | **MISSING** | No header bar at all. No place for search, notifications, profile, org switcher. |
| **Profile** | **MISSING** | No profile/account page or avatar menu. `useAuth().user` exists but is never surfaced. |
| **Auth (login/register)** | **EXISTS (5/5)** | Polished Login + invite-based AcceptInvite. No self-serve register (invite-only by design). |
| **Agency onboarding** | **PARTIAL (3/5)** | AgencySetupPage = name only; AgencySettingsPage = deep config. No guided multi-step onboarding wizard. |
| **Employee onboarding** | **EXISTS (4/5)** | StaffPage invite flow + AcceptInvitePage. No document collection / I-9 / credential capture step. |
| **Patient/Client management** | **PARTIAL (4/5)** | ClientsPage adds + lists. No client **detail** page, no demographics depth, no care plan / contacts / authorizations linkage view. |
| **Scheduling** | **PARTIAL (4/5)** | Templates + Assignments exist with strong compliance gating. **No calendar view**, no recurring shifts, no drag-drop, no open-shift board. |
| **Visits / EVV** | **EXISTS (3-4/5)** | Review + Corrections Queue + Corrections Tracking are real and reasonably mature. No live visit map, no GPS/EVV verification visualization, no real-time visit board. |
| **Timesheets** | **MISSING** | No timesheet screen. (Visit times exist in EVV but not aggregated into payable timesheets.) |
| **Payroll** | **MISSING** | None. |
| **Billing** | **PARTIAL (config only)** | AgencySettings holds aggregator/billing integration config (Sandata/HHAExchange) but **no claims/billing workflow screen**. |
| **Compliance** | **PARTIAL (4/5)** | Strong training-compliance vertical (Learning analytics, insights, assignment gating). No unified compliance center across credentials, EVV, docs, auth expiry. |
| **Training / Learning** | **EXISTS (5/5)** | Most complete vertical: dashboard, catalog, course detail, per-caregiver, analytics, AI copilot. |
| **Documents** | **MISSING** | No document upload/library/e-sign anywhere. |
| **Messaging** | **MISSING** | No in-app messaging/inbox. AI Copilot is the only conversational surface. |
| **Reports** | **MISSING** | No reporting/export center (Learning Analytics is the closest, scoped to training only). |
| **Analytics** | **PARTIAL (5/5 but narrow)** | Excellent Learning Analytics; nothing org-wide (visits, payroll, census, revenue). |
| **Settings** | **PARTIAL (4/5)** | Agency-level settings deep + good; no **personal/user** settings, notifications prefs, security/MFA. |
| **Notifications** | **MISSING** | Sonner toasts wired for transient feedback; no persistent notification center / bell / inbox. |
| **Calendar** | **MISSING** | No calendar component anywhere despite scheduling domain. |
| **Command palette** | **MISSING** | No `cmdk`/command primitive. |
| **Global search** | **MISSING** | Only per-page table filters; no cross-entity global search. |
| **Notification center** | **MISSING** | See Notifications. |

**Scorecard:** EXISTS 5 · PARTIAL 7 · MISSING 12 (of 24 target capabilities).

---

## 5. The Single Biggest Gap

**There is no Executive Dashboard and no complete authenticated app shell.**

1. **No executive/home dashboard.** After login, an admin lands on *Agency Setup* (a name-edit form). There is no org-level command center summarizing the things an owner/administrator cares about — active census, today's visits and exceptions, EVV compliance %, overdue training, expiring authorizations, unbilled visits, staff alerts. The only dashboard that exists (Learning Hub) is excellent and is the obvious **template/pattern** for the executive dashboard, but it is scoped to one domain.

2. **Half a shell.** The left sidebar is good; the **top header is entirely missing**, which means there is nowhere for the four cross-cutting capabilities a premium SaaS expects — **global search, command palette, notification center, and profile/account menu** — to live. All four are MISSING largely because the shell has no home for them.

These two gaps are what most separate the current product from "premium enterprise healthcare SaaS." Everything else is a content/feature gap; this is a **structural/navigational** gap that every other screen sits inside.

---

## 6. Recommended Redesign Priority Order

Ordered by user-visible impact × first-impression weight × structural leverage.

**P0 — Structural foundation (unblocks everything)**
1. **Authenticated App Shell v2** — add a top header (global search field, command palette `⌘K`, notification bell, profile/avatar menu w/ org switcher), make the sidebar role-aware + collapsible, add breadcrumbs. Highest leverage: every screen lives inside it.
2. **Executive Dashboard** at `/admin` (replace the redirect-to-setup). Reuse the Learning dashboard's KPI-card + InsightsPanel pattern: census, today's visits & exceptions, EVV compliance, training compliance, expiring auths, alerts. This is the first screen every admin sees — biggest perception win.

**P1 — Highest-traffic operational screens**
3. **Scheduling → Calendar** — upgrade Assignments/Templates with a real calendar/visit-board view (the most-used daily surface for coordinators).
4. **Visits/EVV board** — a live visit-status surface (in addition to the existing review/corrections queues), with map/GPS verification.
5. **Client detail page** — turn Clients from a flat roster into a 360° record (demographics, authorizations, care plan, visit history, documents).

**P2 — Close the enterprise feature gaps**
6. **Notification center** (persistent, backed by real events — pairs with the new header).
7. **Profile & personal Settings** (account, security/MFA, notification prefs).
8. **Reports/Analytics center** — org-wide reporting beyond training.
9. **Documents** library (upload, e-sign, credential storage) — also feeds Employee onboarding and Compliance.
10. **Unified Compliance center** — aggregate training + credentials + EVV + auth-expiry.

**P3 — New verticals (larger build, lower polish-ROI for redesign)**
11. **Timesheets → Payroll → Billing/Claims** workflow screens.
12. **Messaging/Inbox.**

**Quick polish pass (parallel, low-effort):** lift the 3/5 CRUD screens (AgencySetup, Authorizations, VisitReview) to 4/5 with empty-state art, pagination, bulk actions, and detail drawers — cheap consistency wins while the P0/P1 work proceeds.

---

*End of report.*
