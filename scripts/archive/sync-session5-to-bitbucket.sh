#!/usr/bin/env bash
#
# sync-session5-to-bitbucket.sh
#
# Sync everything from this session — caregiver invite acceptance flow,
# agency EVV aggregator config, AI Copilot context injection, VMUR PA DHS
# upgrade with reason/correction codes + signature handling + coordinator
# review queue + tracking history, full HHAeXchange + Sandata aggregator
# admin surface with caregiver/service mapping editors, plus security
# hardening — into /tmp/rayhealth-combined and push to Bitbucket main.
#
# Idempotent. Safe to re-run.

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
TARGET="/tmp/rayhealth-combined"

if [ ! -d "$TARGET/.git" ]; then
  echo "ERROR: $TARGET is not a git repo. Run combine-mobile-into-bitbucket.sh first."
  exit 1
fi

cd "$TARGET"

echo ">>> Step 1: Fetch latest main"
git checkout main
git pull --ff-only origin main || git pull origin main

echo ""
echo ">>> Step 2: Sync from Desktop workspace"
rsync_one() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dst="$TARGET/$rel"
  if [ ! -e "$src" ]; then
    echo "    skip (missing): $rel"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  if [ -d "$src" ]; then
    rsync -a \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='.turbo' \
      --exclude='*.tsbuildinfo' \
      "$src/" "$dst/"
    echo "    dir : $rel"
  else
    cp "$src" "$dst"
    echo "    file: $rel"
  fi
}

# ---------- Core ----------

# Audit taxonomy + invite/agency-evv/visit-maintenance domains
rsync_one "packages/core/src/domain/audit.ts"
rsync_one "packages/core/src/domain/agency-evv-config.ts"
rsync_one "packages/core/src/domain/visit-maintenance.ts"

# Repositories
rsync_one "packages/core/src/repositories/agency-evv-config-repository.ts"
rsync_one "packages/core/src/repositories/agency-hhaexchange-config-repository.ts"
rsync_one "packages/core/src/repositories/agency-sandata-config-repository.ts"
rsync_one "packages/core/src/repositories/visit-maintenance-repository.ts"

# Migrations
rsync_one "packages/core/src/migrations/2026-05-11-add-agency-evv-config.ts"
rsync_one "packages/core/src/migrations/2026-05-11-extend-visit-maintenance.ts"
rsync_one "packages/core/src/migrations/2026-05-11-add-agency-hhaexchange-config.ts"

# Re-exports + migration runner registration
rsync_one "packages/core/src/index.ts"
rsync_one "packages/core/scripts/apply-new-migrations.ts"

# Core tests
rsync_one "packages/core/src/__tests__/visit-maintenance-schema.test.ts"
rsync_one "packages/core/src/__tests__/agency-evv-config-repository.test.ts"
rsync_one "packages/core/src/__tests__/agency-hhaexchange-config-repository.test.ts"
rsync_one "packages/core/src/__tests__/agency-sandata-config-repository.test.ts"
# Pre-existing test cleanup (unused eslint-disable removal)
rsync_one "packages/core/src/__tests__/audit-retention-sweep.test.ts"
rsync_one "packages/core/src/__tests__/learning-repository.test.ts"

# ---------- App ----------

# New public routes
rsync_one "packages/app/src/routes/invite-acceptance-routes.ts"
rsync_one "packages/app/src/routes/agency-hhaexchange-config-routes.ts"
rsync_one "packages/app/src/routes/agency-sandata-config-routes.ts"

# Updated routes
rsync_one "packages/app/src/routes/agency-routes.ts"
rsync_one "packages/app/src/routes/maintenance-routes.ts"
rsync_one "packages/app/src/routes/copilot-routes.ts"

# New services
rsync_one "packages/app/src/services/copilot-context.ts"

# App mount wiring
rsync_one "packages/app/src/app.ts"

# App tests
rsync_one "packages/app/src/routes/__tests__/invite-acceptance-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/agency-evv-config-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/agency-hhaexchange-config-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/agency-sandata-config-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/maintenance-routes.test.ts"
rsync_one "packages/app/src/services/__tests__/copilot-context.test.ts"

# ---------- Web ----------

# Routing + new pages
rsync_one "packages/web/src/App.tsx"
rsync_one "packages/web/src/features/auth/AcceptInvitePage.tsx"
rsync_one "packages/web/src/features/evv/VisitCorrectionsQueuePage.tsx"
rsync_one "packages/web/src/features/evv/VisitCorrectionsTrackingPage.tsx"

