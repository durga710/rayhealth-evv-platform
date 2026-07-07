# Agent 01 — Repo Scout Report

**Authored by Durga Ghimeray**

---

## 1. Repository Overview

**Stack & Tooling:**
- **Language:** TypeScript 5.4+ (strict mode)
- **Package Manager:** npm 10.8.2
- **Build System:** Turbo (monorepo orchestration)
- **Module System:** ES modules (`"type": "module"`)
- **Frontend Frameworks:** React 19.2.6 + React DOM (web and mobile)
- **Web Bundler:** Vite 8.0.13 with React plugin
- **Mobile Framework:** React Native 0.81.5 + Expo 54.0.35 + Expo Router 6.0.24
- **Backend Runtime:** Node.js + Express 5.2.1
- **Database:** PostgreSQL 8+ (via Knex 3.2.10)
- **Test Runner:** Vitest (all packages)
- **Linting:** ESLint + Prettier
- **Security:** Helmet (HTTPS/CSP/HSTS), bcryptjs, jsonwebtoken, SimpleWebAuthn
- **Deployment:** Vercel (Node.js Serverless Functions)

**Repository Structure (Turbo npm workspaces):**
```
rayhealth-fresh/
├─ packages/
│  ├─ core/        (Domain logic, migrations, repositories, services)
│  ├─ app/         (Express REST API)
│  ├─ web/         (React admin console)
│  └─ mobile/      (React Native caregiver app)
├─ scripts/
├─ docs/
├─ .github/        (CODEOWNERS, CI/CD workflows)
└─ .env.example
```

---

## 2. Package-by-Package Map

### `packages/core` — Domain & Data Layer
**Purpose:** Zod-validated domain entities, database migrations, repositories, business logic, aggregator integration contracts.

**Key Files/Patterns:**
- `src/domain/*.ts` — Domain schemas: agency, user, caregiver, client, evv, billing, scheduling, onboarding, learning, mobile-session, recurring-schedule, session, user-agency, visit-maintenance
- `src/repositories/*.ts` — ~30 repository classes for data access (agency, user, caregiver, client, authorization, assignment, evv-exception, audit-event, claim, payment, onboarding, session, mobile-session, platform-admin, credential, recurring-schedule)
- `src/services/*.ts` — Business logic: claim generation, payroll export, assignment eligibility, credential compliance, EVV exception handling, import service, command-center service, schedule conflict service, audit retention sweep
- `src/integrations/` — Sandata (aggregator), HHAeXchange, Clearinghouse HTTP clients
- `src/config/` — State registry (PA, NJ) with task codes, compliance rules
- `src/migrations/` — Schema versioning (2026-05-11 through 2026-07-01)
- `src/db/knex.ts` — Database connection factory
- `src/security/` — Geofence (Haversine distance), cell cipher for PHI encryption

**Test Files:** `src/__tests__/` contains >20 test suites covering services, repositories, migrations, EDI-835 parsing, domain schemas, aggregator clients.

---

### `packages/app` — Express REST API
**Purpose:** Authentication, capability-based RBAC, audit logging, rate limiting, EVV clock-in/out, billing exports, Sandata/HHAeXchange submission, AI runtimes (copilot), mobile & web API endpoints.

**Key Files:**
- `src/app.ts` — Express setup; CORS; helmet security headers; rate limiters (auth, 2FA, password reset, marketing, copilot, support chat, invite acceptance, audit-admin); middleware chain (authContext, CSRF, auditLog)
- `src/middleware/` — auth-context.ts, require-capability.ts, csrf.ts, audit-log.ts, require-platform-admin.ts
- `src/routes/` — ~70 route files organized by domain:
  - **Auth:** `auth-routes.ts`, `auth-bootstrap-gate.test.ts`, `auth-session-routes.test.ts`, `auth-signup-routes.test.ts`, `auth-mobile-agencies.test.ts`, `auth-mobile-2fa-revocation.test.ts`
  - **Core Operations:** agency, staff, client, authorization, template, assignment, evv, mobile, task, recurring-schedule routes
  - **Billing:** billing-routes.ts, billing-claims-routes.ts (Stripe webhook)
  - **Learning:** learning-routes.ts
  - **Compliance Engine:** compliance-engine-routes.ts, evv-submission (Sandata Alt-EVV), hhaexchange-submission
  - **Admin:** command-center-routes.ts, admin-assistant-routes.ts, onboarding-admin-routes.ts
  - **Audit:** audit-events-routes.ts, audit-retention-routes.ts
  - **Export/Import:** export-routes.ts, import-routes.ts
  - **Marketing/Public:** marketing-routes.ts, health-routes.ts, support-routes.ts (AI chat)
  - **Super-admin:** superadmin-routes.ts

