# Release Prep Gaps

Last updated: 2026-05-09 (rev 2 — afternoon roadmap push)

## Closed this rev

- [x] Notification permission deferred until first clock-in (Apple HIG; clean App Store screenshots). Mobile commit `b6cb13c`.
- [x] **HIPAA audit retention reporting** — `GET /api/admin/audit-retention/status` returns `totalRows / oldestOccurredAt / eventsLast30Days / eventsApproachingSixYearLimit / retentionFloorYears: 6 / immutabilityTrigger`. Admin-only via new `audit.read` capability. Backend commits `92d42df`, `6245a6d`. 35/35 tests passing. Live and verified.
- [x] **Offline visit-action queue** — `src/services/visit-offline-queue.ts`. Network failures during clock-in/out now persist to Capacitor SecureStorage with the original timestamp; FIFO drain on `online` event + on app foreground. Mobile commit `b08ed82`.
- [x] **Sandata aggregator export skeleton** — `GET /api/exports/sandata.csv?from=&to=`. Sandata "EVV Provider Self-Service Visit Maintenance" column order; tenant-scoped. Backend commit `f337cf3`. Live. (Production needs Sandata Provider ID + external Worker ID + HCPCS modifier mapping — tracked below.)

Concrete punch-list of what is **not yet done** before public launch. Items are grouped by who can resolve them. "Owner action" means it requires the human, not Claude.

## Production verification — DONE

- [x] AWS Bedrock support chat (`POST /api/support/chat`) returns 200 with friendly assistant reply (Claude Haiku 3.5, BAA-eligible).
- [x] Capacitor native CORS preflight to `/api/mobile/caregiver/today` from `Origin: capacitor://localhost` returns `204` with `access-control-allow-origin` echo.
- [x] Geofence end-to-end: NYC clock-in 492 km from client → `422 GEOFENCE_OUT_OF_BOUNDS`; Pittsburgh on-site → `201` with status `pending`.
- [x] Mobile token storage moved off `@capacitor/preferences` (UserDefaults / SharedPreferences plaintext) to `@aparajita/capacitor-secure-storage` (iOS Keychain / Android Keystore).
- [x] HIPAA evidence docs (`SECURITY_POLICY`, `INCIDENT_RESPONSE`, `DATA_RETENTION`, `ENCRYPTION_VERIFICATION`, `BAA_REQUEST_EMAILS`) ported into the canonical worktree under `docs/compliance/hipaa/`.

## Engineering — open

### CRIT — must close before any prod traffic

- [ ] **Neon project HIPAA mode is OFF.** `late-art-87716813` shows `settings.hipaa: false`. Neon will not sign a BAA without HIPAA mode enabled. Action: enable HIPAA on the project (requires plan upgrade), or accept that no real PHI may be stored until then.
- [ ] **Test fixtures live in prod, not on a Neon branch.** `caregivers.id = 0…0002` (`test-caregiver-fixture@rayhealthevv.local`) and `clients.id = 0…0001` (TEST-Lok TEST-Ghimeray, 225 National Dr, Pittsburgh) are in the prod default branch. Plus `1` visit_template, `1` assignment, `2` evv_visits attached to them. Decision needed:
  1. **Recommended:** Move to a Neon branch named `app-store-screenshots`, delete from default branch, and have the runbook target the branch URL for screenshot capture.
  2. Alternative: Keep in prod, gate UI by `email LIKE '%@rayhealthevv.local'` so they never appear in production reports.
  Either way: write a checked-in, idempotent seed script (`packages/core/scripts/seed-app-store-fixture.ts`) that refuses to run when `DATABASE_URL` lacks the `branch=` parameter or contains the prod hostname, so this never happens ad hoc again.

### HIGH — should close before App Store submission

- [ ] **App icon.** Current iOS/Android `AppIcon` set is the auto-generated RayHealth-blue placeholder. Apple App Store will reject placeholder/template icons. Owner action: send brief to a designer (Fiverr / 99designs / agency contact). Spec: 1024×1024 PNG master, no alpha, no rounded corners (Apple applies the mask).
- [ ] **DashboardScreen visit cards** still render from `/evv/visits` recent history rather than today's schedule. Should use the same `getTodaysSchedule()` data the Schedule tab already uses, with countdown and patient name. Tracked as the next chunk in the in-flight refactor.
- [ ] **VisitDetailScreen / CorrectionScreen / NotificationScreen** clickability audit. User reported "alot of the section doesnt work or just goes blank when you click." Schedule + Learning are now fixed; these three still need the same pass.
- [ ] **Profile sub-options** audit (taps that go nowhere). Same root cause.

### MED — close before scaling beyond pilot agency

- [ ] **Aggregator submission (Sandata / PROMISe export)** is not implemented. EVV records cannot be transmitted to PA DHS yet. This is fine for a private pilot but blocks any agency that needs MA billing.
- [ ] **Offline visit queue** not tested. The mobile app currently fails silently if the caregiver clocks in/out without network. Add IndexedDB (or SQLite via Capacitor) queue + retry on reconnect.
- [ ] **Audit retention job.** `audit_events` is append-only by trigger but has no retention/archival job. Per `docs/compliance/hipaa/DATA_RETENTION.md` we keep 6 years; today the table just grows.

## Owner action — not blockable by code

- [ ] **BAAs to execute** before any real PHI processed:
  - [ ] AWS (Bedrock) — `aws-baa@amazon.com`. We are using Claude Haiku 3.5 under Bedrock; AWS BAA covers this when signed.
  - [ ] Neon — request via Neon support after HIPAA-mode upgrade.
  - [ ] Vercel — Enterprise plan required for BAA. If staying on Pro, must move backend off Vercel for any PHI route.
  - [ ] Firebase (push notifications) — only stores device tokens, not PHI. Sign BAA via Google Cloud BAA flow if push payloads ever include PHI; today they don't.
  - [ ] Resend (transactional email) — sign BAA if any email content can include PHI. Today emails are auth-only (verification codes, invites) — review whether BAA is required.
  - See `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` for templates.
- [ ] **Cyber liability insurance** with HIPAA-breach rider. Most pilot agencies will ask for the certificate.
- [ ] **Annual security risk analysis** (HIPAA Security Rule §164.308(a)(1)(ii)(A)). Initial pass exists in `docs/compliance/hipaa/SECURITY_POLICY.md`; needs a dated, signed version on file.
- [ ] **Penetration test.** External pen test report is what most agency procurement teams ask for. Budget ~$8–15k for a one-week engagement.

## Stretch — nice to have at launch

- [ ] **CodeQL / Dependabot** GitHub Advanced Security on the repos.
- [ ] **Playwright e2e in CI** for the caregiver clock-in/out flow.
- [ ] **Status page** (`status.rayhealthevv.com`) with Better Stack or Statuspage.io.

---

## Quick reference — App Store fixture credentials

For App Store screenshots and end-to-end validation only. Synthetic — no real PHI.

| Field | Value |
|---|---|
| Caregiver email | `test-caregiver-fixture@rayhealthevv.local` |
| Caregiver password | `TestCaregiver2026!` |
| Caregiver UUID | `00000000-0000-4000-8000-000000000002` |
| Client UUID | `00000000-0000-4000-8000-000000000001` |
| Client address | 225 National Dr, Pittsburgh PA 15235 |
| Client geofence radius | 150 m |

Move these to a Neon branch before public launch (see CRIT items above).