# Extended settings UI
rsync_one "packages/web/src/features/agency/AgencySettingsPage.tsx"

# Copilot chat comment cleanup
rsync_one "packages/web/src/features/learning/CopilotChatPage.tsx"

# Web tests
rsync_one "packages/web/src/features/evv/VisitCorrectionsQueuePage.test.tsx"
rsync_one "packages/web/src/features/evv/VisitCorrectionsTrackingPage.test.tsx"

# ---------- Scripts + docs ----------

rsync_one "scripts/security-surface-scan.ts"
rsync_one "scripts/deploy.sh"
rsync_one "scripts/sync-session5-to-bitbucket.sh"
rsync_one "PROJECT_STATUS.md"
rsync_one "HANDOFF_TO_CURSOR.md"
rsync_one "DEPLOY_NOW.md"

echo ""
echo ">>> Step 3: Stage and commit"
git add \
  packages/core/src/domain/audit.ts \
  packages/core/src/domain/agency-evv-config.ts \
  packages/core/src/domain/visit-maintenance.ts \
  packages/core/src/repositories/agency-evv-config-repository.ts \
  packages/core/src/repositories/agency-hhaexchange-config-repository.ts \
  packages/core/src/repositories/agency-sandata-config-repository.ts \
  packages/core/src/repositories/visit-maintenance-repository.ts \
  packages/core/src/migrations/2026-05-11-add-agency-evv-config.ts \
  packages/core/src/migrations/2026-05-11-extend-visit-maintenance.ts \
  packages/core/src/migrations/2026-05-11-add-agency-hhaexchange-config.ts \
  packages/core/src/index.ts \
  packages/core/scripts/apply-new-migrations.ts \
  packages/core/src/__tests__/visit-maintenance-schema.test.ts \
  packages/core/src/__tests__/agency-evv-config-repository.test.ts \
  packages/core/src/__tests__/agency-hhaexchange-config-repository.test.ts \
  packages/core/src/__tests__/agency-sandata-config-repository.test.ts \
  packages/core/src/__tests__/audit-retention-sweep.test.ts \
  packages/core/src/__tests__/learning-repository.test.ts \
  packages/app/src/routes/invite-acceptance-routes.ts \
  packages/app/src/routes/agency-hhaexchange-config-routes.ts \
  packages/app/src/routes/agency-sandata-config-routes.ts \
  packages/app/src/routes/agency-routes.ts \
  packages/app/src/routes/maintenance-routes.ts \
  packages/app/src/routes/copilot-routes.ts \
  packages/app/src/services/copilot-context.ts \
  packages/app/src/app.ts \
  packages/app/src/routes/__tests__/invite-acceptance-routes.test.ts \
  packages/app/src/routes/__tests__/agency-evv-config-routes.test.ts \
  packages/app/src/routes/__tests__/agency-hhaexchange-config-routes.test.ts \
  packages/app/src/routes/__tests__/agency-sandata-config-routes.test.ts \
  packages/app/src/routes/__tests__/maintenance-routes.test.ts \
  packages/app/src/services/__tests__/copilot-context.test.ts \
  packages/web/src/App.tsx \
  packages/web/src/features/auth/AcceptInvitePage.tsx \
  packages/web/src/features/evv/VisitCorrectionsQueuePage.tsx \
  packages/web/src/features/evv/VisitCorrectionsTrackingPage.tsx \
  packages/web/src/features/agency/AgencySettingsPage.tsx \
  packages/web/src/features/learning/CopilotChatPage.tsx \
  packages/web/src/features/evv/VisitCorrectionsQueuePage.test.tsx \
  packages/web/src/features/evv/VisitCorrectionsTrackingPage.test.tsx \
  scripts/security-surface-scan.ts \
  scripts/deploy.sh \
  scripts/sync-session5-to-bitbucket.sh \
  PROJECT_STATUS.md \
  HANDOFF_TO_CURSOR.md \
  DEPLOY_NOW.md 2>/dev/null || true

if git diff --cached --quiet; then
  echo "    Nothing staged — repo already in sync."
else
  git commit -m 'feat(session5): invite acceptance + EVV aggregator config + Copilot context injection + VMUR PA-DHS upgrade + HHAeXchange/Sandata admin surface

Caregiver invite acceptance flow:
- Public GET/POST /api/invites/accept/:token endpoints mounted before
  authContext so a logged-out caregiver can hit them.
