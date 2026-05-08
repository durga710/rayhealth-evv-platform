# RayHealth EVV — Production Deploy Runbook

This document is the canonical, ordered checklist for going live. Every step
is reversible until step 9 (delete old repo). Do **not** skip the schema
migration — the new code requires the new tables and trigger functions and
will throw on every login otherwise.

---

## 0. Preconditions

You should have:

- Repo: `https://github.com/durga710/rayhealth-evv-platform` on `main`,
  green `./scripts/check.sh`.
- A Postgres 14+ instance the API can write to (Neon, Supabase, RDS, Crunchy,
  etc.). If you have not provisioned one yet, do that now.
- Vercel CLI authenticated (`vercel login`) OR access to the Vercel dashboard
  for the relevant team.
- Access to the upstream consoles for every secret listed in `.env.example`
  (Firebase, AWS Bedrock, Resend, Stripe, Gemini, OpenAI, Google Identity
  Platform).
- Generate a fresh 32-byte hex string for every app-side secret with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## 1. Rotate every secret that was in the old repo

The old repo (`durga710/rayhealth-evv`) had `.env` and `.env.production`
committed in history. Treat every value as compromised. In each upstream
console, rotate / regenerate:

- **Postgres**: new password, or new connection string entirely.
- **Firebase**: revoke and reissue the service account private key, rotate
  the API key.
- **AWS Bedrock**: rotate the bearer token.
- **Stripe**: rotate the secret key.
- **Resend**: rotate the API key.
- **Gemini / OpenAI**: rotate keys.
- **Google Identity Platform**: rotate OAuth client secret if applicable.
- **JWT_SECRET / JWT_REFRESH_SECRET / SESSION_SECRET / CSRF_SECRET /
  ENCRYPTION_KEY**: regenerate from the helper above.
- **BOOTSTRAP_SECRET**: regenerate from the helper above (used once, then
  deleted in step 6).

Do **not** copy the old `.env.production` values; that is exactly the file
that leaked.

## 2. Connect Vercel to the new repo

1. Vercel dashboard → New Project → Import `durga710/rayhealth-evv-platform`.
2. Framework preset: `Other` (we use `vercel.json`).
3. Root Directory: leave blank — the new repo's tree is flat at the root.
4. Build & Output Settings: defer to `vercel.json`.
5. **Do not deploy yet** — finish step 3 first.

## 3. Configure Vercel environment variables

Project → Settings → Environment Variables. For **Production** scope, paste
every key from `.env.example` (no comments, no example values). At minimum:

- `DATABASE_URL` — the rotated Postgres connection string.
- `JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` — 64-char
  hex (32 bytes) each.
- `BOOTSTRAP_SECRET` — set ONLY for the first admin bootstrap, then delete
  this row from Vercel after step 6.
- `CORS_ORIGIN` / `ALLOWED_ORIGINS` — your prod web origin (e.g.
  `https://app.rayhealthevv.com`).
- All Firebase, AWS, Stripe, Resend, etc. keys you rotated in step 1.
- `NODE_ENV=production`.

For **Preview** scope, set the same keys but pointed at a non-prod Postgres
branch / project.

## 4. Apply the schema migration to production Postgres

This step creates `sessions`, `audit_events`, `mobile_sessions`,
`family_relationships`, the timestamptz conversion, the immutability
trigger on `evv_visits`, the append-only trigger on `audit_events`, and
all CHECK constraints.

```bash
git clone https://github.com/durga710/rayhealth-evv-platform
cd rayhealth-evv-platform
npm install
DATABASE_URL='<PROD_URL>' npm run db:migrate
```

Expected output: `Migrations complete.` All migration blocks are idempotent;
re-running is safe.

If the migration fails, capture the error before any retry. The most likely
failure is a CHECK constraint refusing existing data — clean the offending
rows and re-run.

**Take a Postgres backup before running this step.** The cleanest rollback
is restoring from PITR.

## 5. Trigger the first Vercel deploy

Push to `main` (or click **Deploy** in the Vercel dashboard for the imported
project). Wait for the build to finish.

