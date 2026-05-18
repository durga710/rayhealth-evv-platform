#!/usr/bin/env bash
#
# sync-session-work-to-bitbucket.sh
#
# Copies the work I did in this session that hasn't landed on Bitbucket yet
# (Learning Hub + marketing pipeline + helper scripts + this session's docs)
# from the Desktop project folder into /tmp/rayhealth-combined, then commits
# it in three focused commits and pushes to Bitbucket main.
#
# Why three focused commits instead of one big drop:
#   - feat(learning): isolated, fully tested, can be reverted on its own
#   - feat(marketing): pipeline + scripts, independent of platform code
#   - docs/scripts: meta — NEXT_STEPS playbook + helper scripts
#
# Run from anywhere:
#   bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/sync-session-work-to-bitbucket.sh"

set -euo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
TARGET="/tmp/rayhealth-combined"

if [ ! -d "$TARGET/.git" ]; then
  echo "ERROR: $TARGET is not a git repo. Run combine-mobile-into-bitbucket.sh first."
  exit 1
fi

cd "$TARGET"
echo ">>> Pulling latest from Bitbucket"
git checkout main
git pull --ff-only origin main

# rsync helper — preserves directory structure, never deletes target files,
# never copies .git or build artifacts.
sync_path() {
  local rel="$1"
  echo "    syncing: $rel"
  local src="$SOURCE/$rel"
  local dst="$TARGET/$rel"
  if [ ! -e "$src" ]; then
    echo "    WARN: source $src does not exist, skipping"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  if [ -d "$src" ]; then
    rsync -a --delete \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='.turbo' \
      --exclude='*.tsbuildinfo' \
      "$src/" "$dst/"
  else
    cp "$src" "$dst"
  fi
}

# ------------------------------------------------------------
# Commit 1: Learning Hub
# ------------------------------------------------------------

echo ""
echo "=== Commit 1/3: feat(learning) ==="

# New files
sync_path "packages/core/src/domain/learning.ts"
sync_path "packages/core/src/migrations/2026-05-11-add-learning.ts"
sync_path "packages/core/src/repositories/learning-repository.ts"
sync_path "packages/core/scripts/seed-learning-catalog.ts"
sync_path "packages/core/src/__tests__/learning-repository.test.ts"
sync_path "packages/app/src/routes/learning-routes.ts"
sync_path "packages/web/src/features/learning/LearningDashboardPage.tsx"
sync_path "packages/web/src/features/learning/CourseCatalogPage.tsx"
sync_path "packages/web/src/features/learning/CaregiverLearningPage.tsx"

# Modified files (re-sync overrides)
sync_path "packages/core/src/index.ts"
sync_path "packages/core/src/config/pennsylvania.ts"
sync_path "packages/app/src/app.ts"
sync_path "packages/web/src/App.tsx"

git add \
  packages/core/src/domain/learning.ts \
  packages/core/src/migrations/2026-05-11-add-learning.ts \
  packages/core/src/repositories/learning-repository.ts \
  packages/core/scripts/seed-learning-catalog.ts \
  packages/core/src/__tests__/learning-repository.test.ts \
  packages/app/src/routes/learning-routes.ts \
  packages/web/src/features/learning/ \
  packages/core/src/index.ts \
  packages/core/src/config/pennsylvania.ts \
  packages/app/src/app.ts \
  packages/web/src/App.tsx

git commit -m "feat(learning): Caregiver Learning Hub — domain, API, UI, PA catalog

Caregiver training compliance surface for coordinators and admins.

Domain (packages/core):
- LearningCourse, CourseEnrollment, CourseCompletion entities
- LearningAgencyRollup + CaregiverLearningProgress aggregate views
- Migration: learning_courses, course_enrollments,
  course_completions (append-only event log)
- LearningRepository: CRUD, idempotent upsert by code, pure-function
  status derivation (handles expired vs completed vs overdue from
  timestamps, so denormalized status column is just a cache)
- Seed script for 8 PA-required courses as global (agency-null)
  courses: orientation, annual HIPAA, abuse/neglect, infection control,
  dementia care, fall prevention, body mechanics, CPR/first aid

RBAC (packages/core/src/config/pennsylvania.ts):
- New capabilities: learning.read, learning.write
- admin: read+write
- coordinator: read+write
- caregiver: read only
- family: no access

API (packages/app/src/routes/learning-routes.ts):
- GET  /learning/dashboard          — agency rollup
- GET  /learning/courses            — catalog
- POST /learning/courses            — create catalog entry
- GET  /learning/caregivers/:id     — per-caregiver progress
- POST /learning/enroll             — assign a course
- POST /learning/complete           — record a completion event

