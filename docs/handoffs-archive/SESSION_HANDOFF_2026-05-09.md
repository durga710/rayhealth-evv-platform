# Session handoff — 2026-05-09

Single-doc summary of what shipped, what's verified live, and what remains owner-action.

---

## Repos touched

| Repo | Branch | Latest |
|---|---|---|
| `rayhealth-evv-platform` (backend) | `main` | `5ec1e56` |
| `rayhealth-evv-mobile` (Capacitor iOS) | `main` | `8a74eb0` |
| `rayhealthevv-fresh/rayhealth-fresh` (worktree, this repo) | `claude/hardcore-gagarin-8314b4` | uncommitted docs |

---

## Backend (`rayhealth-evv-platform`)

| Commit | Change | Live? |
|---|---|---|
| `7cfc3bb` + dist `a4fdc68` | `/auth/mobile/login` returns `firstName`/`lastName` from `caregivers` row | ✅ live: `firstName: "TEST-Roman"` |
| `8e88bb6` | New `GET /auth/mobile/me` + `UserRepository.findById()` | ✅ live |
| `8c5b1ce` | `getTodaysScheduleForCaregiver` — `DISTINCT ON (assignment_id)` subquery dedupes the today-schedule join | ✅ live: `schedule[].length === 1` |
| `8a6c592` | 3 vitest tests for `/auth/mobile/me` (caregiver-with-row, no-caregiver-row degrade, 401 unauth) — 32/32 green | n/a |
| `5ec1e56` | `packages/core/scripts/seed-app-store-fixture.ts` — idempotent, prod-guarded | (dev tool, not deployed) |

## Mobile (`rayhealth-evv-mobile`)

| Commit | Change |
|---|---|
| `a4414d4` | Learning preview banner + per-course "coming soon" toast |
| `43bd428` | Dashboard schedule-row refactor + `firstName` shape fallback + client-side schedule dedup (defense-in-depth) |
| `52aa95c` | Profile / Correction / CorrectionList clickability fixes; Dashboard avatar fallback |
| `166ece2` | Notification `actionUrl` whitelist; VisitDetail "Client Signature" + "RED VISIT" → "END VISIT" |
| `bdc7d2a` | Mobile login adapter consumes `firstName`/`lastName` from new login response |
| `0da5809` | `getProfile()` calls `/auth/mobile/me` so cached sessions refresh on bootstrap |
| `a00a7fc` | `ErrorBoundary` wraps Suspense+Routes — runtime errors surface a Reload UI instead of blank-screening |
| `8a74eb0` | Defer notification permission until first clock-in + complete marketing kit |

## Worktree (`rayhealthevv-fresh/rayhealth-fresh`)

Files written but **not yet committed** (parent repo is rooted in `$HOME` on branch `codex/security-phase-1` — owner decision on which branch should own them):

```
docs/RELEASE_PREP_GAPS.md          ← punch list (CRIT/HIGH/MED + owner-action)
docs/SESSION_HANDOFF_2026-05-09.md ← this file
docs/compliance/hipaa/             ← 5 HIPAA evidence docs ported from rayhealth-evv-clean
```

---

## Verified live on https://rayhealthevv.com

```
$ curl -s -X POST -H 'Content-Type: application/json' \
    -d '{"email":"test-caregiver-fixture@rayhealthevv.local","password":"TestCaregiver2026!"}' \
    https://rayhealthevv.com/api/auth/mobile/login
{
  "token": "...",
  "role": "caregiver",
  "agencyId": "e1c4a7e3-…",
  "firstName": "TEST-Roman",        ← NEW
  "lastName": "TEST-Ghimeray"       ← NEW
}

$ curl -s -H "Authorization: Bearer $TOKEN" https://rayhealthevv.com/api/auth/mobile/me
{
  "id": "00000000-0000-4000-8000-000000000003",
  "email": "test-caregiver-fixture@rayhealthevv.local",
  "role": "caregiver",
  "agencyId": "e1c4a7e3-…",
  "firstName": "TEST-Roman",
  "lastName": "TEST-Ghimeray"
}

$ curl -s -H "Authorization: Bearer $TOKEN" https://rayhealthevv.com/api/mobile/caregiver/today \
    | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["schedule"]))'
1   ← was 2 before, now correctly deduplicated

$ curl -s -X POST -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}' \
    https://rayhealthevv.com/api/support/chat
HTTP 200, friendly RayHealthAssist reply (Claude on AWS Bedrock)

$ curl -s -X OPTIONS -H 'Origin: capacitor://localhost' \
    https://rayhealthevv.com/api/mobile/caregiver/today
HTTP 204, access-control-allow-origin: capacitor://localhost
```

## Verified on the booted iPhone 17 Pro simulator

`/Users/durgaghimeray/Documents/rayhealth-evv-mobile/marketing/raw/02-dashboard-real-name.png`:

- Greeting: **"Hello, TEST-Roman"** (real caregiver name, no email-handle fallback)
- Schedule card: **TEST-Lok TEST-Ghimeray · TEST DAILY PERSONAL CARE · 225 National Dr, Pittsburgh, PA**
- "CONTINUE CLINICAL SESSION" CTA when visit is `pending`
- BottomNav rendering, no white-screen
- Avatar shows `T` (uppercase email initial)
- After deferring notification permission: clean dashboard with no permission popup blocking the view