- Access-code comparison is case- and dash-insensitive; bcrypt cost 12;
  creates caregiver + user rows in a single transaction; marks invite
  accepted; returns an 8h bearer token.
- Failed access-code attempts emit a new invite.access_code_failed
  audit event.
- Rate limit on /invites/accept/* (20/15min, skipped in tests).
- New web page at /accept/:token. Surfaces expired / revoked /
  already-used cases with distinct UX.
- 13 backend tests + lint/typecheck clean.

Agency EVV aggregator config:
- New agency_evv_config table + repo + GET/PUT /agencies/me/evv-config.
- Resolver honours state-registry aggregatorChoice (NJ → forced
  HHAeXchange, PA → caller choice).
- Production-ready toggle 422s until the chosen aggregator s config is
  populated AND enabled=true.
- Admin UI picker in AgencySettingsPage.
- 15 tests.

AI Copilot context injection:
- New copilot-context service builds a per-request blob of
  {caregivers, courses} UUIDs and prepends it to every prompt so the
  model can emit real PROPOSE_ACTION_DATA with valid IDs.
- Role-scoped: admin/coordinator see up to 50 active caregivers + full
  course catalog; caregiver sees only their own record (test asserts
  no UUID leakage); family role gets empty blob.
- Failures degrade gracefully — the chat still works, just without
  structured actions.
- 8 tests.

VMUR (Visit Maintenance Unlock Request) PA DHS upgrade:
- Migration adds reason_category_code, correction_code, originator_role,
  caregiver_signature_present, client_signature_present,
  incomplete_signature_reason, approver_id, approved_at, agency_id
  columns.
- Domain enforces reason-code + correction-code enums (MTLB, DCDB,
  MFLB, MFLA, ACLN, ATGL, AGRS, WKAP, CNCL, HOLI, WKLI, OTHR) and
  refines missing-signature requires incompleteSignatureReason.
- POST /maintenance/caregiver-correction (caregiver-self-filed routed
  to coordinator review queue), POST /maintenance/reject-unlock/:id,
  GET /maintenance/queue, GET /maintenance/visit/:visitId, and
  GET /maintenance/history (filters whitelisted, limit clamped at 500).
- rejectUnlock SQL: single parameterized expression (was nested raw).
- New exception.rejected audit event (was reusing exception.approved
  with outcome=denied — semantic confusion).
- New /admin/corrections review UI + /admin/corrections/tracking
  history UI.
- 30 tests across schema, route, and UI.

HHAeXchange aggregator end-to-end:
- Migration for agency_hhaexchange_config (Tax ID + Provider ID + JSONB
  caregiver/service mappings).
- Repository with findByAgency / findValid / upsert (findValid only
  returns when identity is complete).
- GET/PUT /agencies/me/hhaexchange-config (Tax ID ^\\d{9}$; refuses
  enabled=true until identity is set).
- Admin UI section with identity form + caregiver mappings editor +
  service mappings editor (caregiver dropdown sourced from /api/staff).
- 17 tests.

Sandata aggregator parity (was identity-only before):
- AgencySandataConfigRepository.
- GET/PUT /agencies/me/sandata-config (Provider ID ^\\d{9}$; HCPCS
  code + modifier validated).
- Admin UI with identity form + caregiver mappings editor + HCPCS
  service mappings editor.
- Production-ready guard in /agencies/me/evv-config now goes through
  the typed repos instead of raw knex.
- 15 tests.

Security hardening:
- Removed dead-code localStorage write of bearer token from
  AcceptInvitePage (web uses HttpOnly cookie sessions).
- Tightened security-surface-scan regex to catch both rayhealth_
  and rayhealth. localStorage/sessionStorage keys.

Audit taxonomy:
- New event types: invite.access_code_failed, agency.evv-config.changed,
  exception.rejected.

Tests: 197 total (74 core / 109 app / 14 web). Net new: +103. Typecheck
clean, lint clean (0 errors, 0 warnings), security:scan clean.' 2>/dev/null || true
fi

echo ""
echo ">>> Step 4: Push"
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
echo ""
echo "Next steps from DEPLOY_NOW.md:"
echo "  1. Flip Vercel git source GitHub → Bitbucket (dashboard)"
echo "  2. Set new env vars (RESEND_API_KEY, APP_BASE_URL, etc.)"
echo "  3. Apply migrations: DATABASE_URL=... npx tsx packages/core/scripts/apply-new-migrations.ts"
echo "  4. Trigger production deploy"
echo "  5. Smoke test (see curl commands in DEPLOY_NOW.md)"