Web UI (packages/web/src/features/learning/):
- LearningDashboardPage: KPIs (active caregivers, total enrollments,
  compliance %), 5-status breakdown, segmented compliance bar,
  attention banner for overdue+expired
- CourseCatalogPage: list of all courses with Required/Global badges
- CaregiverLearningPage: per-caregiver enrollment list with inline
  'Mark complete' action, status pills, due/expiry dates

Tests (3 vitest, auto-skip when no DB):
- Idempotent course upsert
- Mixed-status rollup correctness
- Expiry derivation (400 days after completion -> 'expired')

Maps to 'Command Glass / executive command center' direction from
brand preferences. Caregiver-facing consumption surface (taking the
courses, recording completion from mobile) lands in
packages/mobile-capacitor/ in a follow-up."

# ------------------------------------------------------------
# Commit 2: Marketing pipeline
# ------------------------------------------------------------

echo ""
echo "=== Commit 2/3: feat(marketing) ==="

sync_path "marketing"

git add marketing/

git commit -m "feat(marketing): video production pipeline (ElevenLabs + Veo3 + Seedance)

Code paths for generating the 6 spots from MARKETING_KIT.md without
needing voice talent, b-roll, or stock footage for the first cut.

Scripts (marketing/scripts/):
- spot1-hero.md (Hero — 'Care, finally on the same page')
- spot2-agency-owner.md ('Run the agency, not the spreadsheet')
- spot3-caregiver.md ('A workday that respects your time')
- spot4-family.md ('Closer to the people you love')
- spot5-compliance.md ('Audit-ready by design')
- spot6-bumper.md (6-second YouTube pre-roll)

Pipeline (marketing/pipeline/):
- generate_vo.py: ElevenLabs VO, 6 MP3 outputs, per-spot voice config
- generate_clips.py: Seedance via fal.ai (5/10s clips, $5-25 full pass)
- generate_clips_veo3.py: Veo 3 via Google Gemini API (4/6/8s clips,
  ~\$16 Fast / ~\$120 Pro for full 140s set)
- shots.yaml: 27 shot prompts across 6 spots, 140s total generated video

Docs:
- README.md: end-to-end runbook including .env setup, smoke-test
  pattern, DaVinci Resolve assembly with audio LUFS targets per channel,
  variant matrix (16:9 master, 9:16 Reels, audio-only Spotify)
- .env.example: template for ELEVENLABS_API_KEY, GOOGLE_AI_API_KEY,
  FAL_KEY — never paste real keys here, .env is gitignored

Brand-safe compliance copy enforced in every script: 'built to
support EVV/PHI requirements' rather than 'HIPAA compliant', matching
brand governance positioning."

# ------------------------------------------------------------
# Commit 3: docs + helper scripts
# ------------------------------------------------------------

echo ""
echo "=== Commit 3/3: docs+chore (NEXT_STEPS + helper scripts) ==="

sync_path "NEXT_STEPS.md"
sync_path "scripts/extract-to-standalone-repo.sh"
sync_path "scripts/combine-mobile-into-bitbucket.sh"
sync_path "scripts/sync-session-work-to-bitbucket.sh"

git add \
  NEXT_STEPS.md \
  scripts/extract-to-standalone-repo.sh \
  scripts/combine-mobile-into-bitbucket.sh \
  scripts/sync-session-work-to-bitbucket.sh

git commit -m "docs+chore: NEXT_STEPS playbook + repo-management helper scripts

NEXT_STEPS.md: tiered playbook for everything left to ship
- Tier 1 urgent (revoke credentials, fix .env, Vercel deploy verify)
- Tier 2 this week (BAAs, Neon HIPAA, risk-analysis signature,
  cyber-liability)
- Tier 3 before App Store (icon swap, mobile clickability)
- Tier 4 before first paid agency (pen test, code cherry-picks)
- Tier 5 stretch (repo extraction, marketing assembly, localization)

Helper scripts (scripts/):
- extract-to-standalone-repo.sh: use git-filter-repo to extract
  this folder's history into a self-contained repo (workaround for
  the long-standing \$HOME-as-git-root issue)
- combine-mobile-into-bitbucket.sh: git subtree add the
  rayhealth-evv-mobile repo into packages/mobile-capacitor/
  preserving full history
- sync-session-work-to-bitbucket.sh: this script — sync Desktop
  workspace state into the Bitbucket-tracked clone and commit"

# ------------------------------------------------------------
# Push
# ------------------------------------------------------------

echo ""
echo "=== Pushing to Bitbucket main ==="
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -6
echo ""
echo "Verify on https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
