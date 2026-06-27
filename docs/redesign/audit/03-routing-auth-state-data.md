# Audit 03 — Routing, Auth, State Management & Data Layer

**Scope:** `packages/web` (React 19, React Router 7, Tailwind 4)
**Date:** 2026-06-27
**Auditor:** Senior Frontend Architect (read-only)
**Method:** Static read of `src/main.tsx`, `src/App.tsx`, `src/lib/*`, `src/features/auth/*`, and a representative sweep of feature pages.

Severity tags: **CRITICAL** (correctness/security/redesign-blocking) · **HIGH** · **MEDIUM** · **LOW**.

---

## 1. Routing

### Current shape
- **Single central router**, JSX-element style (`<Routes>/<Route>`), defined in `src/App.tsx:163-195`. `BrowserRouter` wraps `<App/>` in `src/main.tsx:11`.
- **One app shell / layout** exists: `AdminLayout` (`src/App.tsx:115-161`) — a real persistent sidebar (`<nav class="w-64">`, `NAV_SECTIONS` at `src/App.tsx:60-92`) + scrolling `<main>` with `<Outlet/>`. Good news for the redesign: a genuine authenticated shell already exists.
- **Nested layout + guard composition** (`src/App.tsx:170-190`):
  - `/admin` → `<ProtectedRoute>` (guard) → `<AdminLayout>` (shell) → leaf pages.
  - `index` redirects to `/admin/agency` (`src/App.tsx:188`).
- **Public routes** are standalone (no shared shell): `/` LandingPage, `/login`, `/accept/:token` (`src/App.tsx:166-168`).
- **404 handling:** catch-all `<Route path="*">` redirects to `/` (`src/App.tsx:192`). There is **no real 404 page** — unknown URLs silently bounce to the marketing landing page.

### Findings
- **HIGH — No code splitting / lazy loading.** All ~20 feature pages are statically imported at the top of `App.tsx` (`src/App.tsx:18-36`). There is **zero** `React.lazy`/`Suspense` anywhere (confirmed: grep `lazy|Suspense` → none). The entire admin app (learning hub, EVV, scheduling, agency settings, copilot chat) ships in one bundle that even unauthenticated landing-page visitors download.
- **MEDIUM — Not using React Router 7 data APIs.** The app uses the legacy element/`useEffect` model, not `createBrowserRouter` + route `loader`/`action`/`ErrorBoundary`. No route-level data loading, no `errorElement`, no deferred data. The redesign should decide deliberately whether to adopt the data router.
- **MEDIUM — No route-level error boundary.** A render error in any leaf page bubbles to the root (white screen). No `ErrorBoundary` component exists.
- **LOW — 404 → `/` is user-hostile.** A mistyped `/admin/clientss` lands a logged-in admin on the public marketing page with no explanation.
- **LOW — No role-aware routing.** All `/admin/*` routes are gated only by authentication, not by role (see §2).

---

## 2. Auth Flow

### Mechanism
- **Cookie-session + CSRF**, managed by `AuthProvider` (`src/lib/AuthContext.tsx`). Provider wraps the app *outside* the router (`src/main.tsx:10-12`).
- **Hydration on mount:** `GET /auth/me` with `credentials: 'include'` (`src/lib/AuthContext.tsx:25-51`); sets `user` and stashes `csrfToken` into an in-memory module variable (`src/lib/session-state.ts`).
- **Login:** `POST /auth/login` (`AuthContext.tsx:53-67`); **Logout:** `POST /auth/logout` with `x-csrf-token` (`AuthContext.tsx:69-78`).
- **API client** (`src/lib/api-client.ts`): `getJson/postJson/putJson`, all `credentials: 'include'`, POST/PUT attach `x-csrf-token` from `getCsrfToken()` (`api-client.ts:32-38`). Typed `HttpError` carries the parsed body so callers can branch on server error codes (`api-client.ts:9-19`) — this is a genuine strength (e.g. the 422 compliance gate in `AssignmentsPage.tsx:228-235`).
- **Route guard:** `ProtectedRoute` reads `isAuthenticated` and `<Navigate to="/login">` otherwise (`src/App.tsx:38-46`).
- **Global loading gate:** while hydrating, the provider renders a bare `Loading...` div for the whole app (`AuthContext.tsx:80-82`).