**Test Files:** `src/routes/__tests__/` contains ~30 test suites for route handler correctness, capability guards, geofence validation, auth flows.

---

### `packages/web` — React Admin Console
**Purpose:** Web-based operational dashboard for agency owners, coordinators, and caregivers (browser-based portal access).

**Tech:**
- React Router 7.15.0 for client-side routing
- React 19.2.6 + React DOM 19.2.6
- Vite (dev/prod bundler)
- Framer Motion 12.42.0 (animations)
- SimpleWebAuthn 13.3.0 (passkeys)
- Vercel Analytics 2.0.1

**Key Files:**
- `src/App.tsx` — Main router; lazy-loaded route chunks; role-based access (ProtectedRoute, AdminRoute); dark sidebar + light content admin shell with inline navigation
- `src/index.css` — Design system (CSS variables): brand colors (teal #107480 + orange #ee6c2c), semantic colors (success/danger/warning/info), typography, form inputs, buttons, badges, cards, tables, banners, admin shell styles, responsive breakpoints
- `src/lib/AuthContext.js` — Auth state management (session cookie + CSRF token; no localStorage JWT)
- `src/lib/api-client.js` — HTTP client with capability/auth handling

**Web Features (screens in `src/features/`):**

**Admin Portal** (`/admin/*`):
- Command Center (`CommandCenterPage.tsx`) — KPI board, AI briefing, attention alerts, live ops dashboard (refreshes every 60s)
- Dashboard (`DashboardPage.tsx`) — Charting/analytics
- Today's Visits (`TodayBoardPage.tsx`) — Real-time visit status
- Agency Setup (`AgencySetupPage.tsx`) — Configuration, team management, integrations
- Go-Live Readiness (`GoLiveReadinessPage.tsx`) — Compliance checklist
- Staff (`StaffPage.tsx`, `CaregiverActivityPage.tsx`) — Caregiver roster, activity drilldown
- Clients (`ClientsPage.tsx`) — Service recipient management
- Authorizations (`AuthorizationsPage.tsx`) — Care plan tracking, auth burn-down
- Scheduling:
  - Templates (`TemplatesPage.tsx`) — Recurring visit templates
  - Assignments (`AssignmentsPage.tsx`) — Visual week schedule, conflict detection, publish/draft modes
  - Recurring Schedules (`RecurringSchedulesPage.tsx`) — Long-term recurrence patterns
- Visit Review (`VisitReviewPage.tsx`) — EVV verification, exception queues
- Compliance Engine (admin-only):
  - Overview, Audit Defense, Exception Resolution, Authorization Oversight, Medicaid Workflow, Payroll Reconciliation, Claim Matching, Remittance (ERA), EVV Submission (Sandata), HHAeXchange Submission, Clearinghouse Config, Credentials
- Learning Hub (`LearningHubPage.tsx`, `LearningPortalPage.tsx`, `CourseEditorPage.tsx`) — Course authoring & caregiver training
- Audit (`AuditEventsPage.tsx`, `AuditRetentionPage.tsx`) — Tamper-evident log review
- Onboarding (`OnboardingHubPage.tsx`, `ApplicantDetailPage.tsx`) — Hiring pipeline
- Profile & Settings (`ProfilePage.tsx`, `SettingsPage.tsx`)

**Caregiver Portal** (`/portal/*`):
- Dashboard (`CaregiverDashboard.tsx`) — Task list, quick stats
- Schedule (`CaregiverSchedulePage.tsx`) — Week view
- Visits (`CaregiverVisitsPage.tsx`) — Visit history, completion status
- Learning (`CaregiverLearningHubPage.tsx`, `CaregiverTrainingPage.tsx`) — Course enrollment & completion
- Training detail (`CourseDetailPage.tsx`) + certificate view (`CertificatePage.tsx`)
- Profile & settings

**Public Marketing Site** (`/`, `/pricing`, `/contact`, `/solutions/*`, `/platform/*`, `/resources/*`, etc.):
- Landing Page (`LandingPage.tsx`) — Hero, metrics, bento capabilities grid, RayVerify section, feature spotlights (scheduling/EVV/audit), comparison table, pricing tiers, FAQs, testimonials
- Solution pages: Scheduling, EVV, Billing/Payroll, Workforce Training
- Platform pages: AI Automation, Compliance
- Resource pages: EVV Guide, Task Codes, Audit Checklist, HIPAA Compliance
- Other: Pricing, Contact, Demo, Apply (for caregiver jobs), Interview flow, Status, Privacy, Terms

**Components** (`src/components/`):
- `brand/BrandLogo.tsx` — Logo component
- `state/EmptyState.tsx`, `ErrorRetry.tsx`, `LoadingSkeleton.tsx` — Reusable state UI

**Test Files:** Several `.test.tsx` files for individual pages (CommandCenterPage, TodayBoardPage, GoLiveReadinessPage, AssignmentsPage, RouteErrorBoundary, state components).

---

### `packages/mobile` — React Native Caregiver App (Expo)
**Purpose:** GPS-verified clock-in/out, visit schedule, training access, offline-capable.

**Tech Stack (Expo + React Native):**
- React Native 0.81.5 + Expo 54.0.35 + Expo Router 6.0.24
- React Navigation (Bottom Tabs)
- Expo Location (GPS geofence)
- React Native Maps 1.20.1 (live geofence visualization)
- React Native Reanimated 4.1.1 (animations)
- Expo Haptics (haptic feedback)
- Expo Secure Store (keychain/keystore for JWT)
- Expo Linear Gradient (gradient UI)
- Axios for HTTP

**Key Screens** (`src/features/`):
- **Auth:**
  - `LoginScreen.tsx` — Email + password + optional 2FA code
  - `SelectAgencyScreen.tsx` — Multi-agency selection if caregiver works for multiple
- **EVV (core)**:
  - `DashboardScreen.tsx` — Today's visits list; shows scheduled/in-progress/past; long-press dev test alert; calls `/api/mobile/caregiver/today` endpoint; renders visit cards with client initials, address, time, geolock indicator, state badge (In progress/Completed/Now/Done)
  - `ClockInScreen.tsx` — GPS-locked clock-in/out with live map, geofence radius visualization, radar ping animation, distance/accuracy overlay, action buttons (Clock In disabled if outside zone; Clock Out always enabled as fallback), completion celebration with sparkles, EVV compliance note
  - `ScheduleScreen.tsx` — Week calendar view
  - `VisitDetailScreen.tsx`, `VisitsScreen.tsx` — Visit history & detail
- **Training:**
  - `TrainingScreen.tsx` — Course list & enrollment
- **Profile:**
  - `ProfileScreen.tsx` — User details
  - `EditDetailsScreen.tsx` — Name, contact, credentials
  - `ChangePasswordScreen.tsx`
  - `HelpScreen.tsx` — Support/FAQ
- **Common:**
  - `alerts/AppAlertProvider.tsx`, `AppDialog.tsx`, `AppToast.tsx` — Alert/modal system
  - `EmptyState.tsx`, `ErrorRetry.tsx`, `LoadingScreen.tsx`, `Skeleton.tsx`, `ScreenHeader.tsx` — Reusable UI blocks
  - `tokens.ts` — Design tokens (colors, typography, radii, shadows, gradients)
- **Lib:**
  - `AuthContext.tsx` — JWT auth (via Expo Secure Store, NOT localStorage)
  - `api-client.ts` — Axios wrapper with auth + error handling
  - `visit-state.ts` — State machine for visit lifecycle (upcoming/now/past/in_progress/completed/resumable)
  - `geofence.ts` — Haversine distance, formatDistance helper
  - `notification-permissions.ts` — Runtime permission checks
  - `shift-alert-scheduler.ts` — Foreground haptic + notification 25–33s before shift start
  - `app.json` — Expo config (app name, slugs, plugins for secure-store, maps, location, notifications)

**Styling Approach:** 
- React Native StyleSheet for component styles
- Design tokens (colors, typography, radii, shadows, gradients) centralized in `common/tokens.ts`
- Linear gradients via Expo Linear Gradient for header/CTA states
- Reanimated for spring/timing animations (smooth motion, reduced-motion respect)

---

## 3. API Routes Inventory

**Unauthenticated (public):**
- `/auth/login` — Session-based web login (rate-limited 10/15min)
- `/auth/signup` — New agency account creation
- `/auth/forgot-password`, `/auth/reset-password/:token` — Password recovery
- `/auth/mobile/login` — Mobile JWT issuance (rate-limited)
- `/auth/bootstrap` — Bootstrap check (rate-limited)
- `/auth/login/2fa` — TOTP verification (rate-limited 10/15min)
- `/health`, `/health/db`, `/health/audit-pipeline` — Liveness checks (rate-limited 60/15min)
- `/marketing/*` — Lead capture (contact form, rate-limited 10/15min)
- `/invitations/*` — Public invite lookup + acceptance (rate-limited 20/15min)
- `/onboarding/*` — Public job application flow
- `/support/*` — Public AI support chat (rate-limited 20/15min)
- `/superadmin/login` — Platform super-admin token auth (rate-limited 10/15min)

**Authenticated (session or JWT + CSRF + audit-logged):**
- `/invites/*` — Invite management (create, revoke, resend)
- `/agencies/*` — Agency CRUD, EVV config, Sandata config, HHAeXchange config, Clearinghouse config
- `/staff/*` — Caregiver roster, credentials, 2FA recovery codes
- `/clients/*` — Client records (name, address, geofence, authorizations)
- `/authorizations/*` — Care plan auth tracking (import, expire, resolve)
- `/templates/*` — Recurring visit templates (PA task codes, recurrence patterns)
- `/assignments/*` — Weekly schedule assignments (publish, conflict check, capability validation)
- `/recurring-schedules/*` — Long-term schedule patterns
- `/evv/*` — Clock-in/out (geofence validation, EVV event capture, 6-element tracking)
- `/mobile/*` — Mobile-specific endpoints (`/mobile/caregiver/today` for dashboard, etc.)
- `/maintenance/*` — Data cleanup, schema migrations
- `/exports/*` — Billing export (837P), payroll export, EVV submission to Sandata (alt-EVV async POST→poll), HHAeXchange
- `/import/*` — Bulk data import (auth, staff, clients from CSV/JSON)
- `/tasks/*` — Task management (for scheduled jobs)
- `/admin/audit-retention` — Audit log sweep (rate-limited 30/15min, admin-only)
- `/admin/audit-events` — Audit event search/filter (rate-limited 30/15min, admin-only)
- `/learning/*` — Course CRUD, enrollment, completion tracking
- `/admin-assistant/*` — UI-triggered admin actions (AI copilot proposals)
- `/copilot/*` — Claude-powered copilot for agency actions (rate-limited 40/15min)
- `/billing/*`, `/billing/webhook` — Stripe subscription + invoice webhooks
- `/admin/onboarding/*` — Admin-side hiring pipeline, interview scheduling
- `/profile/*` — User profile management
- `/settings/*` — Agency/user settings
- `/compliance-engine/*` — Exception queues, audit defense, Medicaid workflow, payroll/claims reconciliation
- `/command-center/*` — Live ops dashboard summary, AI briefing
- `/documents/*` — S3-backed file uploads/downloads (avatars, signatures, docs)

**Default Rate Limits:**
- Authenticated: 300/15min per IP (well above typical admin use, below exfiltration risk)
- Admin audit endpoints: 30/15min per IP (admin-only, expensive operations)
- Copilot: 40/15min per IP (calls paid Claude model)
- Support chat: 20/15min per IP (paid model, public surface)

---

## 4. Web Screens & Reusable Components

**Page Hierarchy:**
```
/ (public, landing)
├─ /pricing, /contact, /demo, /launch, /ads, /status, /privacy, /terms
├─ /solutions/scheduling, .../evv, .../billing-payroll, .../workforce-training
├─ /platform/ai-automation, .../compliance
├─ /resources/evv-guide, .../task-codes, .../audit-checklist
├─ /compliance/hipaa
├─ /rayverify (trust/verification engine)
├─ /login, /signup, /accept-invite, /forgot-password, /reset-password/:token
├─ /apply/:agencyId, /interview/:token (public onboarding)
├─ /superadmin (hidden admin console)

/portal (caregiver self-service, ProtectedRoute)
├─ / (dashboard)
├─ /schedule, /visits, /learning, /training, /training/:courseId, /training/:courseId/certificate
├─ /profile, /settings

/admin (admin+coordinator only, AdminRoute)
├─ / (CommandCenterPage)
├─ /today, /overview (TodayBoardPage, DashboardPage)
├─ /agency, /readiness, /staff, /staff/:caregiverId, /clients, /authorizations, /import
├─ /templates, /assignments, /recurring-schedules
├─ /review (VisitReviewPage)
├─ /audit-events, /audit-retention
├─ /learning, /learning/portal, /learning/courses/new, /learning/courses/:id/edit
├─ /onboarding, /onboarding/:id
├─ /profile, /settings
├─ /compliance-engine (admin-only submodule)
│  ├─ / (overview)
│  ├─ /audit-defense, /exceptions, /authorizations, /medicaid, /payroll, /claims, /remittances
│  ├─ /evv-submission, /hhaexchange-submission, /clearinghouse, /credentials
```

**Reusable Components** (`src/components/`):
- `BrandLogo.tsx` — Logo with optional theme
- `RouteErrorBoundary.tsx` — Catch route-level errors, localized recovery
- `EmptyState.tsx` — Icon + title + message for zero-state
- `ErrorRetry.tsx` — Error message + retry button
- `LoadingSkeleton.tsx` — Shimmer skeleton cells

**Styling:**
- **Design System:** CSS variables in `index.css` (brand colors, semantic colors, typography, radii, shadows)
- **Approach:** CSS variables + class names (no Tailwind; no CSS-in-JS)
- **Dark sidebar + light content pattern:** Admin shell with dark nav, light main area
- **Responsive:** Media queries at 900px (sidebar collapses to drawer), 680px (metric grid stacks)
- **Accessibility:** ARIA labels, semantic HTML, focus-visible outlines, reduced-motion respect

**Duplication Observed:**
- Inline styles in some component files (e.g., `CommandCenterPage.tsx` has inline `style={{}}` objects for KPI cards, grids, text)
- Could extract Kpi card styles to shared class/component to reduce repetition
- Landing page CSS is self-contained within a scoped `<style>` block (not centralized in index.css)

---

## 5. Mobile App Map (Expo vs. Capacitor Correction)

**CRITICAL INACCURACY IN README:** 
- **README claims:** "Capacitor iOS/Android caregiver app"
- **Reality:** The app is **Expo + React Native**, NOT Capacitor
- **Evidence:** 
  - `packages/mobile/package.json` lists `expo@~54.0.35`, `expo-router@~6.0.24`, `react-native@0.81.5`
  - All screens use Expo APIs: `expo-location`, `expo-secure-store`, `expo-status-bar`, `expo-haptics`, `expo-linear-gradient`, `expo-router`, `expo-notifications`
  - Build script: `"build": "expo export"` (Expo eas build, not Capacitor)
  - Main entry: `expo-router/entry`
  - No Capacitor-specific plugins or configuration

**Correct Stack:**
- **Framework:** React Native 0.81.5 + Expo 54 + Expo Router (file-based routing)
- **Auth:** JWT via Expo Secure Store (keychain on iOS, keystore on Android)
- **Location:** Expo Location for GPS + geofence monitoring
- **Maps:** React Native Maps 1.20.1 for live geofence visualization
- **Deployment:** Expo Managed Workflow (EAS Build for CI/CD)
- **Platforms:** iOS 13+ and Android 5.0+ (via Expo/RN compatibility)

---

## 6. Styling / Design System State

**Centralized Design System:**
- **Location:** `packages/web/src/index.css` (global CSS variables)
- **Approach:** CSS custom properties (variables) + utility class names
- **Brand Colors (2026-05 rebrand):**
  - Primary: `#107480` (teal, healthcare-trustworthy) — WCAG AA compliant 5.61:1 contrast on #F8FAFC
  - Primary Dark: `#0c5d66` (headings, focus, hover)
  - Primary Light: `#7fc7cf` (soft tints, sidebar active)
  - Accent: `#ee6c2c` (orange, secondary brand, CTAs) — 6.44:1 contrast
  - Accent Dark: `#d8551b` (pressed/hover)
- **Semantic Colors:** Success (#10B981), Danger (#dc2626), Warning (#F59E0B), Info (tracks primary)
- **Surfaces:** `#F8FAFC` (bg), `#FFFFFF` (surface), `#0F172A` (dark sidebar)
- **Typography:** Inter (sans), JetBrains Mono (mono); font weight 500–700 for headings
- **Spacing:** 8px base grid (padding, margins via rem/px)
- **Radii:** --radius-sm (6px), --radius-md (8px), --radius-lg (12px), --radius-xl (16px)
- **Shadows:** Four tiers (sm, md, lg, focus outline)

**Duplication Observed:**
1. **Landing Page Self-Contained CSS:** `LandingPage.tsx` has a massive scoped `<style>` block (CSS) with duplicate color/spacing logic — not using the global index.css palette
2. **Inline Styles in Admin Pages:** `CommandCenterPage.tsx` hardcodes colors (e.g., `background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'`) instead of using CSS variable equivalents
3. **Mobile Design Tokens:** `packages/mobile/src/features/common/tokens.ts` duplicates web colors/typography in JS (not CSS variables) — necessary for React Native but creates two sources of truth

**Mobile Styling (React Native):**
- `StyleSheet.create()` pattern (all components)
- Centralized tokens: colors, typography styles, radii, shadows, gradients
- No Tailwind on native (impossible)
- Inline gradient definitions with Expo Linear Gradient

**Recommendations:**
- Extract `CommandCenterPage` inline styles to CSS classes in index.css
- Move Landing page CSS into index.css or a separate landing.css, reference shared variables
- Create a token sync mechanism (or document) between web index.css and mobile tokens.ts to prevent drift

---

## 7. Security-Sensitive Files

**Authentication & Session:**
- `packages/app/src/middleware/auth-context.ts` — Session cookie validation, JWT fallback, CSRF context
- `packages/app/src/middleware/csrf.ts` — CSRF token validation (POST/PATCH/DELETE)
- `packages/app/src/middleware/require-capability.ts` — Capability RBAC enforcement per route
- `packages/app/src/routes/auth-routes.ts` — Login, signup, 2FA, password reset, logout
- `packages/web/src/lib/AuthContext.js` — Web session state (no localStorage JWT; HttpOnly session only)
- `packages/mobile/src/lib/AuthContext.tsx` — Mobile JWT management via Expo Secure Store (NOT localStorage)

**Secret Management:**
- `JWT_SECRET` env var (required; fail-closed in prod)
- `GOOGLE_AI_API_KEY`, `GEMINI_API_KEY` — explicitly forbidden in prod (defense-in-depth for BAA-only AI)
- `ALLOWED_ORIGINS` — required in prod CORS whitelist; fail-closed if missing
- `.env` file (git-ignored, populated from `.env.example`)

**Password & Cryptography:**
- `packages/app/src/routes/auth-routes.ts` uses bcryptjs (no plaintext hashing)
- Token-based password resets (time-limited, one-time use)
- 2FA via TOTP (otplib) with 10-attempt 15-min rate limit
- SimpleWebAuthn for optional passkey registration

**Audit Trail & Immutability:**
- `packages/app/src/middleware/audit-log.ts` — Automatic audit logging of all protected routes
- `packages/core/src/repositories/audit-event-repository.ts` — Append-only INSERT pattern
- Database trigger enforces mutation-blocking on `audit_events` table
- `packages/core/src/services/audit-retention-sweep.ts` — Compliance retention policy (logs its own run)

**Geofence Validation:**
- `packages/core/src/security/geofence.ts` — Haversine distance calculation (server-side validation)
- `packages/app/src/routes/evv-routes.ts` — Clock-in/out with 422 GEOFENCE_OUT_OF_BOUNDS error if distance > allowed radius
- `packages/mobile/src/features/evv/ClockInScreen.tsx` — Client-side geofence check (UX feedback), server is source of truth

**Rate Limiting:**
- `packages/app/src/app.ts` — Multiple rate limiters (auth 10/15min, 2FA 10/15min, password-reset 10/15min, marketing 10/15min, copilot 40/15min, support-chat 20/15min, audit-admin 30/15min, authenticated-default 300/15min)
- Skip rate limiting in test mode (`NODE_ENV === 'test'`)

**Security Headers (Helmet):**
- HSTS (31536000s = 1 year, preload, includeSubDomains)
- X-Frame-Options: deny
- Referrer-Policy: no-referrer
- CSP: restrictive defaults, none for framing

**API Security Scanning:**
- `scripts/security-surface-scan.ts` — Fails CI if localStorage session patterns reappear

---

## 8. Compliance-Sensitive Files

**EVV Compliance:**
- `packages/core/src/domain/evv.ts` — Six-element schema (visitor, client, location, service code, time in/out, visit outcome)
- `packages/app/src/routes/evv-routes.ts` — Clock-in/out endpoints with mandatory GPS, location capture, timestamp, service-code derivation
- `packages/mobile/src/features/evv/ClockInScreen.tsx` — GPS capture at clock-in/out with fallback to last-known location on clock-out (no caregiver locked in)
- `packages/core/src/services/` — Claim generation, payroll export, exception handling services

**Audit & Immutability:**
- `packages/core/src/migrations/2026-05-11-add-audit-retention.ts` — Append-only audit table schema
- `packages/core/src/services/audit-retention-sweep.ts` — Compliance retention policy + self-logging
- `packages/core/src/repositories/audit-event-repository.ts` — INSERT-only pattern, no UPDATE/DELETE

**Medicaid / Aggregator Integration:**
- `packages/core/src/integrations/sandata/` — Sandata EVV aggregator API client, state machine, transmission service, EDI validation
- `packages/core/src/integrations/hhaexchange-client.ts` — HHAeXchange transport
- `packages/core/src/integrations/clearinghouse-client.ts` — Clearinghouse 837P submission
- `packages/core/src/config/states/pennsylvania.ts`, `.../new-jersey.ts` — State-specific rules (PA: Sandata optional, NJ: forced HHAeXchange)
- `packages/core/src/domain/agency-evv-config.ts` — Per-agency aggregator selection
- `packages/app/src/routes/export-routes.ts` — EVV export to Sandata (async POST→poll pattern for reliability)

**Credential & Authorization Tracking:**
- `packages/core/src/services/credential-policy-service.ts` — Credential expiry & renewal alerts
- `packages/core/src/services/credential-compliance-service.ts` — Compliance status per caregiver
- `packages/core/src/repositories/` — Multiple repos for tracking (caregiver, client, authorization expiry dates)
- `packages/web/src/features/admin/` — CredentialsPage, GoLiveReadinessPage (checklist of compliance gates)

**Learning & Training:**
- `packages/core/src/domain/learning.ts` — Course structure, enrollment, completion tracking
- `packages/core/src/repositories/` — Learning-related repos for catalog, enrollment, certificate
- `packages/web/src/features/learning/` — CourseEditorPage (admin course authoring), enrollment tracking

**HIPAA Controls:**
- HttpOnly session cookies (no JavaScript access to auth token)
- CSRF token on state-changing requests (POST/PATCH/DELETE)
- Rate limiting on sensitive endpoints (auth, password reset, 2FA)
- Parameterized SQL (Knex ORM prevents injection)
- bcrypt password hashing
- PHI scoped per agency (no cross-agency data leakage via middleware)
- Audit trail (every action logged with actor, timestamp, payload hash)
- TLS enforced (HSTS in prod)

**DEV NOTE:** "Until those close, do not onboard real PHI" — operational HIPAA work (HIPAA-mode DB, BAAs, penetration test, cyber-liability insurance) deferred until first live agency.

---

## 9. README / Documentation Inconsistencies

1. **Mobile Framework Inaccuracy:**
   - **README Line 20:** `[![Capacitor-119EFF...`
   - **Claim:** "Capacitor iOS/Android caregiver app"
   - **Reality:** Expo + React Native + Expo Router (confirmed in package.json, screens, build config)
   - **Fix:** Change to `Expo / React Native` and update line to reflect Expo tech stack

2. **Cures Act Alignment Claim:**
   - README claims "21st-Century Cures Act–aligned" with "six EVV elements captured on every visit"
   - Code confirms this (src/domain/evv.ts, clock-in/out routes with timestamp, GPS, service code, visitor, client, outcome)
   - **Consistent — no issue**

3. **Sandata Aggregator Mention:**
   - README line 41: "Real Sandata Alternate-EVV (async POST → poll)"
   - Code confirms (packages/core/src/integrations/sandata/transmission-service.ts with async polling)
   - **Consistent — no issue**

4. **State-Specific Registry:**
   - README implies PA/NJ support ("state registry")
   - Code confirms (packages/core/src/config/states/pennsylvania.ts, new-jersey.ts with different rules)
   - **Consistent — no issue**

---

## 10. Test Setup

**Test Framework:** Vitest 4.1.5 / 1.4.0 (across all packages)

**Test Files Observed:**
- **Core tests** (`packages/core/src/__tests__/`): 20+ suites covering services, repositories, migrations, domain schemas, aggregator clients (Sandata, HHAeXchange), EDI-835 parsing, schedule conflict detection, claim generation, payroll export
- **App route tests** (`packages/app/src/routes/__tests__/`): 30+ suites for auth flows, geofence validation, assignment checks, audit-log behavior, RBAC capability guards, TOTP 2FA, claim generation, billing webhooks, superadmin routes, recurring schedules, template clock-in guard
- **Web page tests** (`packages/web/src/features/**/*.test.tsx`): CommandCenterPage, TodayBoardPage, GoLiveReadinessPage, AssignmentsPage, HipaaCompliancePage, StatusPage, RouteErrorBoundary
- **Component tests** (`packages/web/src/components/**/*.test.tsx`): EmptyState, ErrorRetry, LoadingSkeleton

**Test Patterns:**
- Routes tested with supertest (HTTP layer)
- Services tested with mocked repositories
- Repositories tested with in-memory/fixture DB seeding
- Components tested with React Testing Library (@testing-library/react)

**Coverage Gaps:**
- Mobile (Expo/React Native) has no test files in the glob output — may exist in app/ but not visible in packages/mobile/src
- Some high-complexity routes (e.g., copilot, AI assistant) have minimal test coverage visible

**CI Integration:**
- Check script at `scripts/check.sh` runs: typecheck, lint, security:scan, all workspace tests
- CI enforces: typecheck (tsc --noEmit), lint (eslint), security-surface-scan.ts, vitest run

---

## 11. Quick Wins

1. **Extract Inline Styles → CSS Classes**
   - `CommandCenterPage.tsx` hardcodes 20+ inline `style={{}}` objects
   - Move to index.css classes (e.g., `.command-center-briefing`, `.kpi-grid`, etc.)
   - Reduces file size, improves maintainability, enables theming
   - **Time:** 1–2 hours | **Risk:** Low (CSS-only, no logic change)

2. **Consolidate Landing Page CSS**
   - Large `<style>` block in `LandingPage.tsx` duplicates web design system colors/spacing
   - Extract to dedicated landing.css or merge into index.css with namespaced classes
   - Enables consistent theming, reduces bundle
   - **Time:** 1 hour | **Risk:** Low

3. **Create Shared Mobile/Web Token Sync**
   - Design tokens live in two places: web `index.css` and mobile `tokens.ts`
   - Create a shared token definition file (JSON or TypeScript) that both import
   - Build script generates both CSS variables and JS tokens from single source
   - Prevents color drift and ensures consistency
   - **Time:** 2–3 hours (one-time setup) | **Risk:** Low (backward compatible)

4. **Add Mobile Tests**
   - No vitest coverage found in `packages/mobile/src`
   - Add test files for key screens (DashboardScreen, ClockInScreen, LoginScreen)
   - Start with snapshot + behavior tests for auth flows and geofence logic
   - **Time:** 4–6 hours | **Risk:** Medium (may reveal bugs in edge cases)

5. **Document API Rate Limits in Postman / OpenAPI**
   - Rate limiters scattered across app.ts with comments
   - Create OpenAPI/Swagger spec or Postman collection listing all endpoints + limits
   - Enables external partners to plan integrations without reading source
   - **Time:** 2–3 hours | **Risk:** Low (documentation only)

6. **Add Storybook for Web Components**
   - Reusable components exist (BrandLogo, EmptyState, ErrorRetry, Kpi) but no visual catalog
   - Create Storybook with variants (error states, loading states, theme switching)
   - Speeds up UI work, documents component APIs
   - **Time:** 3–4 hours | **Risk:** Low (no code changes, setup only)

7. **Audit Event Export Format**
   - Audit log UI exists (AuditEventsPage) but export format is not documented
   - Add JSON/CSV export button that matches standard audit log schemas (ISO 8601 timestamps, hashed prompts, etc.)
   - Improves compliance verification and forensics
   - **Time:** 2 hours | **Risk:** Low

8. **Health Check Dashboard**
   - `/health`, `/health/db`, `/health/audit-pipeline` endpoints exist but are read-only
   - Create an internal ops dashboard (or integrate into StatusPage) showing:
     - Disk usage, DB connection pool status, Sandata/HHAeXchange API health, SES/Stripe webhook status
   - Helps catch integration failures before they cascade
   - **Time:** 4–5 hours | **Risk:** Low (telemetry only)

---

## Summary

**Repository is well-structured, security-conscious, and compliance-focused.** Key findings:

- **Stack:** Turbo monorepo (core + Express API + React web + React Native mobile)
- **Mobile Stack Inaccuracy:** README incorrectly claims Capacitor; actually Expo + React Native
- **Design System:** Centralized in web/index.css but duplicated in mobile/tokens.ts and landing-page CSS
- **Security:** Strong (CSRF, audit-log immutability, bcrypt, rate limiting, RBAC, HSTS, no localStorage auth)
- **Compliance:** EVV six elements, Sandata/HHAeXchange aggregator support, state-specific rules (PA/NJ), audit retention sweep
- **Testing:** Good coverage in core, app, web; gaps in mobile and some complex routes
- **Code Quality:** TypeScript strict mode, ESLint, pre-commit hooks (patch-package), CI gates (typecheck + lint + security-scan + tests)

**Duplication & Quick Wins:** Inline styles, landing CSS, token sync, missing tests, missing API docs.

