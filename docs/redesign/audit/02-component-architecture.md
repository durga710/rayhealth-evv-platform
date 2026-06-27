# 02 — Component Architecture Audit

**Scope:** `packages/web/src` frontend (React 19, Tailwind 4, shadcn-style primitives).
**Date:** 2026-06-27
**Author:** Component Library Engineer
**Method:** Full read of `src/components/ui/*`, `PageHeader`, `lib/utils`, `App.tsx`, plus a representative sample of feature pages (clients, staff, authorizations, scheduling/assignments, learning dashboard, evv corrections queue, agency settings, enroll modal) and repo-wide grep for duplication / dead-code / quality signals.

Severity tags: **CRITICAL** (data/security risk), **HIGH** (significant quality/maintainability), **MEDIUM** (maintainability), **LOW** (style/nice-to-have).

---

## 1. Inventory of Existing Reusable Primitives

All primitives live in `src/components/ui/` and are genuine shadcn-style implementations (CVA + `data-slot` + `cn()` from `tailwind-merge`), not thin wrappers. Quality of the primitives themselves is good. Coverage is the problem — the set is far too small for an enterprise admin app.

| Primitive | File | Variants / API | Quality | Consumers |
|---|---|---|---|---|
| **Button** | `ui/button.tsx` | `variant`: default, accent, destructive, outline, secondary, ghost, link · `size`: default, sm, lg, icon · `asChild` | Real shadcn, full CVA. Solid. | 21 |
| **Badge** | `ui/badge.tsx` | `variant`: default, secondary, accent, success, warning, destructive, outline · `asChild` | Real shadcn. Good status coverage. | 16 |
| **Card** | `ui/card.tsx` | Compound: Card/Header/Title/Description/Action/Content/Footer | Real shadcn. Good. | 20 |
| **Dialog** | `ui/dialog.tsx` | Radix wrapper, full compound set | Real shadcn (Radix). | **1** (only `EnrollCaregiverModal`) |
| **Input** | `ui/input.tsx` | Single styled `<input>`, no variants/sizes | Real shadcn. No `size`/`error` variant. | 12 |
| **Label** | `ui/label.tsx` | Plain `<label>` (not Radix `@radix-ui/react-label`) | Adequate; no Radix peer-association. | 12 |
| **Select** | `ui/select.tsx` | Native `<select>` wrapper w/ chevron. Documented as deliberate non-Radix. | Pragmatic; no listbox/search/multi. | 5 |
| **Table** | `ui/table.tsx` | Compound primitives (Header/Body/Row/Head/Cell/Footer/Caption) | Real shadcn. **Presentational only** — no sort/filter/paginate/selection. | 11 |
| **Sonner / Toaster** | `ui/sonner.tsx` | Toaster mount wrapper | Real, **but DEAD — never mounted, `toast()` never called** (see §3). | **0** |
| **PageHeader** | `components/PageHeader.tsx` | `title`, `description`, `actions`, `className` | Good, used widely (17 refs). The one healthy app-level shared component. | 17 |

**Utilities:** `lib/utils.ts#cn` (correct twMerge+clsx). `lib/api-client.ts` exposes `getJson`/`postJson`/`putJson`/`HttpError` — clean and well-typed.

---

## 2. Duplication — Repeated Markup That Should Be Extracted

The feature pages were clearly authored independently and copy-paste the same scaffolding. This is the single biggest architecture problem.

### 2.1 `EmptyState` — copy-pasted 13 times — **HIGH**
Identical (modulo the icon) local `function EmptyState({ message })` is redefined in 13 files:
`features/clients/ClientsPage.tsx:224`, `features/staff/StaffPage.tsx:312`, `features/authorizations/AuthorizationsPage.tsx:257`, `features/scheduling/AssignmentsPage.tsx:540`, `features/scheduling/TemplatesPage.tsx:248`, `features/learning/CourseDetailPage.tsx:261`, `features/learning/CourseCatalogPage.tsx:166`, `features/learning/CaregiverLearningPage.tsx:276`, `features/learning/LearningAnalyticsPage.tsx:312`, `features/agency/AgencySettingsPage.tsx:54`, `features/evv/VisitReviewPage.tsx:164`, `features/evv/VisitCorrectionsQueuePage.tsx:222`, `features/evv/VisitCorrectionsTrackingPage.tsx:313`.
The markup string `flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center` appears in all 14 (CopilotChatPage too). → Extract `ui/empty-state.tsx` with `icon`, `title`, `description`, optional `action` props.

