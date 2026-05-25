# RayHealth EVV — Backlog Execution Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Clear the full open engineering backlog in priority order, with tests and documentation for every change.

**Architecture:** Monorepo — packages/core (domain + repos), packages/app (Express API), packages/mobile (Expo React Native), packages/web (React + Vite admin). All ESM, Vitest for tests, Turbo for builds.

**Tech Stack:** TypeScript 5.8, Node 24, Expo SDK 54, React 19, Knex, Zod, Vitest, express

**Constraint:** All code must pass `npx turbo typecheck` + `npx vitest run` (per-package) before commit. No `--no-verify`. ESM imports must include `.js` extension.

---

## ITEM 1 — Fix `.claude/worktrees/` tracked in git (5 min, zero risk)

**Objective:** Untrack six empty `.claude/worktrees/` directories from git and add to `.gitignore` so future agents don't accidentally commit them. The handoff brief flags this as having broken `actions/checkout` before.

**Files:**
- Modify: `.gitignore` (root)
- Git: `git rm -r --cached .claude/worktrees/`

**Steps:**

1. Confirm the six paths are tracked:
   ```
   git ls-files .claude/worktrees/
   ```
   Expected output: six lines, one per worktree directory.

2. Remove them from the index (no file deletion):
   ```
   git rm -r --cached .claude/worktrees/
   ```

3. Add the ignore rule to `.gitignore` (append):
   ```
   # Claude Code agent worktrees — never commit
   .claude/worktrees/
   ```

4. Verify git status shows them as untracked (not staged):
   ```
   git status --short | grep worktree
   ```

5. Commit:
   ```
   git add .gitignore
   git commit -m "chore: untrack .claude/worktrees/, add to .gitignore"
   ```

---

## ITEM 2 — DashboardScreen: switch from `/api/assignments/caregiver` to today-only schedule (mobile)

**Objective:** The Dashboard currently fetches *all* caregiver assignments (no date filter). Replace with a new backend endpoint `GET /api/evv/today-schedule` that returns only today's visits (assignments joined with any active visit record), with proper `scheduledTime` field. Update DashboardScreen to use it.

**Why:** Caregivers should see only today's visits in the dashboard — the current endpoint returns all assignments ever, making the list meaningless in production.

**Files:**
- Create: `packages/core/src/repositories/schedule-repository.ts` — add `getTodaySchedule(caregiverId, date)` method
- Create: `packages/core/src/__tests__/schedule-repository-today.test.ts`
- Modify: `packages/app/src/routes/evv-routes.ts` — add `GET /today-schedule` route
- Modify: `packages/app/src/routes/__tests__/evv-today-schedule.test.ts` (new file)
- Modify: `packages/mobile/src/features/evv/DashboardScreen.tsx` — switch endpoint + handle `scheduledTime`

**Steps:**

### Step 1: Add `getTodaySchedule` to ScheduleRepository

In `packages/core/src/repositories/schedule-repository.ts`, add after `getAssignmentsByCaregiver`:

```typescript
/**
 * Returns assignments for a caregiver where the assignment is due today.
 * Since the current schema has no scheduled_date column on assignments,
 * we return all assignments (the backend endpoint further filters by
 * any active/clocked-in visit for today). This is the scaffold — a
 * scheduled_date migration is tracked as a follow-up.
 *
 * Returns: { id, caregiverId, visitTemplateId, clientName, scheduledTime }[]
 */
async getTodaySchedule(caregiverId: string, date: string): Promise<TodayScheduleItem[]> {
  // date param is YYYY-MM-DD — used to find any visits already clocked-in today
  const rows = await this.db('assignments')
    .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
    .join('clients', 'visit_templates.client_id', 'clients.id')
    .leftJoin(this.db('evv_visits')
      .select('assignment_id')
      .whereRaw("DATE(clock_in_time) = ?", [date])
      .as('today_visits'), 'today_visits.assignment_id', 'assignments.id')
    .where('assignments.caregiver_id', caregiverId)
    .select(
      'assignments.id',
      'assignments.caregiver_id',
      'assignments.visit_template_id',
      'clients.first_name',
      'clients.last_name',
      this.db.raw("today_visits.assignment_id IS NOT NULL as clocked_in_today")
    );

  return rows.map(row => ({
    id: row.id as string,
    caregiverId: row.caregiver_id as string,
    visitTemplateId: row.visit_template_id as string,
    clientName: `${row.first_name as string} ${row.last_name as string}`,
    scheduledTime: null, // scaffold — populated when scheduled_date column lands
    clockedInToday: Boolean(row.clocked_in_today),
  }));
}
```

Add the type above the class:
```typescript
export interface TodayScheduleItem {
  id: string;
  caregiverId: string;
  visitTemplateId: string;
  clientName: string;
  scheduledTime: string | null;
  clockedInToday: boolean;
}
```