---

## Marketing assets ready for the editor

Path: `/Users/durgaghimeray/Documents/rayhealth-evv-mobile/marketing/`

```
marketing/
  MARKETING_KIT.md              ← single source of truth for the ad pack
  raw/
    01-login-screen.png         ← clean post-erase login screen, 1206×2622
    02-dashboard-real-name.png  ← "Hello, TEST-Roman" + schedule card + CTA
  app-store-6.7/
    01-login-screen.png         ← resized to 1290×2796 (App Store 6.7" req)
    02-dashboard-real-name.png  ← resized to 1290×2796
```

`MARKETING_KIT.md` contains:

- **Brand direction** — healthcare-blue, calm, credible, operations-grade. Type & color hex codes (`#0B5FB1` primary, `#10A4A4` accent).
- **Compliance copy rule** — never imply we file taxes / execute wage payments. Use "payroll readiness," "approvals," "exports," "authorized payroll-provider handoff."
- **Spot 1 — Hero/Launch ("Care, finally on the same page.")** — 30s, 75-word VO at 150 wpm, full shot list 0–30s, music direction.
- **Spot 2 — Agency Owner ("Run the agency, not the spreadsheet.")** — 30s, pain→relief arc, paid social.
- **Spot 3 — Caregiver ("A workday that respects your time.")** — 30s, warm/real, no corporate gloss.
- **Spot 4 — Family ("Closer to the people you love.")** — 30s, tender/calm, hospital discharge-planner referrals.
- **Spot 5 — Compliance/Operations ("Audit-ready by design.")** — 30s, LinkedIn sponsored, industry pubs.
- **Spot 6 — 6-second pre-roll bumper** — no VO, single line + logo reveal.
- **Spot 7 — Audio-only cutdown** — 30s for Spotify/podcast/radio.
- **Production checklist** — domain confirmation, trademark mark, talent/b-roll preference, captions, A/B variants, UTM tagging.
- **Hand-off** — what still requires a human (VO recording, music license, editing, icon designer, localization).

What's still required from you / your editor:

1. **Voiceover** — read the script for any spot into a phone in a quiet room for a temp track; replace with ElevenLabs or paid VO when ready. 44.1 kHz mono –18 LUFS.
2. **Music license** — Artlist / Epidemic Sound / Soundstripe single-track, ~$15. Mid-tempo cinematic procedural, no swell.
3. **Editing** — DaVinci Resolve free tier handles all six spots. Drop the raw simulator captures + lower-thirds in RayHealth blue (`#1248a0` legacy / `#0B5FB1` updated).
4. **App Store icon master** — current placeholder is a generated RayHealth-blue square. Apple will reject. Spec: 1024×1024 PNG, no alpha, no rounded corners.
5. **Real talent / b-roll** — prefer real caregivers (with consent + release) over stock for spots 1–4. The brand promise is "operations-grade, not generic" — stock undercuts that.
6. **Localization** — copy is English only. Spanish + Mandarin matter for the PA home-care market.

---

## Open / owner-action items (from RELEASE_PREP_GAPS.md)

CRIT:
- Enable Neon HIPAA mode on project `late-art-87716813` (currently `settings.hipaa: false`). Required before any real PHI traffic.
- Move test fixtures off prod default branch to a Neon branch named `app-store-screenshots`. The seed script (committed `5ec1e56`) is ready — point `DATABASE_URL` at the new branch and run `npx tsx packages/core/scripts/seed-app-store-fixture.ts`.

HIGH:
- App Store icon brief.
- VisitDetail / Correction / Notification end-to-end smoke on real device (codepath fixes shipped this session, but real-device coverage missing).
- Wire `requestClockReminderPermission()` (new export in `src/services/clockReminderService.ts`) into the first clock-in flow so caregivers eventually opt in to reminders.

MED:
- Aggregator submission (Sandata / PROMISe export). Blocks MA billing for any agency that ships before this lands.
- Offline visit queue (IndexedDB or Capacitor SQLite) — currently fails silently if caregiver clocks in without network.
- Audit retention job — `audit_events` is append-only by trigger but has no archival/retention sweep.

Owner-action:
- BAAs in flight: AWS, Neon (after HIPAA-mode upgrade), Vercel (Enterprise required for BAA), Resend, Firebase. Templates in `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md`.
- Cyber liability with HIPAA-breach rider.
- Annual HIPAA Security Rule §164.308(a)(1)(ii)(A) risk analysis (signed/dated).
- External pen test report.

---

## Quick-reference fixture credentials

For App Store screenshot capture and end-to-end verification only. Synthetic — no real PHI:

| Field | Value |
|---|---|
| Caregiver email | `test-caregiver-fixture@rayhealthevv.local` |
| Caregiver password | `TestCaregiver2026!` |
| Caregiver UUID | `00000000-0000-4000-8000-000000000002` |
| Client UUID | `00000000-0000-4000-8000-000000000001` |
| Client address | 225 National Dr, Pittsburgh PA 15235 |
| Geofence radius | 150 m |
| Agency UUID | `e1c4a7e3-1cad-4001-8e0a-000000000001` |

Move to a Neon branch before public launch (CRIT item above).
