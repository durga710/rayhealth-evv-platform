#!/usr/bin/env bash
#
# sync-session6-to-bitbucket.sh
#
# Sync the security hardening + .github/ scaffold + doc consolidation work
# from the Desktop workspace into /tmp/rayhealth-combined and push to
# Bitbucket main. Run AFTER sync-session5-to-bitbucket.sh has landed
# (session 5 = feature work, session 6 = security + governance pass).
#
# Scope:
#   - Security hardening: helmet, JWT HS256 pinning, default+per-route rate
#     limits, json body size cap, CORS fail-closed in prod, sameSite=strict
#     cookies, console.log → process.stderr.write in runner
#   - .github/ scaffold: branch + tag rulesets, CI workflow (typecheck, lint,
#     security-scan, test-core, test-app, test-web), CodeQL, dependency
#     review, gitleaks secret scan, CODEOWNERS, PR + issue templates
#   - SECURITY.md, rewritten README.md
#   - Tightened security-surface-scan regex
#   - Stale handoff docs archived to docs/handoffs-archive/
#   - One-shot sync scripts archived to scripts/archive/
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

# Also pick up the migration script hardening (connection probe, timeouts,
# unhandled rejection handler) and knex timeouts that landed this session.
rsync_one "packages/core/src/db/knex.ts"
rsync_one "packages/core/scripts/apply-new-migrations.ts"

# ---------- .github/ scaffold ----------
rsync_one ".github"

# ---------- Top-level docs ----------
rsync_one "README.md"
rsync_one "SECURITY.md"
rsync_one "DEPLOY_NOW.md"
rsync_one "PROJECT_STATUS.md"

# ---------- New + updated scripts ----------
rsync_one "scripts/deploy.sh"
rsync_one "scripts/run-migrations-prompted.sh"
rsync_one "scripts/neon-connection-test.sh"
rsync_one "scripts/sync-session5-to-bitbucket.sh"
rsync_one "scripts/sync-session5-to-github.sh"
rsync_one "scripts/sync-session6-to-bitbucket.sh"

# ---------- Archive folders (handoffs + old sync scripts) ----------
rsync_one "docs/handoffs-archive"
rsync_one "scripts/archive"

# ---------- Stale docs at root deleted in this session ----------
# These were moved to docs/handoffs-archive/; remove them from the canonical
# repo too so they don't keep haunting reviewers.
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

for stale_script in \
  scripts/combine-mobile-into-bitbucket.sh \
  scripts/commit-2026-05-11.sh \
  scripts/extract-to-standalone-repo.sh \
  scripts/recover-and-push.sh \
  scripts/sync-session-work-to-bitbucket.sh \
  scripts/sync-session2-to-bitbucket.sh \
  scripts/sync-session3-to-bitbucket.sh \
  scripts/sync-session4-to-bitbucket.sh ; do
  if [ -f "$TARGET/$stale_script" ]; then
    git rm "$TARGET/$stale_script" 2>/dev/null || rm "$TARGET/$stale_script"
    echo "    rm  : $stale_script (now in scripts/archive/)"
  fi
done

echo ""
echo ">>> Step 3: Stage and commit"
git add -A

if git diff --cached --quiet; then
  echo "    Nothing staged — repo already in sync."
else
  git commit -m 'feat(session6): security hardening + .github governance + doc consolidation

Production-grade security pass closing every High/Medium finding from a
SOC 2 / HIPAA-aligned senior-engineer review of the session 5 surface.

Security hardening (packages/app):
- helmet() with HSTS (1yr + preload + subdomains), CSP defaults to
  default-src none and frame-ancestors none, X-Frame-Options DENY,
  Referrer-Policy no-referrer, Cross-Origin-Resource-Policy same-site.
- JWT algorithm pinned to HS256 on every jwt.verify (auth-context) and
  every jwt.sign site (auth/login, auth/bootstrap, invite-acceptance,
  test-helpers). Closes alg=none and RS256-to-HS256 key confusion.
- express.json({ limit: 100kb }) — explicit cap instead of framework
  default drift; protects against JSON-bomb DoS.
- Default authenticated rate limiter (300/15min) layered with tighter
  per-route limits: /copilot (40/15min, LLM cost), /admin/audit-retention
  (30/15min, admin-only). authLimiter + inviteAcceptanceLimiter unchanged.
- ALLOWED_ORIGINS fail-closed in production — createApp throws if env
  var is missing instead of silently defaulting to localhost:5173.
- app.set("trust proxy", 1) so req.ip reflects the real client behind
  the Vercel proxy (used by rate limiters and audit ip_address field).
  Bounded at one hop to prevent X-Forwarded-For spoofing.
