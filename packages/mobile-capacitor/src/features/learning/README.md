# Caregiver Learning module — mobile (Capacitor)

Caregiver-facing screens for the Learning Hub. The coordinator-facing UI lives in `packages/web`; this module is what the caregiver sees on their phone.

## Files

```
features/learning/
├── api.ts                    Fetch wrapper for /api/learning/*. JWT from auth service.
├── types.ts                  Mirror of @rayhealth/core Learning domain types.
├── LearningHubScreen.tsx     List of assigned courses with status chips.
├── CourseDetailScreen.tsx    Single course detail + Mark complete / Recertify button.
└── README.md                 This file.
```

## Integration

Three places need to change in the existing Capacitor app:

**1. Router** (likely `src/AppRouter.tsx` or `src/main.tsx`):

```tsx
import { LearningHubScreen } from './features/learning/LearningHubScreen';
import { CourseDetailScreen } from './features/learning/CourseDetailScreen';

// inside <Routes>:
<Route path="/learning" element={<LearningHubScreen />} />
<Route path="/learning/:enrollmentId" element={<CourseDetailScreen />} />
```

**2. Bottom tab nav / drawer** — add a Learning entry pointing at `/learning`. Use the existing nav-icon convention; a graduation-cap or book icon is conventional.

**3. Auth hook** — both screens import `useCurrentCaregiver` from `'../../hooks/useCurrentCaregiver'`. If your app uses a different hook name or path, change those two imports. The hook is expected to return:

```ts
{ caregiverId: string; firstName: string; lastName: string } | null
```

**4. API base URL** — `api.ts` reads `VITE_API_BASE` from env (defaults to `https://rayhealthevv.com`). Add to your `.env.production` if you use a different base.

**5. Auth token accessor** — `api.ts` imports `getAuthToken` from `'../../services/auth'`. If your app keeps the JWT somewhere else (e.g. inside an `AuthContext`), change that import. The function is expected to return:

```ts
() => Promise<string | null>
```

## What the screens do

**LearningHubScreen (`/learning`):**
- Pulls the caregiver's enrollments via `GET /api/learning/caregivers/:id`
- Lists each course with status chip (Not started / In progress / Completed / Overdue / Expired)
- Top-right "Compliant" / "Action needed" pill
- Empty state when nothing assigned
- Tap a card to drill into detail

**CourseDetailScreen (`/learning/:enrollmentId`):**
- Course title, description, all metadata (cadence, duration, due, last completed, expires, code)
- "Mark complete" button (or "Recertify" if status is `completed` / `expired`)
- Submits `POST /api/learning/complete` with caregiver self-attestation note
- Attestation disclosure under the button — important for compliance

## Why self-attestation

For the first release, completions are caregiver self-attested with a coordinator-visible audit trail. Coordinators see every completion event (and the note) in the agency audit log. A future release can add:

- Embedded video players that auto-mark complete after watch-time threshold
- Quiz integration with score-gated completion
- External LMS integration (Relias, CareAcademy) via webhook
- Coordinator-attested completions (e.g. for in-person training where the caregiver couldn't tap the button themselves)

All of those still write to the same `POST /api/learning/complete` endpoint — the audit field captures the source.

## Styling

The screens use plain inline CSS to stay self-contained while you decide on integration. Swap for your app's design system (Tailwind, CSS Modules, styled-components) when integrating — the structure and behavior is the contract; the styling is the example.

## Testing

No tests included in this folder because the existing test setup in `packages/mobile-capacitor/` isn't visible from this workspace. When wiring into the actual app:

- Vitest unit tests on the `api.ts` fetch wrapper (mock `fetch`)
- React Testing Library for the screens (mock `fetchCaregiverProgress` and `recordCompletion`)
- Playwright e2e for the full caregiver flow: log in → open Learning Hub → tap a course → mark complete → return to hub and verify status updated

Per repo testing rules.