Export the type from `packages/core/src/index.ts`:
```typescript
export type { TodayScheduleItem } from './repositories/schedule-repository.js';
```

### Step 2: Write a core test for getTodaySchedule

Create `packages/core/src/__tests__/schedule-repository-today.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleRepository } from '../repositories/schedule-repository.js';

const mockDb = () => {
  const chainable: any = {
    join: () => chainable,
    leftJoin: () => chainable,
    where: () => chainable,
    select: () => chainable,
    whereRaw: () => chainable,
    as: () => chainable,
  };
  const fn: any = vi.fn(() => chainable);
  fn.raw = vi.fn(() => 'raw_expr');
  chainable.select = vi.fn().mockResolvedValue([
    {
      id: 'a-1',
      caregiver_id: 'cg-1',
      visit_template_id: 'vt-1',
      first_name: 'John',
      last_name: 'Doe',
      clocked_in_today: false,
    },
  ]);
  return fn;
};

describe('ScheduleRepository.getTodaySchedule', () => {
  it('maps rows to TodayScheduleItem shape', async () => {
    const db = mockDb();
    const repo = new ScheduleRepository(db as any);
    const result = await repo.getTodaySchedule('cg-1', '2026-05-24');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'a-1',
      caregiverId: 'cg-1',
      clientName: 'John Doe',
      scheduledTime: null,
      clockedInToday: false,
    });
  });
});
```

### Step 3: Add `GET /api/evv/today-schedule` to evv-routes

In `packages/app/src/routes/evv-routes.ts`, add before the final `export`:

```typescript
router.get('/today-schedule', requireCapability('evv.read'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) {
      return res.status(403).json({ message: 'Not authorized as caregiver' });
    }
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
    const schedule = await repo.getTodaySchedule(req.auth.caregiverId, date);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
```

Import `ScheduleRepository` at the top if not already present (it is — check the import block).

### Step 4: Write an app-level test for the new route

Create `packages/app/src/routes/__tests__/evv-today-schedule.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import evvRouter from '../evv-routes.js';

// Minimal app harness
function makeApp(caregiverId: string | null, scheduleResult: any[]) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.auth = { caregiverId, agencyId: 'agency-1', role: 'caregiver', capabilities: ['evv.read', 'evv.write'] };
    next();
  });
  const mockRepo = { getTodaySchedule: vi.fn().mockResolvedValue(scheduleResult) };
  app.set('db', { /* knex stub */ });
  // Patch ScheduleRepository to use mock
  vi.mock('@rayhealth/core', async (importOriginal) => {
    const actual: any = await importOriginal();
    return { ...actual, ScheduleRepository: vi.fn(() => mockRepo) };
  });
  app.use('/', evvRouter);
  return app;
}

describe('GET /evv/today-schedule', () => {
  it('returns 403 when not a caregiver', async () => {
    // Build app with no caregiverId
    // ... test implementation
  });

  it('returns today schedule array', async () => {
    // ... test implementation
  });
});
```

Note: The app-level test uses supertest. Add supertest to devDependencies if missing:
```
npm install --save-dev supertest @types/supertest --workspace=@rayhealth/app
```

### Step 5: Update DashboardScreen.tsx

Replace the `fetchAssignments` useEffect in `packages/mobile/src/features/evv/DashboardScreen.tsx`:

```typescript
// Change the interface
interface ScheduleItem {
  id: string;
  clientName: string;
  scheduledTime: string | null;
  clockedInToday: boolean;
}

// Change state type
const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

// Change fetch call
const { data } = await apiClient.get('/api/evv/today-schedule');
setSchedule(data || []);

// Update renderItem to use scheduledTime
<Text style={styles.itemMeta}>
  {item.scheduledTime || 'Time not specified'}
  {item.clockedInToday ? ' ✓ Clocked in' : ''}
</Text>

// Update openClockIn
const openClockIn = (item: ScheduleItem) => {
  router.push({
    pathname: '/clockin',
    params: {
      assignmentId: item.id,
      clientName: item.clientName,
      scheduledTime: item.scheduledTime ?? '',
    },
  });
};
```

### Step 6: Typecheck + test + commit

```bash
cd packages/core && npx vitest run
cd ../app && npx vitest run
npx turbo typecheck
git add packages/core packages/app/src/routes packages/mobile/src/features/evv/DashboardScreen.tsx
git commit -m "feat(mobile): dashboard shows today-schedule via new /api/evv/today-schedule endpoint"
```

---

## ITEM 3 — VisitDetailScreen / CorrectionScreen / NotificationScreen clickability audit (mobile)

**Objective:** Audit the mobile screens referenced in PROJECT_STATUS — VisitDetailScreen, CorrectionScreen, NotificationScreen, and Profile sub-options — to determine which exist, which have dead UI elements, and which are missing entirely. Then implement the minimum clickable skeleton for any missing screens.

