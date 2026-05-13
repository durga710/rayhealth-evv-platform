#!/usr/bin/env bash
#
# sync-session6-to-github.sh
#
# Push session 6 (security hardening + .github/ governance + doc
# consolidation) directly to GitHub at
# github.com/durga710/rayhealth-evv-platform. GitHub is the canonical
# remote — Bitbucket has been dropped.
#
# Strategy:
#   - rsync from the Desktop workspace into /tmp/rayhealth-combined.
#   - Remove the 15 stale handoff docs + one-shot sync scripts that were
#     archived in this session.
#   - Stage + commit with the full session-6 message.
#   - Push to GitHub main with --force-with-lease.
#
# Pre-flight:
#   1. /tmp/rayhealth-combined must already be a git repo with a `github`
#      remote. If it doesn't have one yet, run sync-session5-to-github.sh
#      first — it adds the remote and primes the working dir.
#   2. You must have GitHub auth wired into git (gh auth setup-git or an
#      SSH key registered at https://github.com/settings/keys).
#
# Idempotent. Safe to re-run.

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
TARGET="/tmp/rayhealth-combined"
GITHUB_REMOTE="https://github.com/durga710/rayhealth-evv-platform.git"

if [ ! -d "$TARGET/.git" ]; then
  echo "ERROR: $TARGET is not a git repo."
  echo "       Run sync-session5-to-github.sh first to bootstrap it."
  exit 1
fi

cd "$TARGET"

echo ">>> Step 1: Make sure the github remote exists and points at $GITHUB_REMOTE"
if git remote get-url github >/dev/null 2>&1; then
  CURRENT="$(git remote get-url github)"
  if [ "$CURRENT" != "$GITHUB_REMOTE" ]; then
    echo "    updating github remote: $CURRENT → $GITHUB_REMOTE"
    git remote set-url github "$GITHUB_REMOTE"
  fi
else
  echo "    adding github remote"
  git remote add github "$GITHUB_REMOTE"
fi

echo ""
echo ">>> Step 2: Fetch GitHub state and reset local main to track it"
git fetch github main || echo "    (github/main may not exist yet)"
# Make sure we are working from GitHub's main, not whatever origin (e.g.
# Bitbucket) used to point at. We do NOT touch the `origin` remote here —
# the user can rename it later if they want — we just sync against github.
if git rev-parse --verify github/main >/dev/null 2>&1; then
  git checkout -B main github/main
else
  git checkout -B main
fi

echo ""
echo ">>> Step 3: Sync from Desktop workspace"
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

# ---------- Security hardening (app + core) ----------
rsync_one "packages/app/src/app.ts"
rsync_one "packages/app/src/middleware/auth-context.ts"
rsync_one "packages/app/src/security/cookies.ts"
rsync_one "packages/app/src/routes/auth-routes.ts"
rsync_one "packages/app/src/routes/invite-acceptance-routes.ts"
rsync_one "packages/app/src/routes/__tests__/test-helpers.ts"
rsync_one "packages/app/package.json"
rsync_one "package-lock.json"
rsync_one "packages/core/src/migrations/runner.ts"
rsync_one "scripts/security-surface-scan.ts"

# Migration script + knex resilience that landed this session
rsync_one "packages/core/src/db/knex.ts"
rsync_one "packages/core/scripts/apply-new-migrations.ts"

# ---------- .github/ governance scaffold ----------
rsync_one ".github"

# ---------- Top-level docs ----------
rsync_one "README.md"
rsync_one "SECURITY.md"
rsync_one "DEPLOY_NOW.md"
rsync_one "PROJECT_STATUS.md"

# ---------- Active scripts ----------
rsync_one "scripts/deploy.sh"
rsync_one "scripts/run-migrations-prompted.sh"
rsync_one "scripts/neon-connection-test.sh"
rsync_one "scripts/sync-session6-to-github.sh"

# ---------- Archive folders (preserved provenance) ----------
rsync_one "docs/handoffs-archive"
rsync_one "scripts/archive"

# ---------- Remove the stale handoff docs from the canonical tree ----------
for stale in \
  AGENT_HANDOFF_2026-05-08.md \
  HANDOFF.md \
  HANDOFF_CLAUDE_SECURITY_PHASE_1_2026-05-08.md \
  HANDOFF_CODEX.md \
  HANDOFF_TO_CURSOR.md \
  GEMINI_PROMPT.md \
  docs/SESSION_HANDOFF_2026-05-09.md ; do
  if [ -f "$TARGET/$stale" ]; then
    git rm "$TARGET/$stale" 2>/dev/null || rm "$TARGET/$stale"
    echo "    rm  : $stale (now in docs/handoffs-archive/)"
  fi
done

# Stale one-shot sync scripts — including the Bitbucket-only ones, since
# Bitbucket is no longer used.
for stale_script in \
  scripts/combine-mobile-into-bitbucket.sh \
  scripts/commit-2026-05-11.sh \
  scripts/extract-to-standalone-repo.sh \
  scripts/recover-and-push.sh \
  scripts/sync-session-work-to-bitbucket.sh \
  scripts/sync-session2-to-bitbucket.sh \
  scripts/sync-session3-to-bitbucket.sh \
  scripts/sync-session4-to-bitbucket.sh \
  scripts/sync-session5-to-bitbucket.sh \
  scripts/sync-session6-to-bitbucket.sh ; do
  if [ -f "$TARGET/$stale_script" ]; then
    git rm "$TARGET/$stale_script" 2>/dev/null || rm "$TARGET/$stale_script"
    echo "    rm  : $stale_script (Bitbucket no longer used)"
  fi
done