### 2.2 Inline status banners (alert/success/warning) — ~34 hand-rolled — **HIGH**
There is no `Alert` component. Pages hand-roll `role="alert"`/`role="status"` divs with literal class strings:
- Destructive banner class `border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive` appears 22 times.
- Success banner `border border-emerald-200 bg-emerald-50 ... text-emerald-800` appears 9 times.
- 34 total `role="alert"|"status"` elements across features.
Examples: `ClientsPage.tsx:142-153`, `StaffPage.tsx:186-193`, `AssignmentsPage.tsx:402-413`, `LearningDashboardPage.tsx:99-106`, `VisitCorrectionsQueuePage.tsx:170-186`. `AgencySettingsPage.tsx:45-52` even hoists them into local `const errorMessageClass`/`successMessageClass`/`readOnlyNoticeClass` strings — a private mini-design-system that should be a shared `Alert` with `variant`.

### 2.3 Two-column "form + roster table" page layout — 5 near-identical pages — **HIGH**
`ClientsPage`, `StaffPage`, `AuthorizationsPage`, `AssignmentsPage`, `TemplatesPage` all share the exact grid `grid-cols-1 ... lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]` (form Card left, searchable roster Card right). Each re-implements: the same `CardHeader` search-bar row (`sm:flex-row sm:items-center sm:justify-between`, 6 occurrences), the same search `<Input>` with absolutely-positioned `Search` icon + `pl-9` (7 occurrences), the same `useMemo` client-side filter, the same three-state render (`length===0` / `filtered===0` / table), and the same `<div className="overflow-hidden rounded-lg border border-border"><Table>...`. → Extract a `SearchInput`, a `DataTable`/`TableCard` (with built-in search + empty states), and a `FormCard`/`TwoColumnListLayout`.

### 2.4 Stat / KPI tiles — re-invented per page — **MEDIUM**
At least 4 separate stat-tile components: `KpiCard` & `StatusCard` (`LearningDashboardPage.tsx:191,208`), `MetricCard` (`LearningAnalyticsPage.tsx:230`). All render "muted label + big number". → One `StatCard` with `label`, `value`, `icon?`, `accent?`, `trend?`.

### 2.5 EVV aggregator config sections — Sandata vs HHAeXchange ~95% duplicate — **HIGH**
`AgencySettingsPage.tsx` is **1816 lines** (well over the 800-line review threshold). `SandataConfigSection` (`:344`) / `SandataCaregiverMappingsEditor` (`:565`) / `SandataServiceMappingsEditor` (`:726`) are near-line-for-line clones of `HhaexchangeConfigSection` (`:1215`) / `HhaexchangeCaregiverMappingsEditor` (`:1515`) / `HhaexchangeServiceMappingsEditor` (`:1674`) — same load/save/error pattern, same mappings-table editor, same identity fieldset. → Extract a generic `MappingsTableEditor<T>` and a `ConfigSection` shell; split this file into `features/agency/settings/*`.

### 2.6 Toggle-row & option-card form controls — **MEDIUM**
`AgencySettingsPage.tsx:34-43` defines `optionCard(active)` (radio "card" selector) and `toggleRowClass` (checkbox row) used ~10 times in that one file, plus raw `<input type="checkbox">`/`type="radio"` appear 12 times repo-wide with ad-hoc styling (e.g. `EnrollCaregiverModal.tsx:272`, `:248-255` checkbox list). No `Checkbox`, `RadioGroup`, `Switch`, or `RadioCard` primitive exists. → Add Radix-backed `Checkbox`, `Switch`, `RadioGroup`, and a `RadioCard`.

### 2.7 Detail "Field" / label-value pairs — **LOW**
`VisitCorrectionsQueuePage.tsx:440` `Field`, `:426` `SigPill` are local one-offs that recur conceptually elsewhere. → `DescriptionList`/`Field` primitive.

---

## 3. Dead Code / Unused Exports

