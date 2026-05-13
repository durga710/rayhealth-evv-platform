#!/usr/bin/env bash
#
# sync-session3-to-bitbucket.sh
#
# Sync everything added since sync-session2 — Learning Analytics, course
# drill-down, AI Copilot panel + chat + backend, agency features, admin
# settings page, expanded audit event taxonomy — into /tmp/rayhealth-combined
# and push to Bitbucket main.
#
# Idempotent. Safe to re-run.
# Single-quoted commit message (no shell expansion); no set -u.

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

# --- Core: domain + repository + migration + audit taxonomy ---
rsync_one "packages/core/src/domain/audit.ts"
rsync_one "packages/core/src/domain/learning.ts"
rsync_one "packages/core/src/domain/agency-features.ts"
rsync_one "packages/core/src/repositories/learning-repository.ts"
rsync_one "packages/core/src/migrations/2026-05-11-add-agency-features.ts"
rsync_one "packages/core/src/config/pennsylvania.ts"
rsync_one "packages/core/src/index.ts"

# --- App: routes + services ---
rsync_one "packages/app/src/routes/agency-routes.ts"
rsync_one "packages/app/src/routes/learning-routes.ts"
rsync_one "packages/app/src/routes/copilot-routes.ts"
rsync_one "packages/app/src/routes/assignment-routes.ts"
rsync_one "packages/app/src/services/gemini-client.ts"
rsync_one "packages/app/src/app.ts"

# --- App: tests ---
rsync_one "packages/app/src/routes/__tests__/agency-features-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/learning-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/assignment-routes.test.ts"

# --- Web: api-client + dashboard + assignment + new pages ---
rsync_one "packages/web/src/lib/api-client.ts"
rsync_one "packages/web/src/App.tsx"
rsync_one "packages/web/src/features/scheduling/AssignmentsPage.tsx"
rsync_one "packages/web/src/features/scheduling/AssignmentsPage.test.tsx"
rsync_one "packages/web/src/features/learning/LearningDashboardPage.tsx"
rsync_one "packages/web/src/features/learning/LearningAnalyticsPage.tsx"
rsync_one "packages/web/src/features/learning/CourseDetailPage.tsx"
rsync_one "packages/web/src/features/learning/CopilotChatPage.tsx"
rsync_one "packages/web/src/features/learning/AICopilotPanel.tsx"
rsync_one "packages/web/src/features/learning/InsightsPanel.tsx"
rsync_one "packages/web/src/features/learning/CaregiverLearningPage.tsx"
rsync_one "packages/web/src/features/agency/AgencySettingsPage.tsx"

# --- Docs + script itself ---
rsync_one "PROJECT_STATUS.md"
rsync_one "scripts/sync-session3-to-bitbucket.sh"

echo ""
echo ">>> Step 3: Stage and commit"
git add \
  packages/core/src/domain/audit.ts \
  packages/core/src/domain/learning.ts \
  packages/core/src/domain/agency-features.ts \
  packages/core/src/repositories/learning-repository.ts \
  packages/core/src/migrations/2026-05-11-add-agency-features.ts \
  packages/core/src/config/pennsylvania.ts \
  packages/core/src/index.ts \
  packages/app/src/routes/agency-routes.ts \
  packages/app/src/routes/learning-routes.ts \
  packages/app/src/routes/copilot-routes.ts \
  packages/app/src/routes/assignment-routes.ts \
  packages/app/src/services/gemini-client.ts \
  packages/app/src/app.ts \
  packages/app/src/routes/__tests__/agency-features-routes.test.ts \
  packages/app/src/routes/__tests__/learning-routes.test.ts \
  packages/app/src/routes/__tests__/assignment-routes.test.ts \
  packages/web/src/lib/api-client.ts \
  packages/web/src/App.tsx \
  packages/web/src/features/scheduling/AssignmentsPage.tsx \
  packages/web/src/features/scheduling/AssignmentsPage.test.tsx \
  packages/web/src/features/learning/ \
  packages/web/src/features/agency/AgencySettingsPage.tsx \
  PROJECT_STATUS.md \
  scripts/sync-session3-to-bitbucket.sh 2>/dev/null || true

if git diff --cached --quiet; then
  echo "    Nothing staged — repo already in sync."
else
  git commit -m 'feat(session3): Learning Analytics + AI Copilot end-to-end + agency features

Four feature tracks landing in one consolidated commit. Each is independently
revertable at the file level; the combined commit reflects how it actually
took shape.

Learning Analytics:
- packages/core/src/repositories/learning-repository.ts: getCourseAnalytics
  computes per-course completion rate, average days-to-complete, status counts
  via a single left-join + in-memory aggregation. Sorted required-first then
  by completion rate ascending so bottleneck courses surface at the top.
- GET /api/learning/analytics endpoint.
- LearningAnalyticsPage with color-coded completion bars (teal/amber/orange/red),
  action-needed summary, drill-down link.

Course detail drill-down:
- getCourseCaregivers returns enrollments + caregiver names + effective status.
- GET /api/learning/courses/:id/caregivers endpoint.
- CourseDetailPage groups caregivers by status with worst-first ordering,
  each row links to the per-caregiver detail.

AI Copilot end-to-end:
- agency-features.ts domain + migration: JSONB features column on agencies,
  Zod schema validation, parse-with-default helper.
- GET/PUT /api/agencies/me/features (PUT is admin-only).
- AgencySettingsPage with Enable toggle + plan picker.
- AICopilotPanel on Learning Hub dashboard — visible-locked when off,
  Enable CTA visible only to admins (private billing).
- packages/app/src/services/gemini-client.ts: minimal REST wrapper for
  Gemini, no SDK dependency. Distinct error classes for not-configured vs
  upstream errors.
- packages/app/src/routes/copilot-routes.ts: /status + /ask endpoints.
- Per-role system prompts (admin/coordinator/caregiver/family) with explicit
  scope and the confirm-every-action contract baked into the instruction.
- Model selection by plan: gemini-2.5-flash for Starter, gemini-2.5-pro for Pro.
- CopilotChatPage at /admin/learning/copilot with role-specific suggested
  prompts, proposed-action confirm/decline UI, three states (locked / offline
  / live).

Audit taxonomy expansion:
- New event types: agency.feature.changed, copilot.query,
  copilot.action.proposed, copilot.action.confirmed, copilot.action.declined.
- Prompts are hashed (SHA-256 prefix) before being written to audit — gives
  forensic correlation without storing prompt content (which can contain PHI).

UI polish:
- AssignmentsPage gets caregiver picker + client picker + template-with-
  client-name + name lookup in upcoming list + preflight compliance check.
- HttpError class on api-client so the assignments page can branch on the
  422 CAREGIVER_NOT_COMPLIANT code.

Tests:
- 8 new tests covering /agencies/me/features (GET + PUT, valid + invalid),
  /learning/analytics, /learning/courses/:id/caregivers (happy + 404).
- Plus 4 new tests on assignment-routes and 5 new on learning-routes from
  the previous session that hadn t been synced.
- All typechecks green across core / app / web.
- Total tests now 75 (42 core / 28 app / 5 web).'
fi

echo ""
echo ">>> Step 4: Push"
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