The deployed function reads env from step 3. Expect cold start to fail with
`JWT_SECRET env var must be set before starting` if any required secret is
missing — that is the deliberate startup guard, not a bug.

## 6. Bootstrap the first admin

Once `/api` is reachable:

```bash
curl -X POST "https://<your-prod-host>/api/auth/bootstrap" \
  -H 'Content-Type: application/json' \
  -H "x-bootstrap-secret: $BOOTSTRAP_SECRET" \
  -d '{
    "agencyId": "<a fresh uuid v4>",
    "email": "you@example.com",
    "password": "<≥12-char password>"
  }'
```

Expected: `201 Created` with `{ token, role: 'admin', agencyId }`.

After this succeeds, **immediately delete `BOOTSTRAP_SECRET`** from Vercel
project env. The endpoint then returns 403 Forbidden permanently.

## 7. Smoke test

Hit the new prod URL with:

- `POST /api/auth/login` (web) → expect `Set-Cookie: rayhealth_session=...; HttpOnly; Secure; SameSite=Strict` plus `csrfToken` in the body.
- `GET /api/clients` with no auth → `401`.
- `POST /api/clients` with cookie auth but no `x-csrf-token` → `403 Invalid CSRF token`.
- `POST /api/auth/mobile/login` → `{ token }`. Decode the JWT — confirm a
  `jti` claim is present.
- `POST /api/auth/mobile/logout` with that bearer → `204`. A second request
  with the same bearer → `401`.
- `GET /api/evv/visits` from a caregiver bearer → only that caregiver's visits.
- `GET /api/evv/visits` from a coordinator bearer → all of THIS agency's
  visits, none from other agencies' caregivers.
- Inspect `audit_events` — every PHI GET / write produced a row, every row
  has the resource UUID in `entity_id`, server-generated `correlation_id`,
  no caller-supplied values.
- Try `UPDATE audit_events SET outcome='success' WHERE id='...'` from psql
  — must throw `audit_events is append-only`.
- Try updating an `evv_visits.clock_in_time` directly — must throw
  `evv_visits is immutable; corrections must go through visit_maintenance`.

## 8. Mobile release

The mobile app was hardened in Phase 1 (expo-secure-store) and the
`/mobile/login` flow now embeds a `jti`. To ship:

```bash
cd packages/mobile
npx eas build --platform ios   # and android
```

Submit via EAS Submit or App Store Connect / Google Play Console as usual.
TestFlight first; promote when smoke tests pass.

## 9. Decommission the old repo

Only after steps 1–8 pass:

1. GitHub → `durga710/rayhealth-evv` → Settings → scroll to bottom →
   **Delete this repository**. Type the repo name to confirm.
2. Anyone with a clone of the old repo retains the leaked secrets in
   their local history — but those values were rotated in step 1, so
   they are now dead.

## Rollback

| Stage | Rollback action |
|---|---|
| Bad app code | `git revert HEAD && git push` on `rayhealth-evv-platform` — Vercel auto-deploys the revert. |
| Bad migration | All migration blocks are forward-idempotent; reverse requires manual SQL or restoring from a Postgres point-in-time backup. Take a backup BEFORE running step 4. |
| Compromised env | Rotate the affected secret in the upstream console, update Vercel env, redeploy. The new value takes effect on the next cold start. |

## Audit-trail expectations after deploy

Confirm in `audit_events`:

- Every `POST /clients`, `PATCH /clients/:id`, `POST /assignments`,
  `POST /evv/clock-in`, etc. produced a row with the right `event_type`
  (`phi.create` / `phi.update` / `phi.delete` / `request.write`).
- Every `GET /clients`, `/evv/visits`, `/assignments`, `/authorizations`,
  `/templates`, `/staff`, `/maintenance` produced a `phi.read` row.
- `entity_id` is the resource UUID, not the actor.
- `correlation_id` is a UUID v4 (server-generated). No caller-supplied
  `x-request-id` should make it through.
- Login / logout produced `auth.login.success` and `session.revoked`.
