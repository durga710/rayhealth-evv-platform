# RayHealthEVV — Engineering Handoff for Sishir Phuyal

**From:** Durga Ghimeray (founder)
**To:** Sishir Phuyal (co-founder, engineering)
**Date:** 2026-06-28
**Your primary focus:** ship the **iOS + Android caregiver apps**, then help close the remaining platform gaps.

---

## 1. What RayHealthEVV is

A production home-care agency operating system for Pennsylvania agencies — a serious
alternative to HHAeXchange. It does Electronic Visit Verification (EVV), scheduling,
compliance, claims/billing readiness, payroll readiness, training, and an AI copilot.

- **Live web app + API:** https://rayhealthevv.com
- **Admins/coordinators** use the web app (the "admin portal" + "Command Center").
- **Caregivers** use the **mobile app** (clock in/out at the client's home with GPS geofence). **This is the part you're driving.**

---

## 2. Repo & architecture

Monorepo (npm workspaces) at `~/Projects/rayhealth-evv`. **It is not currently a git
repo on disk** — ask Durga for the GitHub remote / how he wants you to get a clone with
history. Packages:

| Package | What it is | Stack |
|---|---|---|
| `packages/core` | Domain logic, services, repositories, DB access | TypeScript, Knex, PostgreSQL (Neon), Zod |
| `packages/app` | REST API (Express) | TypeScript, Express |
| `packages/web` | Admin web app | React + Vite + React Router (inline styles + CSS tokens) |
| `packages/mobile` | **Caregiver app (your focus)** | **Expo (expo-router), React Native 0.85, Expo SDK 54** |

Data flow: `mobile`/`web` → `app` (REST) → `core` (services/repositories) → PostgreSQL.

**Important deploy fact:** the API (`packages/app`) is compiled to `dist/` and served on
Vercel via `api/index.js`. You **must rebuild `core` + `app` dist before deploying the
backend**. The **mobile app is NOT part of the Vercel deploy** — it ships through Expo/EAS
(your responsibility, see §5).

---

## 3. Run everything locally

```bash
# from repo root
npm install

# build the shared packages first (web/app/mobile depend on core)
npm run -w @rayhealth/core build

# API (Express) — needs a DATABASE_URL (ask Durga for a Neon dev branch)
npm run -w @rayhealth/app dev          # or: build + node dist

# Admin web app
npm run -w @rayhealth/web dev          # Vite dev server

# Mobile app (your day-to-day)
cd packages/mobile
npm run ios        # opens iOS simulator (needs Xcode on macOS)
npm run android    # opens Android emulator (needs Android Studio)
npm start          # Expo dev server / Expo Go on a physical device
```

The mobile app talks to **production** (`https://rayhealthevv.com`) by default — see
`app.json` → `expo.extra.apiUrl`. For local testing against a local API, change that value
(or wire an env switch — see §6 tasks).

---

## 4. Test & build cheat sheet

```bash
# Tests (vitest in each package)
npm run -w @rayhealth/core test     # 92 tests
npm run -w @rayhealth/app  test     # 195 tests
npm run -w @rayhealth/web  test     # 22 tests
npm run -w @rayhealth/mobile test   # 14 tests (geofence + visit-state — pure logic only)

# Type-check / build
npm run -w @rayhealth/core build
npm run -w @rayhealth/app  build
npm run -w @rayhealth/web  build
cd packages/mobile && npx tsc --noEmit   # 4 PRE-EXISTING errors in Expo scaffold (see §5.7)

# Deploy WEB + API to production (rebuild dist first!)
npm run -w @rayhealth/core build && npm run -w @rayhealth/app build
npx vercel --prod --force --yes --scope reyghim1093-5928s-projects
# then sanity check: curl -s -o /dev/null -w "%{http_code}\n" https://rayhealthevv.com/
```

---

## 5. MOBILE — your primary focus

### 5.1 Current state (honest)

The caregiver app **works end-to-end for the core EVV loop** but is **early** — only 3
screens, no store builds yet, and a few submission blockers. It is **not yet on the App
Store or Play Store.**

- **Framework:** Expo SDK 54, expo-router (file-based routes in `packages/mobile/app/`),
  React Native 0.85, new architecture enabled.
- **Bundle IDs already set:** iOS `com.rayhealth.evv`, Android `com.rayhealth.evv`.
- **Auth:** email/password → `POST /api/auth/mobile/login` → bearer token stored in
  `expo-secure-store`. Token attached by an axios interceptor; 401 triggers logout.
- **Caregiver-only:** admins are redirected away (the app is for field staff).

### 5.2 Screens (`packages/mobile/src/features/`)

| Screen | File | Status |
|---|---|---|
| Login | `auth/LoginScreen.tsx` | Works |
| Today's dashboard | `evv/DashboardScreen.tsx` | Works — lists today's visits, shows In-progress/Completed badges, taps into clock screen |
| Clock in/out | `evv/ClockInScreen.tsx` | Works — live GPS geofence ring, clock in/out, **resumes an in-progress visit** |

Routes live in `packages/mobile/app/` (expo-router): `login.tsx`, `(tabs)/`, `(tabs)/clockin.tsx`, `index.tsx`, `modal.tsx`, `_layout.tsx`.

### 5.3 Shared libs (`packages/mobile/src/lib/`)

- `api-client.ts` — axios instance, base URL from `expo.extra.apiUrl`, bearer-token + 401 handling.
- `AuthContext.tsx` — login/logout, SecureStore persistence, current user.
- `geofence.ts` — **pure** haversine + inside/outside evaluation (unit-tested). Client-side preview; the **server re-checks** the geofence at clock-in/out.
- `visit-state.ts` — **pure** derivation of `not_started | in_progress | completed` from the open-visit fields the API returns (unit-tested). This is what lets the app **resume** a visit instead of double-clocking-in.
- `shift-alert-scheduler.ts` — schedules **local** notifications ~30 min before a shift.
- `notification-permissions.ts` — requests notification permission.

### 5.4 The EVV clock-in/out flow (the heart of the app)

1. Dashboard calls `GET /api/mobile/caregiver/today` → today's visits + each one's open-visit
   state (`currentVisitId`, `currentClockInTime`, `currentClockOutTime`).
2. Tapping a visit opens `ClockInScreen` with the client's geofence (lat/lng/radius) and any
   open visit to resume.
3. The screen watches GPS, shows distance vs allowed radius, and enables **Clock In** only
   when inside the zone.
4. Clock in → `POST /api/evv/clock-in` `{ assignmentId, location:{lat,lng,accuracy} }`.
   Server re-validates the geofence and returns `422 GEOFENCE_OUT_OF_BOUNDS` if outside.
5. Clock out → `POST /api/evv/clock-out/:visitId` `{ location:{...} }`.

### 5.5 Backend endpoints the mobile app uses

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/mobile/login` | `{email,password}` → `{token, user}` |
| GET | `/api/mobile/caregiver/today` | Today's schedule (12h back/24h forward) + open-visit state + `serverTime` |
| POST | `/api/evv/clock-in` | Clock in (server enforces geofence) |
| POST | `/api/evv/clock-out/:visitId` | Clock out |

These are all live in production. The backend already returns everything the app needs for
the current screens — most mobile work is **client-side**.

### 5.6 🚩 Store-submission blockers (do these first)

1. **iOS location permission strings are MISSING.** `app.json` does not configure the
   `expo-location` plugin, so the iOS build won't have `NSLocationWhenInUseUsageDescription`.
   Apple **will reject** an EVV app that uses location without a usage string. Add the
   plugin with clear copy, e.g.:
   ```json
   ["expo-location", {
     "locationWhenInUsePermission": "RayHealthEVV records your location at clock-in and clock-out to verify visits for Pennsylvania EVV compliance."
   }]
   ```
   Decide whether you need **background** location (see §5.8) — if so you also need
   `NSLocationAlwaysAndWhenInUseUsageDescription` + the background mode.
2. **No `eas.json` / EAS Build is not set up.** You'll need an Expo account + EAS to produce
   signed `.ipa`/`.aab` builds. `eas build:configure`, then `eas build -p ios` / `-p android`.
   Coordinate Apple Developer + Google Play Console accounts with Durga.
3. **App display name is inconsistent.** `app.json` says `"RayHealth EVV"` (two words); the
   canonical brand is now **`RayHealthEVV™`** (one word). Align the app name/store listing.
4. **Privacy policy + EVV data disclosure** for both stores (location + health-adjacent data).
   A privacy page exists on the web (`/privacy`) — make sure store listings point to it and
   it covers mobile location capture.

### 5.7 Known issues / debt

- **4 pre-existing TypeScript errors** in Expo starter scaffold files (not our code):
  `components/external-link.tsx`, `components/parallax-scroll-view.tsx`,
  `hooks/use-theme-color.ts`. Safe to fix or delete the unused scaffold. Our EVV screens +
  `src/lib/*` are clean.
- **Mobile tests only cover pure logic** (`src/lib/**` via `packages/mobile/vitest.config.ts`).
  No component/E2E tests yet — React Native components can't run under the node test env we
  set up. Consider Maestro or Detox for device E2E.
- **API URL is hardcoded to prod** in `app.json extra.apiUrl`. No dev/staging switch.

### 5.8 Recommended next tasks (mobile), roughly prioritized

1. **Unblock store builds** — §5.6 items 1–3 (location plugin, EAS config, app name).
2. **Background / reliable geolocation** — today GPS is **foreground only**. Decide if EVV
   needs background location and harden accuracy handling.
3. **Offline clock-in queue** — caregivers often have poor signal at clients' homes. Queue
   clock-in/out locally and sync when back online (this is a real differentiator vs the GPS
   "fails open" risk).
4. **Visit history screen** — caregivers can only see *today*. Add a past-visits list
   (there's a web equivalent; a `GET /api/.../caregiver` history endpoint may need adding —
   coordinate with whoever owns `packages/app`).
5. **Profile / settings screen** — view profile, notification prefs, sign out, app version.
6. **Push notifications (remote)** — `expo-notifications` is wired for *local* shift alerts
   only. Wire Expo push tokens + a server-side send for real-time dispatch (shift changes,
   "you forgot to clock out").
7. **"Forgot to clock out" nudge** — if a visit is still open past its scheduled end, alert
   the caregiver. The data (`currentClockInTime`, no clock-out) is already available.
8. **Accessibility + larger-text support** — caregivers span a wide age range.
9. **Mobile E2E** (Maestro/Detox) on the clock-in happy path + geofence-denied path.

---

## 6. Conventions & gotchas (whole repo)

- **`req.params.id` is typed `string | string[]`** in the API — always wrap `String(req.params.id)`.
- **Tenant scoping is mandatory** — every query is scoped to an `agencyId`. Caregivers are
  scoped via the `caregivers.agency_id` join (not just `caregiver_id`).
- **RBAC capabilities** live in `packages/core/src/config/pennsylvania.ts`. Caregivers have
  `schedule.read / evv.read / evv.write / learning.read`. `agency.read` = admin + coordinator only.
- **No PHI in logs, AI prompts, or tests** — synthetic data only in tests. The AI briefing
  prompt is deliberately counts-only.
- **Pure logic → testable modules.** Pattern used across the codebase: put decision logic in
  a pure function (no I/O), unit-test it, call it from the route/screen. (`geofence.ts`,
  `visit-state.ts`, `command-center-service.ts` are good examples.)
- **Secrets** (DB URL, JWT secret, AI keys, Vercel scope) are NOT in the repo — get them
  from Durga. Never commit secrets.

---

## 7. Platform status — what's DONE vs what's LEFT (non-mobile)

The web/API platform is mature. Recent work built a coherent owner workflow:

**Recently shipped (live on rayhealthevv.com):**
- **Command Center** (`/admin`) — daily cockpit: ranked "needs attention" + today + compliance/readiness KPIs.
- **Today's Visits board** (`/admin/today`) — live status of every visit today; drill-down for "late to start".
- **Reschedule conflict gate** — editing an assignment can't silently double-book or exceed authorized units.
- **Coverage forecast** — surfaces recurring visits not yet generated into the calendar (they'd otherwise silently never happen), with a one-click "Generate now".
- **AI daily briefing** — plain-English prioritization of the cockpit (Bedrock Claude, Gemini fallback; counts-only, no PHI).
- **Claim-readiness blockers** — on the Claims page: the exact visits blocking a clean claim run (not clocked out / flagged / pending) with "Resolve →" links.

**Not finished / next up (non-mobile):**
- **Payroll-readiness blocker drill-down** — mirror of the claims blockers for payroll (open/un-clocked-out visits that distort hours before export). *Spec'd, not built.*
- **Billing depth** — load a **fee schedule** (claim charge amounts), complete the **agency billing profile** (NPI, tax id, address) for a clean 837, and **clearinghouse 837 transmission** (needs trading-partner credentials).
- **Web render tests** for the coverage banner on the Recurring Schedules page.
- **Tier-2 cryptographic claim integrity** (state-grade) — a locked ~8-week design exists (QLDB anchor gated behind an ED memo). Bigger initiative; ask Durga.
- Assorted ops-hardening items (credentialing depth, retention).

> For the granular cycle-by-cycle history and rationale, the working notes are in Durga's
> project memory (`project-rayhealth-qa-pass.md`). Ask him to share it if you want the deep log.

---

## 8. First-week checklist for Sishir

- [ ] Get repo access + history from Durga; `npm install`; build `core`.
- [ ] Get a **Neon dev DATABASE_URL** and the **mobile test login** (a synthetic caregiver account).
- [ ] Run the mobile app in the iOS simulator + an Android emulator; log in; complete a clock-in/out against the test client.
- [ ] Read `ClockInScreen.tsx`, `DashboardScreen.tsx`, `lib/geofence.ts`, `lib/visit-state.ts`.
- [ ] Fix the **store-submission blockers** (§5.6): add the `expo-location` plugin + iOS usage strings, set up **EAS Build**, align the app name to `RayHealthEVV™`.
- [ ] Produce a first **TestFlight (iOS)** + **internal-track (Android)** build and get it onto a device.
- [ ] Then tackle the mobile roadmap (§5.8) starting with offline clock-in + background location.

Welcome aboard — the backend is solid and waiting; the win is getting these apps into
caregivers' hands. — Durga