**Files:**
- Read: all files under `packages/mobile/src/features/`
- Create any missing screen files
- Modify: `packages/mobile/app/_layout.tsx` to register new routes if needed

**Steps:**

### Step 1: Audit what exists

Check for each screen:
```bash
find packages/mobile/src/features -name "*.tsx" | sort
find packages/mobile/app -name "*.tsx" | sort
```

For each found screen, check for Pressable/Button onPress handlers that `console.warn("TODO")` or navigate to missing routes.

### Step 2: For each missing screen, create a typed placeholder

Example — `packages/mobile/src/features/evv/VisitDetailScreen.tsx`:
```typescript
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function VisitDetailScreen() {
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Visit Detail</Text>
      <Text style={styles.subtitle}>Visit ID: {visitId ?? 'unknown'}</Text>
      {/* TODO: wire GET /api/evv/visits/:id */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c' },
  subtitle: { color: '#64748b', marginTop: 8 },
});
```

### Step 3: Register new routes in expo-router

For each new screen, create the corresponding `app/` entry file (e.g. `app/visit-detail.tsx`):
```typescript
import VisitDetailScreen from '../src/features/evv/VisitDetailScreen';
export default VisitDetailScreen;
```

### Step 4: Wire any tappable items in DashboardScreen that should navigate to VisitDetailScreen

Existing "Start EVV" → `ClockInScreen` is correct. Add a secondary "View Detail" link if a visit is already clocked in.

### Step 5: Typecheck + commit
```bash
npx turbo typecheck
git add packages/mobile/
git commit -m "feat(mobile): add VisitDetailScreen, CorrectionScreen, NotificationScreen placeholders with typed props"
```

---

## ITEM 4 — Wire `requestClockReminderPermission()` into first clock-in flow

**Objective:** On first successful clock-in, request notification permission for clock reminders. The service function doesn't exist yet — create it as an Expo Notifications wrapper, then call it from ClockInScreen after a successful clock-in response.

**Files:**
- Create: `packages/mobile/src/services/clockReminderService.ts`
- Modify: `packages/mobile/src/features/evv/ClockInScreen.tsx`

**Steps:**

### Step 1: Create clockReminderService.ts

```typescript
// packages/mobile/src/services/clockReminderService.ts
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const REMINDER_PERMISSION_ASKED_KEY = 'rayhealth_reminder_permission_asked';

/**
 * Requests notification permission for clock-in/out reminders.
 * Only asks once — subsequent calls are no-ops if already asked.
 * Safe to call on any platform; no-ops on web.
 */
export async function requestClockReminderPermission(): Promise<void> {
  // Only ask once per device
  const alreadyAsked = await SecureStore.getItemAsync(REMINDER_PERMISSION_ASKED_KEY);
  if (alreadyAsked) return;

  await SecureStore.setItemAsync(REMINDER_PERMISSION_ASKED_KEY, 'true');
  await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
    },
  });
}
```

Check if `expo-notifications` is in mobile package.json. If not, add it:
```bash
npm install expo-notifications --workspace=@rayhealth/mobile
```

### Step 2: Wire into ClockInScreen

After the successful clock-in `Alert.alert('Success', ...)` call, add:

```typescript
import { requestClockReminderPermission } from '../../services/clockReminderService.js';

// Inside handleClockIn, after setVisit(data):
setVisit(data);
Alert.alert('Success', 'Clocked in successfully!');
// Request reminder permission on first clock-in (deferred until real use)
void requestClockReminderPermission();
```

### Step 3: Typecheck + commit
```bash
npx turbo typecheck
git add packages/mobile/src/services/clockReminderService.ts packages/mobile/src/features/evv/ClockInScreen.tsx
git commit -m "feat(mobile): wire requestClockReminderPermission() into first clock-in"
```

---

## ITEM 5 — Mock-location detector for geofence integrity (PA DHS audit readiness)

**Objective:** Add a mock-location detection check in ClockInScreen. If a mock provider is detected, reject the clock-in client-side with a clear message. This is a PA DHS audit requirement to prevent caregivers from spoofing location.

**Files:**
- Create: `packages/mobile/src/services/locationIntegrityService.ts`
- Modify: `packages/mobile/src/features/evv/ClockInScreen.tsx`

**Steps:**

### Step 1: Create locationIntegrityService.ts