echo ""
echo ">>> Step 4: Stage and commit"
git add -A

if git diff --cached --quiet; then
  echo "    Nothing staged — repo already in sync."
else
  git commit -m 'feat(session6): security hardening + .github governance + GitHub-only canonical remote

Production-grade security pass closing every High/Medium finding from a
SOC 2 / HIPAA-aligned senior-engineer review, plus the .github governance
scaffold, plus consolidation of the doc + script sprawl from sessions 1-5.
Drops Bitbucket — GitHub is now the sole canonical remote.

Security hardening (packages/app):
- helmet() with HSTS (1yr + preload + subdomains), CSP default-src none
  + frame-ancestors none, X-Frame-Options DENY, Referrer-Policy
  no-referrer, Cross-Origin-Resource-Policy same-site.
- JWT algorithm pinned to HS256 on every jwt.verify (auth-context) and
  every jwt.sign site (auth/login, auth/bootstrap, invite-acceptance,
  test-helpers). Closes alg=none and RS256-to-HS256 key confusion.
- express.json({ limit: 100kb }) — explicit cap, JSON-bomb DoS.
- Default authenticated rate limiter (300/15min) layered with tighter
  per-route caps: /copilot (40/15min, LLM cost), /admin/audit-retention
  (30/15min, admin-only).
- ALLOWED_ORIGINS fail-closed in production — createApp throws if env
  var missing instead of silently defaulting to localhost.
- trust proxy: 1 so req.ip reflects the real client behind Vercel.
- Session cookies sameSite: strict (was lax).

Migration / DB resilience (packages/core):
- buildDbConfig: 15s acquireConnectionTimeout, full pool timeouts,
  min/max/idle. Failed connects fail fast.
- apply-new-migrations.ts: SELECT 1 probe before the loop, actionable
  error hints, unhandledRejection handler filters benign tarn aborted
  errors during destroy so successful runs print their JSON.
- runner.ts: process.stderr.write instead of console.log.

.github/ governance scaffold:
- workflows/ci.yml — six required status checks (typecheck, lint,
  security-scan, test-core, test-app, test-web).
- workflows/codeql.yml — javascript-typescript security-extended +
  security-and-quality, weekly cron.
- workflows/dependency-review.yml — fails PR on high+ CVE or GPL/AGPL.
- workflows/secret-scan.yml — gitleaks on PR + push + manual.
- rulesets/main-branch-protection.json — no deletion, no force-push,
  linear history, PR with 1 code-owner approval, dismiss stale, last-push
  approval, thread resolution, all 6 status checks (strict), Conventional
  Commits. No bypass actors.
- rulesets/tags-protection.json — immutable tags.
- CODEOWNERS, PULL_REQUEST_TEMPLATE, ISSUE_TEMPLATE/bug_report,
  ISSUE_TEMPLATE/config.

Docs:
- SECURITY.md — disclosure policy, 7-day-fix SLA for sev-1.
- README.md rewritten (was stale "Legal Templates" boilerplate).
- security-surface-scan regex tightened to catch rayhealth_ AND
  rayhealth. localStorage/sessionStorage keys + same for sessionStorage.

Consolidation:
- 7 stale handoff docs → docs/handoffs-archive/ with provenance README.
- 10 one-shot sync scripts (incl. all Bitbucket scripts) →
  scripts/archive/ with provenance README. GitHub is the single remote.
- Active scripts now: check.sh, deploy.sh, neon-connection-test.sh,
  run-migrations-prompted.sh, sync-session6-to-github.sh,
  security-surface-scan.ts.

Tests + gates after this session:
- 197 tests across 41 files (74 core / 109 app / 14 web), all green.
- Typecheck clean, lint clean (0 errors, 0 warnings), security:scan
  passes. helmet resolves cleanly.' || true
fi

echo ""
echo ">>> Step 5: Push to GitHub with --force-with-lease"
if ! git push github main --force-with-lease; then
  cat <<'EOF'

ERROR: GitHub push failed. Most likely cause: no auth credentials.

Three fixes, pick whichever is easiest:

  1) GitHub CLI (recommended):
       brew install gh
       gh auth login           # GitHub.com → HTTPS → browser
       gh auth setup-git       # ← wires gh into git itself
       bash "$0"               # re-run this script

  2) SSH key:
       # If you have ~/.ssh/id_ed25519.pub or id_rsa.pub already, paste it
       # at https://github.com/settings/keys
       # Verify: ssh -T git@github.com  (should greet "Hi durga710!")
       # Then re-run this script.

  3) Personal Access Token (no install):
       # https://github.com/settings/tokens → Generate (classic) → scope: repo
       cd /tmp/rayhealth-combined
       git push github main --force-with-lease
       # When prompted, paste the PAT as password.

EOF
  exit 1
fi

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://github.com/durga710/rayhealth-evv-platform/commits/main"
echo ""
echo "Vercel auto-triggers a production deploy from this push."
echo "Watch: https://vercel.com/dashboard → RayHealth project → Deployments"
echo ""
echo "Next:"
echo "  1. Apply the GitHub rulesets (one-time):"
echo "       gh api --method POST -H 'Accept: application/vnd.github+json' \\"
echo "         /repos/durga710/rayhealth-evv-platform/rulesets \\"
echo "         --input .github/rulesets/main-branch-protection.json"
echo "       gh api --method POST -H 'Accept: application/vnd.github+json' \\"
echo "         /repos/durga710/rayhealth-evv-platform/rulesets \\"
echo "         --input .github/rulesets/tags-protection.json"
echo ""
echo "  2. Apply the 8 Neon migrations:"
echo "       bash $SOURCE/scripts/run-migrations-prompted.sh"
