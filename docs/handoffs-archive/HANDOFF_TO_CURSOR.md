# Handoff to Cursor — RayHealth EVV

**Prepared:** 2026-05-11
**Outgoing agent:** Claude (Anthropic) in Cowork mode
**Workspace path:** `/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh`
**Owner:** Durga Ghimeray (`durga@rayhealthevv.com` / `reyghim1093@gmail.com`)

Read this first. Then read `PROJECT_STATUS.md`, then `NEXT_STEPS.md`, then anything the owner is actively asking about. Don't write new code without scanning the existing repo — most things you'd think to build already exist.

---

## 1. The single most important thing to know

**There are three repos and they are not aligned.**

| Location | Status | Contents |
|---|---|---|
| `/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh` | Working tree on Durga's Mac. **Git root is `$HOME`** — the entire home directory is one giant repo. | All session work — Learning Hub, AI Copilot, invite flow, migrations, etc. |
| `bitbucket.org:rayhealthevv/rayhealthevv` (via `/tmp/rayhealth-combined` on Durga's Mac) | Where the sync scripts push. SSH key wired. Has session 1–4 work + mobile subtree. | Canonical for the new work. |
| `github.com/durga710/rayhealth-evv-platform` | What **Vercel actually deploys from** (production at `rayhealthevv.com`). | Older code — does **not** have the session work. |

**The fix in progress when this handoff was written:** disconnect Vercel from GitHub, reconnect to Bitbucket. Steps are in §6 below. Until that flip happens, production keeps redeploying the old GitHub code regardless of what we push to Bitbucket.

Engineering directive said "GitBucket (self-hosted)" — neither Bitbucket Cloud nor GitHub matches that literally. Treat the directive's GitBucket as aspirational for now; current operational reality is Bitbucket + GitHub.

---

## 2. What works right now (production)

- `rayhealthevv.com` is live
- Backend `/auth/mobile/login` returns `firstName`/`lastName`
- `/auth/mobile/me` for session refresh
- `/api/support/chat` (Claude Haiku 3.5 via AWS Bedrock — BAA active)
- Capacitor mobile clock-in/out with 150m geofence (PA spec is 100m — see §4)
- Web cookie sessions + CSRF + HttpOnly
- Audit-events persistence with append-only trigger
- Existing invite UI shows "Copy link" fallback (because RESEND_API_KEY isn't set in Vercel)

---

## 3. What's been built this session but NOT yet on production

Everything in the table below lives in `packages/*` on Durga's Desktop, has been pushed to Bitbucket, has NOT been deployed.

| Surface | Files |
|---|---|
| **Learning Hub** coordinator dashboard | `packages/web/src/features/learning/LearningDashboardPage.tsx` + `InsightsPanel.tsx` |
| **Course catalog** | `packages/web/src/features/learning/CourseCatalogPage.tsx` |
| **Per-caregiver detail** | `packages/web/src/features/learning/CaregiverLearningPage.tsx` |
| **Course analytics** | `packages/web/src/features/learning/LearningAnalyticsPage.tsx` |
| **Course drill-down** | `packages/web/src/features/learning/CourseDetailPage.tsx` |
| **AI Copilot chat** | `packages/web/src/features/learning/CopilotChatPage.tsx` |
| **Agency settings** (AI flag toggle, notifications) | `packages/web/src/features/agency/AgencySettingsPage.tsx` |
| **Real invite flow** with email send + access code + magic-link | `packages/app/src/routes/invite-routes.ts` (replaces a stub that returned a fake object) |
| **Public invite-acceptance API** (`GET`/`POST /invites/accept/:token`) | `packages/app/src/routes/invite-acceptance-routes.ts` + 13 tests |
| **Caregiver acceptance page** (`/accept/:token`) | `packages/web/src/features/auth/AcceptInvitePage.tsx` |
| **Agency EVV aggregator config** (migration + domain + repo + GET/PUT API + UI) | `packages/core/src/migrations/2026-05-11-add-agency-evv-config.ts`, `packages/core/src/domain/agency-evv-config.ts`, `packages/core/src/repositories/agency-evv-config-repository.ts`, `packages/app/src/routes/agency-routes.ts` (extended), `packages/web/src/features/agency/AgencySettingsPage.tsx` (new `EvvAggregatorSection`) — 15 new tests |
| **Copilot context injection** (per-request caregiver/course UUID blob for typed-action proposals) | `packages/app/src/services/copilot-context.ts` + `packages/app/src/routes/copilot-routes.ts` (extended) — 8 new tests |
| **VMUR workflow upgrade** (PA DHS reason codes + correction codes + signature handling + caregiver-self-filed corrections + coordinator review queue) | `packages/core/src/migrations/2026-05-11-extend-visit-maintenance.ts`, `packages/core/src/domain/visit-maintenance.ts` (rewritten), `packages/core/src/repositories/visit-maintenance-repository.ts` (rewritten), `packages/app/src/routes/maintenance-routes.ts` (rewritten) — 20 new tests |
| **Real /api/staff** returning caregivers | `packages/app/src/routes/staff-routes.ts` |
| **Compliance gate on assignments** (422 + override flow) | `packages/app/src/routes/assignment-routes.ts` |
| **Audit retention sweep** | `packages/app/src/services/audit-retention-sweep.ts` + routes + cron |
| **Sandata aggregator** | `packages/core/src/services/sandata-mapping.ts` |
| **HHAeXchange aggregator** (parallel) | `packages/core/src/services/hhaexchange-mapping.ts` |
| **AI Copilot backend** with Gemini integration | `packages/app/src/routes/copilot-routes.ts` + `packages/app/src/services/gemini-client.ts` |
| **Copilot action runner** (typed executors) | `packages/app/src/services/copilot-action-executor.ts` + `packages/core/src/domain/copilot-actions.ts` |
| **Email client** (Resend wrapper) | `packages/app/src/services/email-client.ts` |
| **State registry** (PA, NJ — 50-states ready) | `packages/core/src/config/states/` |
| **7 migrations** dated 2026-05-11 | `packages/core/src/migrations/2026-05-11-*.ts` (incl. `add-agency-evv-config`, `extend-visit-maintenance`) |
| **Mobile-capacitor Learning screens** (speculative) | `packages/mobile-capacitor/src/features/learning/` |
| **Audit event taxonomy** with 14+ new event types incl. `invite.access_code_failed`, `agency.evv-config.changed` | `packages/core/src/domain/audit.ts` |
| **Marketing video pipeline** (ElevenLabs + Veo3) | `marketing/` |
| **App Store icon master** (1024×1024 + sizes) | `deliverables/app-icon/` |
| **Annual HIPAA risk analysis** | `docs/compliance/hipaa/RISK_ANALYSIS_2026.md` |
| **BAA email templates** | `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` |
| **Sandata onboarding runbook** | `docs/sandata-onboarding.md` |
| **Vercel deploy install fix** | `vercel.json` |
| **Playwright screenshot capture** | `scripts/capture-screenshots.ts` |
| **Deploy automation** | `scripts/deploy.sh` |

**150 tests passing** across the workspaces (59 core / 86 app / 5 web). Lint clean. Typecheck clean. Security surface scan clean. `vercel.json` install fix verified locally.

---

## 4. Engineering directive (must read)

Durga issued a directive earlier this session. Key constraints:

| | |
|---|---|
| **Source control** | "GitBucket (self-hosted)" — aspirational. Today: Bitbucket Cloud (where all session work lives) + GitHub (Vercel-watched). See §1 + §6 |
| **Branching** | `feature/* → develop → preview → production`. Today: all pushes go to `main`. **Sync scripts need updating** once `develop` exists on Bitbucket |
| **CI required green** | `lint`, `typecheck`, `test`, `build`, `security:scan` — all zero warnings. **`scripts/check.sh` runs them all** |
| **ESM strict** | `import` with `.js` extensions, never `require()`, Node 22.x, `.mts` for serverless entrypoints (not yet implemented — see §7 #3) |
| **Compliance** | HIPAA Security Rule, HIPAA Privacy Rule, 21st Century Cures EVV, Medicaid EVV mandates. **Owner has deferred operational HIPAA work to "last stage"** (Neon HIPAA mode, BAAs, signed risk analysis, pen test) — the **architectural** HIPAA work is in place (audit logging, RBAC, encrypted secure storage, cookie sessions) |
| **PA specifics** | 100m geofence (currently 150m in fixture — **fixed**), VMUR correction workflows, HHAeXchange aggregator (now parallel to Sandata) |
| **Future** | "50 U.S. states soon" — state registry pattern in `packages/core/src/config/states/` is ready for this |
| **Mobile** | Mobile-first, offline-capable. Production app is Capacitor at separate `rayhealth-evv-mobile` repo, subtree-added into Bitbucket combined repo |
| **Agent posture** | "Principal engineer, Compliance architect, Healthcare systems expert, Security engineer, Product strategist" — do not act as passive code generator. Challenge unsafe implementations, surface gaps proactively |

---

## 5. Security posture / credential hygiene

**Critical pattern Durga has had trouble with:** he has pasted **four** credentials into chat over this session (Atlassian API token, Bitbucket app password, two Google API keys). All four were rotated/revoked, but the pattern is dangerous.

**Default behavior:**
- Never accept a credential pasted in chat. If one arrives, **immediately** flag it as compromised, instruct him to revoke at the provider dashboard, then walk through the safe alternative (env var, SSH key, keychain helper).
- Public keys (`.pub` files) are safe to share. Private keys, API tokens, app passwords, OAuth tokens are not.
- If a credential ends up in `~/.zsh_history`, clean it with `sed -i.bak '/<value>/d' ~/.zsh_history` then `unset HISTFILE` before exiting the shell.

**SSH keys currently set up on Durga's Mac:**
- `~/.ssh/bitbucket_rayhealth` — wired for Bitbucket pushes via `~/.ssh/config`
- (GitHub SSH key was being set up when this handoff was written — see §6 for next step)

**Resend BAA** is open. The invite flow uses `RESEND_API_KEY` env var; gracefully degrades to copy-link if not set. Don't enable email delivery for real caregiver invites until the Resend BAA is signed (templates in `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md`).

---

## 6. THE IMMEDIATE NEXT STEP — Vercel ↔ Bitbucket switch

This is the only thing blocking everything else. **All my code is on Bitbucket but Vercel deploys from GitHub.** Until Vercel is reconnected to Bitbucket, every deploy is a no-op redeploy of the GitHub commit `98d81d8` (older code).

The owner has decided: "WHY DON'T WE JUST MOVE EVERYTHING TO GITBUCKET" — i.e. switch Vercel's Git source from GitHub to Bitbucket.

**Steps (run in Vercel dashboard, not terminal):**

1. https://vercel.com/dashboard → click the RayHealth project → **Settings** → **Git**
2. **Disconnect** from `github.com/durga710/rayhealth-evv-platform`
3. **Connect Git Repository** → Bitbucket → authorize → pick `rayhealthevv/rayhealthevv`
4. Production branch: `main`
5. Leave Build/Output at defaults — `vercel.json` in the repo root takes over
6. Trigger a redeploy from Deployments → Redeploy on the latest `main` commit

**Before that first Bitbucket-sourced deploy, set the env vars** in Vercel Production scope:

```
RESEND_API_KEY=re_...                                       # from https://resend.com/api-keys
RESEND_FROM_ADDRESS=RayHealth EVV <noreply@send.rayhealthevv.com>
RESEND_REPLY_TO=durga@rayhealthevv.com
DATABASE_URL=postgres://...                                 # Neon connection string
JWT_SECRET=<existing>                                       # probably already set; verify after disconnect
ALLOWED_ORIGINS=https://rayhealthevv.com,capacitor://localhost
GOOGLE_AI_API_KEY=AIza...                                   # only if enabling AI Copilot
CRON_SECRET=$(openssl rand -hex 32)                         # for audit retention cron
APP_BASE_URL=https://rayhealthevv.com                       # used in invite acceptance links
```

**Also: verify the sender domain `send.rayhealthevv.com` at https://resend.com/domains** before any invite emails will deliver.

**After the first Bitbucket-sourced deploy lands**, apply the migrations:

```bash
cd /tmp/rayhealth-combined
DATABASE_URL='postgres://...' npx tsx packages/core/scripts/apply-new-migrations.ts
```

That creates `learning_courses`, `course_enrollments`, `course_completions`, `agency_sandata_config`, `audit_events_archive`, `audit_retention_runs`, `agencies.features` column, plus the new `staff_invites` columns (`access_code`, `token`, `accepted_at`, etc.).

---

## 7. Open work in priority order

After the Vercel-Bitbucket switch lands, these are the next things to ship. Listed from highest leverage to lowest.

### Tier 1 — Owner-action items (Cursor can't do these)
- Sign + countersign `docs/compliance/hipaa/RISK_ANALYSIS_2026.md`
- Send the 4 BAA emails from `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md`
- Enable HIPAA mode on Neon project `late-art-87716813`
- Engage HIPAA-aware pen test firm
- Bind cyber-liability insurance
- Replace placeholder app icon in the mobile repo's `AppIcon.appiconset/` with files from `deliverables/app-icon/`

### Tier 2 — Code paths needing engineering work
1. **Caregiver acceptance flow** — **DONE on web side as of 2026-05-11.**
   - Backend: `packages/app/src/routes/invite-acceptance-routes.ts` provides public `GET /api/invites/accept/:token` (returns sanitized invite info — no token/access_code/id leakage) and `POST /api/invites/accept/:token` (validates access code, creates caregiver + user records, marks invite accepted, returns a bearer token). Mounted before `authContext` in `app.ts` so the routes are reachable without a session. Access-code comparison is case- and dash-insensitive; failed attempts emit a new audit event `invite.access_code_failed`. Passwords hashed with bcrypt cost 12. Already-accepted/revoked/expired invites return 409/410. 13 vitest tests in `__tests__/invite-acceptance-routes.test.ts`, all green.
   - Web: `packages/web/src/features/auth/AcceptInvitePage.tsx` mounted at `/accept/:token` in `App.tsx`. Pulls invite info, validates the access code + password + name client-side, posts to the new endpoint, stashes the returned bearer token in localStorage for mobile/web pickup, then redirects to `/login`. Surfaces the right error UX for expired/revoked/already-used invites.
   - **Still TODO on mobile side:** the Capacitor app at `packages/mobile-capacitor/` does NOT yet consume the token — caregivers who tap the link on their phone open the web page in their browser instead of being deep-linked into the app. Mobile-team work (Google AI is building iOS/Android per the user prefs).
2. **Agency EVV config persistence** — **DONE as of 2026-05-11.**
   - Migration: `packages/core/src/migrations/2026-05-11-add-agency-evv-config.ts` creates `agency_evv_config` (agency_id PK, aggregator, state_code, production_ready). Wired into `apply-new-migrations.ts`.
   - Domain + repo: `packages/core/src/domain/agency-evv-config.ts` (Zod schema) + `packages/core/src/repositories/agency-evv-config-repository.ts` (`findOrInitialize` returns state default when no row, `resolve()` honours `aggregatorChoice` so NJ can't be talked into Sandata even if the column says so). 7 vitest tests.
   - API: `GET /agencies/me/evv-config` returns the config decorated with `choiceAvailable` + `stateDefaultAggregator`. `PUT /agencies/me/evv-config` validates against the state registry, refuses `productionReady=true` until `agency_sandata_config.provider_id` is populated and `enabled=true`, audits `agency.evv-config.changed`. 8 vitest tests.
   - UI: new `EvvAggregatorSection` in `AgencySettingsPage.tsx` — radio picker (Sandata / HHAeXchange / Not configured), production-ready checkbox, disables for non-admins and for forced-aggregator states, surfaces backend 422s.
   - **Still TODO (low priority):** mirror `agency_sandata_config` with `agency_hhaexchange_config` for HHAeXchange-specific mappings (Tax ID, Employee IDs, service codes). Until that lands, NJ agencies can't actually generate an HHAeXchange submission file even with this picker set correctly.
3. **`.mts` for serverless entry points** — directive requires this; not yet implemented. Currently the Vercel functions are built from `packages/app`. Would need restructuring if you want top-level `api/*.mts` Vercel-conventional layout
4. **VMUR correction workflow audit** — **DONE as of 2026-05-11.**
   - Migration `2026-05-11-extend-visit-maintenance.ts` adds the PA DHS VMUR-required columns: `reason_category_code`, `correction_code`, `originator_role`, `caregiver_signature_present`, `client_signature_present`, `incomplete_signature_reason`, `approver_id`, `approved_at`, `agency_id`.
   - Domain `visit-maintenance.ts` now exports `visitMaintenanceReasonCodes` (MTLB, DCDB, MFLB, MFLA, ACLN, ATGL, AGRS, WKAP, CNCL, HOLI, WKLI, OTHR) and `visitMaintenanceCorrectionCodes` (TIME_CHANGE, CAREGIVER_CHANGE, CLIENT_CHANGE, TASK_CHANGE, VISIT_ADDED, VISIT_CANCELED, VISIT_VERIFIED, OTHER). Zod refinements enforce: (a) reason text required when category is OTHR; (b) `incompleteSignatureReason` required when either signature is absent. 10 schema tests.
   - Repository rewritten to read/write all new columns plus `rejectUnlock`, `findById`, `listPendingForAgency`, `listForVisit`. `approveUnlock` signature changed to take `{approverId, adjustedStartTime, adjustedEndTime}` instead of the old two-arg shape.
   - Routes (`packages/app/src/routes/maintenance-routes.ts`) rewritten: `POST /maintenance/caregiver-correction` (caregiver-self-filed, originator stamped as `caregiver`, always pending — feeds the coordinator review queue per user prefs), `POST /maintenance/reject-unlock/:id`, `GET /maintenance/queue`, `GET /maintenance/visit/:visitId`. All inputs validated against the new schema. Audit events `exception.filed` and `exception.approved` written. 10 route tests.
   - **Reference caveat:** the reason-code list is the most commonly-cited PA DHS / Sandata set, but Sandata revises the live list periodically. Verify against the current Provider Spec before first production submission.
5. **EMR checks** before clock-in — not implemented. Needs design decision on which EMR provider(s) to integrate
6. **AI Copilot context injection** — **DONE as of 2026-05-11.**
   - `packages/app/src/services/copilot-context.ts` builds a per-request blob of `{caregivers:[{id,name,status}], courses:[{id,code,title,required}]}` and renders it as a fenced JSON block prepended to the user prompt before it hits Gemini. 8 vitest tests.
   - Role-scoped: admin/coordinator get up to 50 active caregivers + the full course catalog. Caregiver role sees only their own record (verified by test — other UUIDs do not leak into the blob). Family role gets an empty blob — they only see visits for a specific authorized client, which is a different query path.
   - Wired into `copilot-routes.ts` `POST /copilot/ask`: builds context → prepends to prompt → adds `contextSize` (counts only, not UUIDs) to the `copilot.query` audit payload. Repo failures degrade to an empty blob — the model still answers, it just can't propose typed actions.
   - Admin SYSTEM_PROMPT updated to tell the model "use these exact UUIDs in PROPOSE_ACTION_DATA" and how to match free-text names to entries in the blob.
   - **Net effect:** `proposedActionData` on the `/copilot/ask` response should now populate routinely for owner-facing prompts like "enroll Maria in HIPAA-2026" — wiring the `POST /copilot/execute` confirm path becomes a UI question, not a backend one.

### Tier 3 — Mobile integration
The `packages/mobile-capacitor/src/features/learning/` Learning Hub screens are speculative — they need wiring into the real Capacitor app's router, auth hook, env vars (5 integration points in `packages/mobile-capacitor/src/features/learning/README.md`). The combined Bitbucket repo has the production mobile app under `packages/mobile-capacitor/` (subtree-added from `~/Documents/rayhealth-evv-mobile`).

### Tier 4 — DevOps cleanup
- Once the Vercel switch lands, ALSO add `develop` and `preview` branches to Bitbucket and update sync scripts to push there per the directive's branching strategy
- Consider migrating from `$HOME`-as-git-root to a per-project repo (use `scripts/extract-to-standalone-repo.sh` — already exists)
- Delete the GitHub `rayhealth-evv-platform` repo once Bitbucket is canonical

---

## 8. File map (where the important things live)

```
rayhealth-fresh/
├── PROJECT_STATUS.md               ← single source of truth, read first
├── NEXT_STEPS.md                   ← tiered playbook (Tier 1-5)
├── HANDOFF_TO_CURSOR.md            ← this file
├── vercel.json                     ← deploy config (npm ci --workspace fix)
├── package.json                    ← turbo monorepo root
├── docs/
│   ├── compliance/hipaa/
│   │   ├── RISK_ANALYSIS_2026.md   ← 15-risk register, awaiting signature
│   │   ├── BAA_REQUEST_EMAILS.md   ← pre-filled BAA outreach templates
│   │   ├── SECURITY_POLICY.md
│   │   ├── INCIDENT_RESPONSE.md
│   │   ├── DATA_RETENTION.md
│   │   └── ENCRYPTION_VERIFICATION.md
│   └── sandata-onboarding.md       ← first-agency runbook
├── packages/
│   ├── core/                       ← shared domain, repositories, migrations
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── pennsylvania.ts ← legacy PA constants (kept for back-compat)
│   │   │   │   └── states/         ← new state registry (PA, NJ, extensible)
│   │   │   ├── domain/             ← Zod-validated entity schemas
│   │   │   ├── migrations/         ← schema.ts + 5 dated migrations
│   │   │   ├── repositories/       ← Knex-backed repos
│   │   │   ├── services/           ← business logic (sandata, hhaexchange, audit-retention)
│   │   │   └── __tests__/          ← 42 vitest tests
│   │   └── scripts/                ← seed-app-store-fixture, apply-new-migrations, seed-learning-catalog
│   ├── app/                        ← Express backend
│   │   ├── src/
│   │   │   ├── routes/             ← REST endpoints
│   │   │   ├── services/           ← gemini-client, email-client, copilot-action-executor
│   │   │   ├── middleware/         ← auth-context, require-capability, audit-log, csrf
│   │   │   ├── security/
│   │   │   └── __tests__/          ← 47 vitest tests
│   ├── web/                        ← React + Vite admin UI
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── agency/         ← AgencySetupPage, AgencySettingsPage
│   │   │   │   ├── auth/
│   │   │   │   ├── clients/
│   │   │   │   ├── evv/            ← VisitReviewPage
│   │   │   │   ├── landing/
│   │   │   │   ├── learning/       ← 6 pages: Dashboard, Catalog, Caregiver detail, Analytics, Course detail, Copilot chat + Insights panel + Enroll modal + AI Copilot panel
│   │   │   │   ├── scheduling/     ← AssignmentsPage (with compliance gate + pickers)
│   │   │   │   └── staff/          ← StaffPage (new invite UI with email-sent badge)
│   │   │   └── lib/
│   │   │       └── api-client.ts   ← HttpError class, getJson, postJson
│   ├── mobile/                     ← OLD Expo placeholder — not deployed
│   └── mobile-capacitor/           ← Capacitor app (subtree-added from rayhealth-evv-mobile)
│       └── src/features/learning/  ← speculative Learning Hub screens, integration-ready
├── marketing/                      ← video production pipeline
│   ├── scripts/                    ← 6 spot scripts (Hero, Owner, Caregiver, Family, Compliance, Bumper)
│   ├── pipeline/
│   │   ├── generate_vo.py          ← ElevenLabs
│   │   ├── generate_clips.py       ← Seedance via fal.ai
│   │   └── generate_clips_veo3.py  ← Veo 3 via Gemini API
│   └── README.md                   ← DaVinci Resolve assembly runbook
├── deliverables/
│   └── app-icon/                   ← 1024x1024 master + iOS/Android sizes
└── scripts/                        ← automation
    ├── deploy.sh                   ← unified deploy walker (sync → migrate → vercel)
    ├── recover-and-push.sh         ← initial Bitbucket sync
    ├── sync-session2-to-bitbucket.sh
    ├── sync-session3-to-bitbucket.sh
    ├── sync-session4-to-bitbucket.sh
    ├── combine-mobile-into-bitbucket.sh   ← already run once
    ├── extract-to-standalone-repo.sh      ← already run once
    ├── capture-screenshots.ts             ← Playwright per directive
    ├── check.sh                           ← runs lint+typecheck+test+build+security
    └── security-surface-scan.ts           ← regression check for token-storage anti-patterns
```

---

## 9. Test fixture credentials (synthetic — safe to use)

These are seeded by `packages/core/scripts/seed-app-store-fixture.ts`. They live in the production Neon default branch right now (a CRIT item — should be moved to a Neon branch named `app-store-screenshots`).

| Field | Value |
|---|---|
| Caregiver email | `test-caregiver-fixture@rayhealthevv.local` |
| Caregiver password | `TestCaregiver2026!` |
| Caregiver UUID | `00000000-0000-4000-8000-000000000002` |
| Caregiver user UUID | `00000000-0000-4000-8000-000000000003` |
| Client UUID | `00000000-0000-4000-8000-000000000001` |
| Client address | 225 National Dr, Pittsburgh PA 15235 |
| Geofence radius | **100 m** (PA spec — fixture was just updated from 150m) |
| Agency UUID | `e1c4a7e3-1cad-4001-8e0a-000000000001` |

---

## 10. Bitbucket repo state (as of this handoff)

- Repo: `bitbucket.org:rayhealthevv/rayhealthevv.git`
- Branch: `main` (the only branch — `develop`/`preview`/`production` per directive don't exist yet)
- Has the platform monorepo + mobile-capacitor subtree + all session work
- 4 sync scripts have committed everything from sessions 1–4
- SSH wired (`~/.ssh/bitbucket_rayhealth`)

If you push more work, use the same pattern as the existing sync scripts (`scripts/sync-session5-to-bitbucket.sh` etc.) — they use explicit `git add <file>` lists (never `git add .` because the working tree git root is `$HOME`).

---

## 11. Things owner is sensitive about

- **"DON'T ASK ME AGAIN"** — he's said this multiple times. Default to autonomous execution. Only ask when truly blocked (e.g. needs an env var only he has, needs an architectural decision he hasn't expressed).
- **HIPAA "later"** — he's explicitly deferred the HIPAA operational work. Architectural HIPAA is in place. Don't lecture him about it but DO refuse to onboard real PHI before BAAs are signed.
- **Wants to test with "raw data"** — interpret as his own dogfooding data (his own email, his own test caregivers), not third-party PHI.
- **No multi-step questions when one will do.** Pick the highest-leverage clarifying question, ask only that.

---

## 12. Three commands the owner will likely give Cursor

| Owner says | What they mean |
|---|---|
| "keep going" | Continue from the most recent in-progress task. Pick the next Tier 2 item in §7 if nothing's pending. |
| "deploy" / "run it" / "ship it" | They want `scripts/deploy.sh` run (which they have to run; Cursor can't). Walk them through it if Vercel-Bitbucket switch isn't done yet. |
| "the X doesn't work" | Production is showing old code. Re-read §1 + §6 — diagnose whether the issue is unbuilt code (not yet), unpushed code (Bitbucket vs deployed GitHub), or actual bug. |

---

## 13. Closing note from outgoing agent

This project has good bones. The architecture is clean — strict ESM, Zod throughout, repository pattern, immutable audit, role-based capabilities, deterministic SQL for compliance signals (no LLM-in-the-loop where it would create audit headaches), per-state strategy registry. Tests are written for the consequential paths.

The two things slowing it down right now are operational, not architectural:

1. The split between Bitbucket (canonical) and GitHub (Vercel-watched). Solve via the §6 dashboard flip.
2. The deferred HIPAA operational work. That's the owner's call to make and his timeline is set — your job is to keep the architectural HIPAA posture strong so when he flips the switch on Neon HIPAA mode + signed BAAs, nothing in the code surprises him.

Good luck.

— Claude
