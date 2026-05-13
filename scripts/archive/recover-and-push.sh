#!/usr/bin/env bash
#
# recover-and-push.sh
#
# Recovers from a partially-failed sync-session-work-to-bitbucket.sh run.
# Shows current state, syncs anything still missing from source, commits in
# a single focused commit, then pushes to Bitbucket.
#
# No `set -u` this time — that caused the $5 unbound-variable issue when
# bash tried to interpret dollar-sign escapes in long commit messages.

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
TARGET="/tmp/rayhealth-combined"

if [ ! -d "$TARGET/.git" ]; then
  echo "ERROR: $TARGET is not a git repo."
  exit 1
fi

cd "$TARGET"

echo ">>> Current state"
echo ""
git status --short
echo ""
echo ">>> Last 5 commits on local main:"
git log --oneline -5
echo ""

echo ">>> Syncing all session work from $SOURCE"
rsync_one() {
  local rel="$1"
  local src="$SOURCE/$rel"
  local dst="$TARGET/$rel"
  if [ ! -e "$src" ]; then
    echo "    skip (no source): $rel"
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

# Learning Hub
rsync_one "packages/core/src/domain/learning.ts"
rsync_one "packages/core/src/migrations/2026-05-11-add-learning.ts"
rsync_one "packages/core/src/repositories/learning-repository.ts"
rsync_one "packages/core/scripts/seed-learning-catalog.ts"
rsync_one "packages/core/src/__tests__/learning-repository.test.ts"
rsync_one "packages/app/src/routes/learning-routes.ts"
rsync_one "packages/web/src/features/learning"

# Modified files supporting Learning + capabilities
rsync_one "packages/core/src/index.ts"
rsync_one "packages/core/src/config/pennsylvania.ts"
rsync_one "packages/app/src/app.ts"
rsync_one "packages/web/src/App.tsx"

# Marketing pipeline (in case it didn't fully land)
rsync_one "marketing"

# Helper scripts and docs
rsync_one "NEXT_STEPS.md"
rsync_one "scripts/extract-to-standalone-repo.sh"
rsync_one "scripts/combine-mobile-into-bitbucket.sh"
rsync_one "scripts/sync-session-work-to-bitbucket.sh"
rsync_one "scripts/recover-and-push.sh"

echo ""
echo ">>> Files modified or added after sync:"
git status --short
echo ""

# Stage exactly the paths we care about (no broad git add .)
echo ">>> Staging"
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
  packages/web/src/App.tsx \
  marketing/ \
  NEXT_STEPS.md \
  scripts/extract-to-standalone-repo.sh \
  scripts/combine-mobile-into-bitbucket.sh \
  scripts/sync-session-work-to-bitbucket.sh \
  scripts/recover-and-push.sh 2>/dev/null || true

if git diff --cached --quiet; then
  echo "    Nothing staged — nothing to commit."
else
  echo ">>> Committing"
  # Use single-quoted commit message to avoid all dollar-sign expansion.
  git commit -m 'feat(session): Learning Hub + marketing pipeline + helper scripts + NEXT_STEPS

Single recovery commit that consolidates the work from this session that did
not land cleanly in the prior three-commit attempt.

Learning Hub (packages/core, packages/app, packages/web):
- Domain types: LearningCourse, CourseEnrollment, CourseCompletion
- Migration: learning_courses, course_enrollments, course_completions
- LearningRepository with idempotent upsert and pure status derivation
- 6 API routes under /api/learning
- 3 web pages: dashboard, catalog, caregiver detail
- RBAC capabilities learning.read and learning.write
- 8-course PA catalog seed (orientation, HIPAA, abuse/neglect, infection
  control, dementia, fall prevention, body mechanics, CPR/first aid)
- 3 vitest tests (auto-skip without a DB)

Marketing video pipeline (marketing/):
- 6 spot scripts (Hero, Agency, Caregiver, Family, Compliance, Bumper)
- ElevenLabs Python client for voiceovers
- Veo 3 + Seedance Python clients for video generation
- shots.yaml with 27 prompts, 140 seconds of generated video
- README with DaVinci Resolve assembly guide

Helper scripts (scripts/):
- extract-to-standalone-repo.sh: filter-repo extraction workaround
- combine-mobile-into-bitbucket.sh: git subtree add the mobile repo
- sync-session-work-to-bitbucket.sh: previous sync attempt
- recover-and-push.sh: this script

Docs:
- NEXT_STEPS.md: tiered playbook for remaining work'
fi

echo ""
echo ">>> Pushing to Bitbucket"
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify at https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