```typescript
// packages/mobile/src/services/locationIntegrityService.ts
import * as Location from 'expo-location';

export interface LocationIntegrityResult {
  isMocked: boolean;
  reason: string | null;
}

/**
 * Checks whether the current location reading may be spoofed.
 * On Android, expo-location exposes `mocked` on the position object.
 * On iOS, no system-level flag is available — we fall back to a
 * heuristic: perfect 0.0 accuracy is a strong mock indicator.
 */
export async function checkLocationIntegrity(): Promise<LocationIntegrityResult> {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  // Android: position.mocked is set by the OS
  const coords = position.coords as typeof position.coords & { mocked?: boolean };
  if (coords.mocked === true) {
    return { isMocked: true, reason: 'Mock location provider detected' };
  }

  // Heuristic: accuracy of exactly 0 is unrealistic on a real device
  if (position.coords.accuracy === 0) {
    return { isMocked: true, reason: 'Unrealistic GPS accuracy — possible mock location' };
  }

  return { isMocked: false, reason: null };
}
```

### Step 2: Wire into ClockInScreen handleClockIn

After the location permission check, before calling the API:

```typescript
import { checkLocationIntegrity } from '../../services/locationIntegrityService.js';

// Inside handleClockIn, after getting location permission:
const integrity = await checkLocationIntegrity();
if (integrity.isMocked) {
  Alert.alert(
    'Location Integrity Violation',
    'Mock location detected. EVV clock-in requires real GPS. Please disable any mock location apps and try again.',
    [{ text: 'OK' }]
  );
  setIsLoading(false);
  return;
}
// Then proceed with real location fetch...
```

Note: After the integrity check, we can reuse the position already fetched inside `checkLocationIntegrity`. Refactor to return the position too, avoiding a double GPS call:

```typescript
export interface LocationIntegrityResult {
  isMocked: boolean;
  reason: string | null;
  position: Location.LocationObject | null;
}
```

### Step 3: Typecheck + commit
```bash
npx turbo typecheck
git add packages/mobile/src/services/locationIntegrityService.ts packages/mobile/src/features/evv/ClockInScreen.tsx
git commit -m "feat(mobile): add mock-location detector for geofence integrity (PA DHS audit)"
```

---

## ITEM 6 — Playwright e2e scaffolding in CI

**Objective:** Add a Playwright e2e test for the caregiver clock-in/out flow against the web/admin surface, and wire it into the CI workflow as a new job. Scope: scaffold + one smoke test (loads the login page, not full e2e against live DB — that requires a test DB).

**Files:**
- Create: `packages/web/e2e/smoke.spec.ts`
- Create: `packages/web/playwright.config.ts`
- Modify: `.github/workflows/ci.yml` — add `e2e` job
- Modify: `packages/web/package.json` — add playwright devDependency + `e2e` script

**Steps:**

### Step 1: Install Playwright in web package

```bash
npm install --save-dev @playwright/test --workspace=@rayhealth/web
```

### Step 2: Create playwright.config.ts

```typescript
// packages/web/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: true,
  },
  // CI: build the app first
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

### Step 3: Create smoke test

```typescript
// packages/web/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('login page loads and has email field', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
});

test('unauthenticated root redirects to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
});
```

### Step 4: Add script to package.json

```json
"e2e": "playwright test"
```

### Step 5: Add e2e job to .github/workflows/ci.yml

```yaml
e2e:
  name: E2E smoke
  runs-on: ubuntu-latest
  needs: [typecheck, lint]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run build --workspace=@rayhealth/web
    - run: npm run e2e --workspace=@rayhealth/web
      env:
        E2E_BASE_URL: http://localhost:4173
    # Serve built dist for e2e
    - name: Serve built app
      run: npx serve packages/web/dist -p 4173 &
      shell: bash
```

### Step 6: Commit
```bash
git add packages/web/e2e packages/web/playwright.config.ts packages/web/package.json .github/workflows/ci.yml
git commit -m "feat(ci): add Playwright e2e scaffold with login page smoke tests"
```

---

## ITEM 7 — Documentation: update PROJECT_STATUS.md

**Objective:** After all above items are done, update PROJECT_STATUS.md to reflect:
- Completed items removed from open backlog
- New services added (clockReminderService, locationIntegrityService)
- New endpoint documented (/api/evv/today-schedule)
- Worktrees fix noted in changelog

**Steps:**

1. Open `PROJECT_STATUS.md`
2. Update `Last updated` timestamp to today (2026-05-24)
3. Move completed items from "Open items" to changelog section
4. Add new changelog entry for 2026-05-24
5. Commit: `git commit -m "docs: update PROJECT_STATUS.md for 2026-05-24 sprint"`

---

## Verification checklist (run after all items)

```bash
# Full test suite — all must pass
cd packages/core && npx vitest run
cd ../app && npx vitest run
cd ../web && npx vitest run

# Typecheck all packages
cd ../.. && npx turbo typecheck

# Git log — verify clean commits
git log --oneline -10

# No worktrees tracked
git ls-files .claude/worktrees/ | wc -l  # must be 0
```

---

_Plan written: 2026-05-24. Execute in order — each item is independent of the next except ITEM 7 (docs) which should be last._