- **Sonner toast stack is entirely unwired — MEDIUM/HIGH.** `ui/sonner.tsx` `Toaster` has **0 imports**, is never mounted (not in `App.tsx` or `main.tsx`), and `toast(` is never called anywhere. The `sonner` npm dependency is dead weight. Meanwhile pages hand-roll ephemeral toasts: `VisitCorrectionsQueuePage.tsx:115` `flashToast` + `setTimeout`. → Either mount `<Toaster>` and adopt `toast()`, or remove the dep. (Recommend adopt — see §5.)
- **`AgencySettingsPage` re-implements `putJson` + `readCsrfToken` locally — HIGH.** `api-client.ts:55` already exports a CSRF-aware `putJson`, and `AgencySetupPage.tsx:3` imports it correctly. But `AgencySettingsPage.tsx:101-125` defines a duplicate local `putJson` and `readCsrfToken` (with a comment rationalizing the copy). This duplicates security-sensitive CSRF logic — delete the local copy, import the shared one.
- **`void postJson;` warning-suppression hack — MEDIUM.** `AgencySettingsPage.tsx:1816` imports `postJson` only to `void` it at file end ("in case the page grows"). Dead import; remove.
- No other unused exports found. No `any`, no `React.FC` (good — see §4). Note: this is a candidate list verified by grep for imports; the Sonner and local-`putJson` items are confirmed.

---

## 4. TypeScript / Code Quality

Generally **strong** and conformant to the repo's coding-style rules:
- **No `any`** anywhere in app code (grep clean). External error bodies are typed `unknown` then narrowed via `HttpError` — exactly the prescribed pattern (e.g. `AssignmentsPage.tsx:228-235`).
- **No `React.FC`.** Props are named interfaces. Good.
- Explicit return types are used inconsistently — some components annotate `: ReactElement`/`: React.JSX.Element` (`VisitCorrectionsQueuePage`, `AgencySettingsPage`), most don't (`ClientsPage`, `AuthorizationsPage`). **LOW** — pick one convention.

Issues:
- **Ad-hoc class strings instead of CVA — HIGH (architectural).** Status colors (emerald/amber/destructive) are hard-coded as literal Tailwind strings in dozens of places rather than expressed as variants on a shared `Alert`/`StatCard`. This is the root cause of §2.2/§2.4.
- **Raw `<textarea>` with a copied class string — MEDIUM.** `VisitCorrectionsQueuePage.tsx:357-365` and `CopilotChatPage` use bare `<textarea>` with an inline approximation of the Input styling. No `Textarea` primitive exists.
- **Inline `style={{}}` — LOW, mostly acceptable.** Concentrated in `LandingPage.tsx` (gradients/SVG, fine) and `LearningDashboardPage.tsx:237-251` / `LearningAnalyticsPage.tsx:273` (data-driven bar widths/colors — legitimately dynamic). One avoidable case: `lib/AuthContext.tsx:81` full-screen loading uses inline style instead of a `Spinner`/`LoadingScreen` component.
- **Hard-coded hex palette — MEDIUM.** `LearningDashboardPage.tsx:224-229` `ComplianceBar` hard-codes `#10A4A4`, `#185FA5`, etc. instead of CSS theme vars — will drift from the redesign token system.
- **`console.error` in data load — LOW.** `AuthorizationsPage.tsx:49` `.catch(console.error)` (other pages silently swallow). Inconsistent error handling.
- **No data-fetching abstraction — MEDIUM.** 20 files repeat the same `useEffect` + `getJson<ApiResponse<T>>` + `cancelled` flag + loading/error `useState` triad. A `useApiResource`/`useQuery`-style hook would remove ~15 lines per page and standardize loading/error UI.

---

## 5. Gaps — Existing vs Needed (Enterprise Component Library)

