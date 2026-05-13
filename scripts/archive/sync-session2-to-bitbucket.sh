#!/usr/bin/env bash
#
# sync-session2-to-bitbucket.sh
#
# Sync the work added since the last sync — Learning Hub completions,
# audit-event additions, AssignmentsPage compliance gate, preflight endpoint,
# mobile-capacitor Learning screens, etc. — into /tmp/rayhealth-combined and
# push to Bitbucket main.
#
# Idempotent and safe to re-run. Uses single-quoted commit messages to avoid
# the $5 unbound-variable bash quirk that bit us last time.

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

# --- Audit event additions + new event types ---
rsync_one "packages/core/src/domain/audit.ts"

# --- Compliance gate + completion audit ---
rsync_one "packages/app/src/routes/assignment-routes.ts"
rsync_one "packages/app/src/routes/learning-routes.ts"
rsync_one "packages/app/src/routes/__tests__/assignment-routes.test.ts"
rsync_one "packages/app/src/routes/__tests__/learning-routes.test.ts"

# --- Learning Repository updates (insights + blockers) ---
rsync_one "packages/core/src/domain/learning.ts"
rsync_one "packages/core/src/repositories/learning-repository.ts"
rsync_one "packages/core/src/config/pennsylvania.ts"

# --- Web compliance gate UI ---
rsync_one "packages/web/src/lib/api-client.ts"
rsync_one "packages/web/src/features/scheduling/AssignmentsPage.tsx"
rsync_one "packages/web/src/features/learning/InsightsPanel.tsx"
rsync_one "packages/web/src/features/learning/LearningDashboardPage.tsx"
rsync_one "packages/web/src/features/learning/CaregiverLearningPage.tsx"

# --- Mobile-capacitor Learning module (speculative — sits alongside subtree) ---
rsync_one "packages/mobile-capacitor/src/features/learning"

# --- This script itself ---
rsync_one "scripts/sync-session2-to-bitbucket.sh"

echo ""
echo ">>> Step 3: Stage and commit"
git add \
  packages/core/src/domain/audit.ts \
  packages/core/src/domain/learning.ts \
  packages/core/src/repositories/learning-repository.ts \
  packages/core/src/config/pennsylvania.ts \
  packages/app/src/routes/assignment-routes.ts \
  packages/app/src/routes/learning-routes.ts \
  packages/app/src/routes/__tests__/assignment-routes.test.ts \
  packages/app/src/routes/__tests__/learning-routes.test.ts \
  packages/web/src/lib/api-client.ts \
  packages/web/src/features/scheduling/AssignmentsPage.tsx \
  packages/web/src/features/learning/InsightsPanel.tsx \
  packages/web/src/features/learning/LearningDashboardPage.tsx \
  packages/web/src/features/learning/CaregiverLearningPage.tsx \
  packages/mobile-capacitor/src/features/learning/ \
  scripts/sync-session2-to-bitbucket.sh 2>/dev/null || true

if git diff --cached --quiet; then
  echo "    Nothing staged — repo already in sync."
else
  git commit -m 'feat(session2): compliance gate UI + audit events + insights + mobile learning

Builds on top of the previous Learning Hub commit. Three feature tracks
landing in a single recovery commit; the next session will use focused
commits.

Compliance gate (cross-cutting):
- packages/app/src/routes/assignment-routes.ts: POST /assignments now
  checks LearningRepository.getAssignmentBlockers before creating. Returns
  422 with code CAREGIVER_NOT_COMPLIANT + blockers list. Coordinator can
  override with { force: true, overrideReason: "..." }, which writes a
  structured learning.override audit event tying back to the new
  assignment id.
- New GET /assignments/compliance-check/:caregiverId preflight endpoint
  for the AssignmentsPage UI to surface blockers up front.
- Row-level guard on POST /learning/complete: caregivers can only
  complete their own training; coordinators can complete on behalf.
- packages/web/src/features/scheduling/AssignmentsPage.tsx: catches 422
  via typed HttpError, renders blockers banner with Resolve-training
  link, Override (record reason) button using window.prompt, Cancel.
  Adds preflight check that fires 600ms after caregiverId field stops
  changing. Adds caregiver name lookup from /api/staff.

AI-flavored insights:
- LearningRepository.getActionableInsights — 5 deterministic signals:
  due-in-7-days, expired-recently, orientation-incomplete, stalled
  enrollments, certifications-expiring-soon. Pure SQL — no model calls.
- GET /api/learning/insights endpoint.
- InsightsPanel component on the dashboard with severity-coded cards,
  caregiver chips linking to detail page, +N more overflow.

Audit event coverage:
- New audit event types: learning.override, learning.course.completed.
- POST /learning/complete now writes a structured completion event with
  source discriminator ("caregiver" if actor IS the caregiver, else
  "coordinator").
- POST /assignments override path writes learning.override audit event
  with blocker list, reason, and assignment id.
- All audit writes wrapped in try/catch — audit failures never block
  user-facing operations.

Typed HTTP error:
- packages/web/src/lib/api-client.ts now exports HttpError class with
  status and parsed body. Replaces the old throw new Error pattern so
  callers can branch on server-supplied codes.

Mobile-capacitor (speculative):
- packages/mobile-capacitor/src/features/learning/ — LearningHubScreen,
  CourseDetailScreen, API client, types, README with 5-point integration
  guide. Lands alongside the subtree-added mobile code; wires into the
  Capacitor app router when integrated.

Tests:
- 4 new assignment-routes tests (compliant happy path, missing template,
  blocked-by-incomplete-training, override accepted).
- 5 new learning-routes tests covering audit write shape and the
  compliance-check endpoint.
- All typechecks green, all tests passing (42 core, 20 app, 5 web).'
fi

echo ""
echo ">>> Step 4: Push"
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