- Session cookies sameSite: strict (was lax). The admin UI has no
  legitimate top-level navigation from third-party origins; strict
  prevents even GET-based CSRF on edge cases.

Migration script resilience (packages/core):
- buildDbConfig now sets acquireConnectionTimeout=15s and a pool with
  acquireTimeoutMillis, createTimeoutMillis, destroyTimeoutMillis,
  idleTimeoutMillis configured. Failed connects fail fast with a real
  error instead of hanging on the 60s knex default.
- apply-new-migrations.ts probes the connection with SELECT 1 before
  the migration loop, prints actionable error hints (cold start,
  channel_binding, sslmode, pooled toggle) on failure, and installs an
  unhandledRejection handler that filters benign tarn aborted errors
  during pool destroy so they do not pre-empt the JSON output on
  successful runs.
- runner.ts: console.log -> process.stderr.write to match the codebase
  no-console-in-prod rule; safer error narrowing.

.github/ governance scaffold:
- workflows/ci.yml — six required status checks (typecheck, lint,
  security-scan, test-core, test-app, test-web), Node 22, npm cache,
  cancel-in-progress concurrency, read-only default permissions.
- workflows/codeql.yml — javascript-typescript security-extended +
  security-and-quality, runs on push, PR, and weekly Monday cron.
- workflows/dependency-review.yml — fails PR on high+ CVE or GPL/AGPL
  license introduction.
- workflows/secret-scan.yml — gitleaks on PR + push + manual dispatch,
  full history depth so older leaked credentials surface.
- rulesets/main-branch-protection.json — block deletion, block
  force-push, require linear history, require PR with 1 code-owner
  approval, dismiss stale reviews on push, require last-push approval,
  require thread resolution, require all 6 status checks (strict),
  enforce Conventional Commits via regex. No bypass actors (even the
  owner must PR).
- rulesets/tags-protection.json — block deletion, force-push, and
  updates on every tag so release tags are immutable.
- rulesets/README.md — gh api commands + dashboard instructions.
- CODEOWNERS — owner gates security-sensitive paths (routes,
  middleware, security, domain, repositories, migrations, auth UI,
  agency settings UI, compliance docs, SECURITY.md, .github).
- PULL_REQUEST_TEMPLATE.md with HIPAA + security + test checklist.
- ISSUE_TEMPLATE/bug_report.md + config.yml — routes security to
  private advisory, redirects HIPAA concerns to email.

Top-level docs:
- SECURITY.md — disclosure policy, 7-day-fix SLA for sev-1, scope,
  HIPAA-aligned posture summary, reporter acknowledgments stub.
- README.md rewritten — was stale "Legal Onboarding & Hiring Templates"
  boilerplate from a prior product direction; now describes the actual
  EVV platform, workspace layout, quickstart, architecture mental
  model, compliance posture, contribution gates.
- Security surface scan regex tightened: now catches both rayhealth_
  AND rayhealth. localStorage/sessionStorage keys (the dot variant
  dodged the prior regex).

Consolidation:
- 7 stale handoff docs moved to docs/handoffs-archive/ with provenance
  README pointing readers to PROJECT_STATUS.md as the canonical source.
- 8 one-shot sync scripts moved to scripts/archive/ with provenance
  README. Active scripts at scripts/ are now just: check.sh, deploy.sh,
  neon-connection-test.sh, run-migrations-prompted.sh,
  sync-session5-to-bitbucket.sh, sync-session5-to-github.sh,
  sync-session6-to-bitbucket.sh, security-surface-scan.ts.

Tests + gates after this session:
- 197 tests across 41 files (74 core / 109 app / 14 web), all green.
- Typecheck clean, lint clean (0 errors, 0 warnings), security:scan
  passes. helmet resolves cleanly.' || true
fi

echo ""
echo ">>> Step 4: Push to Bitbucket"
git push origin main

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://bitbucket.org/rayhealthevv/rayhealthevv/commits/branch/main"
echo ""
echo "Next:"
echo "  - Mirror to GitHub: bash scripts/sync-session5-to-github.sh"
echo "    (the same /tmp/rayhealth-combined main → github main script)"
echo "  - Apply GitHub rulesets after the push lands:"
echo "      gh api --method POST -H 'Accept: application/vnd.github+json' \\"
echo "        /repos/durga710/rayhealth-evv-platform/rulesets \\"
echo "        --input .github/rulesets/main-branch-protection.json"
echo "      gh api --method POST -H 'Accept: application/vnd.github+json' \\"
echo "        /repos/durga710/rayhealth-evv-platform/rulesets \\"
echo "        --input .github/rulesets/tags-protection.json"