| Component | Status | Need | Priority |
|---|---|---|---|
| Button, Badge, Card, Input, Label, Select(native), Table(static), Dialog, PageHeader | **Have** | Keep | — |
| **EmptyState** | Missing (13× inline) | Yes | P0 |
| **Alert / Banner** (variant: info/success/warning/error) | Missing (34× inline) | Yes | P0 |
| **DataTable** (sort, filter, paginate, selection, empty/loading) | Missing (Table is static) | Yes | P0 |
| **SearchInput** | Missing (7× inline) | Yes | P0 |
| **Toast** (Sonner) | Present but **unwired** | Mount + adopt | P0 |
| **StatCard / KPI** | Missing (4× inline) | Yes | P1 |
| **Skeleton / Spinner / LoadingScreen** | Missing (text "Loading…" everywhere) | Yes | P1 |
| **Checkbox / Switch / RadioGroup / RadioCard** | Missing (raw inputs, 12×) | Yes | P1 |
| **Textarea** | Missing (raw, 2×) | Yes | P1 |
| **Form field row** (Label+control+error+hint) | Missing (`space-y-1.5` repeated) | Yes | P1 |
| **DropdownMenu** | Missing | Yes (row actions, user menu) | P1 |
| **Tabs** | Missing | Yes (settings, learning) | P1 |
| **Tooltip** | Missing | Yes | P2 |
| **Pagination** | Missing | Yes (pairs w/ DataTable) | P1 |
| **Breadcrumb** | Missing | Yes (deep learning routes) | P2 |
| **Avatar** | Missing | Yes (staff/caregiver) | P2 |
| **Sheet / Drawer** | Missing | Yes (filters, mobile nav) | P2 |
| **Popover** | Missing | Yes (foundation for date/combobox) | P2 |
| **Combobox / searchable Select / multi-select** | Missing (native only) | Yes | P2 |
| **Date Picker** | Missing (native `type=date`) | Optional | P3 |
| **Command palette** | Missing | Optional (premium) | P3 |
| **DescriptionList / Field** | Missing (inline) | Nice | P3 |
| **AppShell / Sidebar** | Inline in `App.tsx:115` | Extract for reuse/testability | P2 |

Radix is already a dependency boundary the team accepts (`@radix-ui/react-dialog`, `react-slot`). Most P1/P2 items are direct shadcn copy-ins (`@radix-ui/react-dropdown-menu`, `-tabs`, `-tooltip`, `-checkbox`, `-switch`, `-radio-group`, `-popover`, `-avatar`).

---

## 6. Recommended Target Structure & Build Order

### Target structure
```
src/components/
  ui/                      # primitives (shadcn copy-ins, one concern each)
    button, badge, card, input, label, textarea, select, checkbox,
    switch, radio-group, dialog, sheet, popover, dropdown-menu, tabs,
    tooltip, avatar, alert, empty-state, skeleton, spinner, toast(sonner),
    pagination, breadcrumb, table
  patterns/                # app-level composites built from ui/
    data-table.tsx         # Table + search + sort + paginate + empty/loading
    stat-card.tsx
    search-input.tsx
    form-card.tsx / form-field.tsx
    config-section.tsx + mappings-table-editor.tsx
    page-header.tsx        # move from components/
  layout/
    app-shell.tsx, sidebar.tsx   # extracted from App.tsx
src/hooks/
  use-api-resource.ts      # standardize getJson + loading/error/cancelled
src/lib/
  utils.ts, api-client.ts  # delete duplicate putJson in agency settings
```

### Build order (each step deletes duplication immediately)
1. **P0 foundations (highest dedup ROI):**
   `Alert` (kills 34 inline banners) → `EmptyState` (kills 13 copies) → `SearchInput` → mount `Toaster` + swap `flashToast`/banner-on-success to `toast()`.
2. **P0 DataTable + Pagination:** wrap `ui/table` into `patterns/data-table` with search/sort/empty/loading; migrate the 5 roster pages (Clients, Staff, Authorizations, Assignments, Templates) onto it via the new `TwoColumnListLayout`/`FormCard`.
3. **P1 form & feedback primitives:** `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `RadioCard`, `FormField`, `Skeleton`/`Spinner`. Then refactor `AgencySettingsPage` into `features/agency/settings/*` using a generic `MappingsTableEditor<T>` + `ConfigSection` (collapses ~700 duplicated lines; removes the local `putJson`/`readCsrfToken`/`void postJson`).
4. **P1 StatCard + `useApiResource` hook:** migrate Learning dashboard/analytics; move `ComplianceBar` colors to theme tokens.
5. **P1/P2 navigation & overlays:** `DropdownMenu` (table row actions, sign-out menu), `Tabs`, extract `AppShell`/`Sidebar` from `App.tsx`.
6. **P2:** `Tooltip`, `Avatar`, `Sheet`, `Popover`, `Breadcrumb`, `Combobox`.
7. **P3 (premium polish):** `DatePicker`, `Command` palette, `DescriptionList`.

### Cleanups to fold in
- Delete local `putJson`/`readCsrfToken` in `AgencySettingsPage.tsx:101-125`; import from `api-client`.
- Remove `void postJson;` (`AgencySettingsPage.tsx:1816`) and the dead import.
- Decide Sonner: adopt (recommended) or drop the dep.
- Standardize component return-type annotations and data-load error handling.
