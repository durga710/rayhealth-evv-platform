#!/usr/bin/env bash
#
# sync-session4-to-bitbucket.sh
#
# Sync everything since sync-session3 — v2 Copilot action runner with typed
# executors, end-to-end Confirm → /execute wiring, structured proposed-action
# JSON from the model, notification settings, expanded audit taxonomy — into
# /tmp/rayhealth-combined and push to Bitbucket main.
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

# Core: new copilot-actions domain + audit taxonomy + agency features expansion
rsync_one "packages/core/src/domain/audit.ts"
rsync_one "packages/core/src/domain/agency-features.ts"
rsync_one "packages/core/src/domain/copilot-actions.ts"
rsync_one "packages/core/src/index.ts"

# App: copilot route + action executor + new tests
rsync_one "packages/app/src/routes/copilot-routes.ts"
rsync_one "packages/app/src/services/copilot-action-executor.ts"
rsync_one "packages/app/src/routes/__tests__/copilot-routes.test.ts"

# Web: Copilot chat updates + agency settings notifications
rsync_one "packages/web/src/features/learning/CopilotChatPage.tsx"
rsync_one "packages/web/src/features/agency/AgencySettingsPage.tsx"

# Docs + scripts
rsync_one "PROJECT_STATUS.md"
rsync_one "scripts/sync-session4-to-bitbucket.sh"

echo ""
echo ">>> Step 3: Stage and commit"
git add \
  packages/core/src/domain/audit.ts \
  packages/core/src/domain/agency-features.ts \
  packages/core/src/domain/copilot-actions.ts \
  packages/core/src/index.ts \
  packages/app/src/routes/copilot-routes.ts \
  packages/app/src/services/copilot-action-executor.ts \
  packages/app/src/routes/__tests__/copilot-routes.test.ts \
  packages/web/src/features/learning/CopilotChatPage.tsx \
  packages/web/src/features/agency/AgencySettingsPage.tsx \
  PROJECT_STATUS.md \
  scripts/sync-session4-to-bitbucket.sh 2>/dev/null || true

if git diff --cached --quiet; then
  echo "    Nothing staged — repo already in sync."
else
  git commit -m 'feat(session4): Copilot v2 action runner end-to-end + notification settings

Closes the Copilot loop from natural-language ask to confirmed execution
of typed actions. Adds notification preferences scaffold.

Copilot v2 action runner:
- packages/core/src/domain/copilot-actions.ts: Zod discriminated union
  for CopilotAction with two action types (enroll_caregiver, send_reminder).
  Shared schema for the LLM prompt-builder, the UI confirm renderer,
  and the backend executor — single source of truth.
- packages/app/src/services/copilot-action-executor.ts: dispatcher with
  per-action authorization checks (row-level: caregiver belongs to actor s
  agency, course is visible). ActionAuthorizationError and
  ActionExecutionError classes distinguish 403 from 422 outcomes.
- POST /api/copilot/execute endpoint that validates payload, runs the
  executor, and writes copilot.action.confirmed on success or
  copilot.action.declined on any failure with the full reason in payload.

End-to-end Confirm wiring:
- Updated SYSTEM_PROMPTS to instruct the model to emit a second line
  PROPOSE_ACTION_DATA: <JSON> alongside the natural-language proposal.
- /ask parses the JSON, validates against copilotActionSchema, returns
  as proposedActionData. Invalid JSON drops to natural-language advisory mode.
- CopilotChatPage Confirm button: when proposedActionData is present,
  posts to /execute and renders the result summary inline. Falls back to
  advisory mode (record-only) when the model emits free-text only.
- Executable badge on the proposed-action block when the model returned
  structured JSON. Buttons lock after first confirm/decline so the action
  can t be double-run.
- 7 new tests covering: 400 on malformed payload, 402 when add-on off,
  happy path with summary, 403 on caregiver actor, 403 on cross-agency,
  422 on missing caregiver, send_reminder stub.

Notification settings:
- agency-features.ts: new notifications block in AgencyFeatures —
  coordinator digest (off/daily/weekly), caregiver push, caregiver email,
  family email. v2 stub: preferences persist, delivery wires up when the
  notification service ships.
- AgencySettingsPage renders a second section with the same admin-only
  pattern as AI Copilot (private billing).

Audit taxonomy:
- New event types from session3 (agency.feature.changed, copilot.query,
  copilot.action.proposed/confirmed/declined) are now actually written.

Total: 92 tests passing across the workspaces.'
fi

echo ""
echo ">>> Step 4: Push"
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