### Findings
- **CRITICAL — CSRF token has two divergent sources.** `api-client.ts` reads the token from the **in-memory** `session-state` set by `/auth/me` (`session-state.ts:1-9`). But `AgencySettingsPage` defines its *own* `putJson` + `readCsrfToken` that reads CSRF from a **`rayhealth_csrf` cookie** instead (`AgencySettingsPage.tsx:99-125`). Two different token sources for the same protection is a latent correctness/security bug — if the backend rotates one and not the other, settings writes break or bypass. Must be unified.
- **HIGH — `VITE_API_URL` is honored by auth but ignored by the data layer.** `AuthContext` builds `API_BASE = VITE_API_URL ?? '/api'` and uses it for `/auth/*` (`AuthContext.tsx:4,30,54,71`). But `api-client.ts` hardcodes bare `/api/...` paths (e.g. `getJson('/api/clients')`). If `VITE_API_URL` is ever set to a non-same-origin URL, **auth would hit the remote API while all data calls hit same-origin `/api`** — cookies/session split brain. Centralize base-URL handling in one place.
- **HIGH — No role-based authorization in the router.** `ProtectedRoute` only checks authenticated, never `user.role`. Role exists on the user (`AuthContext.tsx:6-10`, `'admin' | 'coordinator' | ...`) and pages do ad-hoc checks (`AgencySettingsPage.tsx:128-129` `isAdmin`), but a coordinator can navigate to admin-only routes and only the page body conditionally hides. Authorization is scattered, not enforced at the route.
- **MEDIUM — `AcceptInvitePage` bypasses the API client entirely** (`AcceptInvitePage.tsx:83,146` raw `fetch`). Reasonable (it's pre-auth/public), but it re-implements status-code handling by hand (401/410/409/404) — no shared helper.
- **MEDIUM — Whole-app blocking spinner.** The `Loading...` gate (`AuthContext.tsx:80-82`) blocks even public routes (`/`, `/accept/:token`) behind the `/auth/me` round-trip. The landing page should render instantly.
- **LOW — No session-expiry handling.** Nothing watches for a 401 from `getJson/postJson` mid-session to force re-login; an expired cookie surfaces as a generic page error.

---

## 3. State Management

- **No state library.** No Redux, no Zustand, no Jotai (confirmed by `package.json`). The **only** shared state is `AuthContext`.
- **No server-state cache.** No TanStack/React Query, no SWR. **Every page owns its server data in `useState` and fetches in `useEffect`** (20/20 feature pages use `useEffect`; data pulled via `getJson` or raw `fetch`).

### Findings
- **HIGH — Re-fetch on every mount; no caching or dedup.** Navigating Clients → Staff → Clients re-hits `/api/clients` each time. There is no cache, so the user sees a load/flash on every visit.
- **HIGH — Duplicate fetching of the same resources across pages.** `/api/staff` is fetched in **6** places, `/api/clients` in **4**, `/api/templates` in **4**. `AssignmentsPage` alone fetches `/api/assignments`, `/api/templates`, `/api/staff`, and `/api/clients` on mount (`AssignmentsPage.tsx:138-166`) — the same staff/clients lists Staff and Clients pages already loaded. No sharing.
- **MEDIUM — Manual cache-invalidation via `refreshTick`.** `LearningDashboardPage` re-runs its effect by incrementing a counter (`LearningDashboardPage.tsx:40,63`). This is a hand-rolled substitute for query invalidation and is repeated ad hoc.
- **MEDIUM — Optimistic-ish local mutations drift from server.** After create, pages push the response into local arrays (e.g. `StaffPage.tsx:106-109` pushes a partial `{id,email,role,status}` object; `ClientsPage.tsx:68`). The local shape can diverge from a real server refetch, and other open views don't update.

---

## 4. Data Layer — Loading / Error / Empty Consistency

The API client itself is clean (`api-client.ts`). The **inconsistency is at the page level** — there is no shared data-fetching hook, so every page reinvents loading/error/empty, and many skip states.

### Loading states — inconsistent
- **Has loading:** `VisitReviewPage` (`:40,108`), all Learning pages (`LearningDashboardPage.tsx:37`), `AcceptInvitePage`, `AgencySetupPage`, EVV corrections pages.
- **MEDIUM — Missing loading state entirely:** `ClientsPage` (`loading` count = 0), `AssignmentsPage` (list has no loading flag), `TemplatesPage` (0), `AuthorizationsPage` (0). These render the **empty state during the initial fetch**, so the user briefly sees "No clients found" / "No assignments found" before data pops in (`ClientsPage.tsx:183-184`, `AssignmentsPage.tsx:443-444`). Misleading.

### Error states — inconsistent and frequently silent
- **CRITICAL (UX) — Silent swallow of load failures.** `ClientsPage` maps any fetch error to `setClients([])` (`ClientsPage.tsx:44-47`) → a failed API call is **indistinguishable from "no clients."** Same anti-pattern in `AssignmentsPage` (`:141-165`, all four loads swallowed) and `StaffPage` (`:74-76`). A backend outage looks like an empty agency.
- **HIGH — `console.error` in production code** (violates project no-console rule): `VisitReviewPage.tsx:53,74`, `AgencySetupPage.tsx:35`, `TemplatesPage.tsx:49,53`, `AuthorizationsPage.tsx:49`. In several of these the console line is the *only* error handling — nothing is shown to the user.
- **Good examples to standardize on:** `LearningDashboardPage` (`:38,52-58` distinct `error` state) and `AssignmentsPage`'s 422 compliance branch (`:228-241`) handle errors properly and surface them.

### Empty states — the one consistent thing (but duplicated)
- Nearly every list page defines its **own local `EmptyState` component** — `ClientsPage.tsx:224`, `StaffPage.tsx:312`, `VisitReviewPage.tsx:164`, `AssignmentsPage.tsx:540`. Same markup, copy-pasted 6+ times. **LOW**, but ripe for a shared component.

### Duplicated client logic
- **MEDIUM — `putJson` exists twice.** `api-client.ts:55-57` exports a `putJson`, yet `AgencySettingsPage.tsx:99-118` re-implements its own (with a different CSRF source — see §2 CRITICAL). Dead/duplicated abstraction.

---

## 5. App Shell (critical for redesign)

**Verdict: a real authenticated shell already exists — this is the biggest asset for the redesign.**

- `AdminLayout` (`src/App.tsx:115-161`) is a true persistent layout: fixed `w-64` gradient sidebar with grouped nav (`NAV_SECTIONS`), brand lockup, sign-out button, and a scrolling content region with a centered `max-w-6xl` container and `<Outlet/>`.
- Per-page headers are standardized via the shared `<PageHeader>` (`src/components/PageHeader.tsx`), used by every admin page.
- **Gaps for the redesign:**
  - **No top header bar** — there's no header band for user identity, agency name, search, breadcrumbs, or notifications. Sign-out lives at the bottom of the sidebar; current user/agency is *not* displayed anywhere in the chrome.
  - **Not responsive / no mobile nav.** Sidebar is always-on `w-64`; there is no collapse, no hamburger, no drawer. On small screens it permanently eats 16rem.
  - **Nav config is hardcoded** (`NAV_SECTIONS`) and **not role-filtered** — every signed-in user sees Agency Setup, Settings, etc. regardless of role.
  - Public pages (`/`, `/login`, `/accept`) each hand-roll their own full-screen layout (e.g. `AcceptInvitePage`'s local `Shell`, `AcceptInvitePage.tsx:372`).

---

## 6. Performance

- **HIGH — No route-based code splitting** (see §1). Single eager bundle; landing-page visitors pay for the whole admin app.
- **MEDIUM — No server-state cache** ⇒ redundant network on every navigation (see §3).
- **LOW — Memoization is spotty but mostly adequate.** `useMemo` is used for client-side filtering on list pages (`ClientsPage.tsx:49`, `AssignmentsPage.tsx:189`, `StaffPage.tsx:81`). Note `AssignmentsPage`'s `caregiverNameById`/`clientNameById` maps are rebuilt every render (`:171-183`) and fed into a memo dep array — minor.
- **LOW — No prefetch / no `<Link prefetch>`-style hinting** (the legacy router doesn't support it; would come with the data router or lazy routes).
- **Good:** there's debounced input for the compliance preflight (`AssignmentsPage.tsx:109-136`), showing the team understands debouncing.

---

## 7. Recommendations (target architecture for the redesign)

### A. Routing & layout (do first)
1. **Adopt React Router 7 `createBrowserRouter`** with a nested route tree:
   - Root → `errorElement` (real error boundary) + a `RootBoundary`.
   - Public layout (landing/login/accept) vs. `AppShell` layout (sidebar + **new top header**).
   - `loader`-based auth guard at the `/admin` parent so the guard is data-driven, not render-time `<Navigate>`.
2. **Route-based code splitting:** `lazy()` every `/admin/*` leaf so the landing/login bundle is tiny. Wrap the shell `<Outlet/>` in `<Suspense>` with a skeleton.
3. **Build a real `AppShell`:** sidebar (collapsible + mobile drawer) **plus a top header** carrying agency name, current user, role badge, and sign-out. Drive nav from a **role-filtered** config.
4. **Add a genuine 404 page** instead of redirect-to-`/`.

### B. Auth & authorization
5. **Single source of truth for API base + CSRF.** Route every call (auth and data) through one client module; delete `AgencySettingsPage`'s private `putJson`/`readCsrfToken` (resolve the cookie-vs-memory CSRF split — §2 CRITICAL).
6. **Role-aware route guards** (e.g. `<RequireRole role="admin">`) so authorization is enforced at the route, not per-page conditionals.
7. **Global 401 interceptor** in the client → trigger re-auth/redirect on session expiry.
8. **Don't block public routes** on `/auth/me`; render landing/login immediately and resolve auth in the background.

### C. Server state — **introduce TanStack Query (recommended)**
9. **Adopt `@tanstack/react-query`.** This directly fixes the largest cluster of findings: re-fetch-on-mount, cross-page duplicate fetches (`/api/staff` ×6, `/api/clients` ×4), manual `refreshTick` invalidation, and inconsistent loading/error handling. Wrap `getJson/postJson` as the query/mutation fetcher (keep the typed `HttpError` — it pairs perfectly with Query's `error`). Use `queryClient.invalidateQueries` after mutations instead of local array pushes.
   - Keep `AuthContext` as-is for session identity; Query is for *resource* state.
10. **Standardize fetch UX with one pattern.** With Query, every list gets uniform `isLoading` (skeleton) / `isError` (visible, non-silent error) / empty handling. **Eliminate the silent `catch → set([])` swallow** that hides outages as emptiness (§4 CRITICAL-UX).
11. **Extract shared `<EmptyState>`, `<ErrorState>`, `<LoadingSkeleton>`** components (the local `EmptyState` is already copy-pasted 6+ times).

### D. Hygiene
12. Remove all `console.error` from production paths (6 sites) — surface errors in the UI or via a logger.

### Suggested sequencing
**Phase 1:** data router + AppShell (sidebar + header) + lazy routes + 404. **Phase 2:** unify API client/CSRF + role guards + 401 interceptor. **Phase 3:** TanStack Query migration + shared state components + console cleanup.

---

## Appendix — Key file references
| Concern | File:line |
|---|---|
| Router tree / guard / shell | `src/App.tsx:38-46, 115-161, 163-195` |
| Provider mount order | `src/main.tsx:10-12` |
| Auth context + API_BASE | `src/lib/AuthContext.tsx:4, 25-78` |
| In-memory CSRF | `src/lib/session-state.ts:1-9` |
| API client + HttpError | `src/lib/api-client.ts:9-71` |
| CSRF/putJson divergence | `src/features/agency/AgencySettingsPage.tsx:99-125` |
| Silent error swallow | `src/features/clients/ClientsPage.tsx:44-47`; `src/features/scheduling/AssignmentsPage.tsx:141-165` |
| Missing loading state | `ClientsPage.tsx`, `AssignmentsPage.tsx`, `TemplatesPage.tsx`, `AuthorizationsPage.tsx` |
| console.error in prod | `VisitReviewPage.tsx:53,74`; `AgencySetupPage.tsx:35`; `TemplatesPage.tsx:49,53`; `AuthorizationsPage.tsx:49` |
| Good error/loading model | `src/features/learning/LearningDashboardPage.tsx:37-63` |
