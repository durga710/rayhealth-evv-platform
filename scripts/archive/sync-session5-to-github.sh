#!/usr/bin/env bash
#
# sync-session5-to-github.sh
#
# Push this session's work to GitHub at github.com/durga710/rayhealth-evv-platform
# instead of Bitbucket. Required path when Vercel is on the Hobby plan, which
# does not support private Bitbucket workspace repos.
#
# Strategy:
#   - Reuse the same /tmp/rayhealth-combined working dir that the Bitbucket
#     sync scripts use, so we don't duplicate the rsync work.
#   - Add `github` as a second remote pointing at the GitHub repo.
#   - Push main → github/main.
#
# Idempotent. Safe to re-run.
#
# Pre-flight:
#   1. You must have SSH or HTTPS auth to push to github.com/durga710/*.
#      Easiest: `gh auth login` (GitHub CLI) or an SSH key registered at
#      https://github.com/settings/keys.
#   2. The GitHub repo's `main` branch may already have older session work
#      (commit 98d81d8). This script will push with `--force-with-lease` so
#      stale GitHub commits get overwritten by the canonical Bitbucket main.
#      THAT IS DESTRUCTIVE — review the diff in your terminal before pushing
#      if you're not sure.

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
TARGET="/tmp/rayhealth-combined"
GITHUB_REMOTE="git@github.com:durga710/rayhealth-evv-platform.git"

if [ ! -d "$TARGET/.git" ]; then
  echo "ERROR: $TARGET is not a git repo. Run the Bitbucket sync first"
  echo "       (sync-session5-to-bitbucket.sh) to populate it, then re-run"
  echo "       this script to push to GitHub."
  exit 1
fi

cd "$TARGET"

echo ">>> Step 1: Make sure local main is on the latest Bitbucket commit"
git checkout main
git pull --ff-only origin main || git pull origin main

echo ""
echo ">>> Step 2: Ensure github remote exists and points at $GITHUB_REMOTE"
if git remote get-url github >/dev/null 2>&1; then
  CURRENT="$(git remote get-url github)"
  if [ "$CURRENT" != "$GITHUB_REMOTE" ]; then
    echo "    updating github remote: $CURRENT → $GITHUB_REMOTE"
    git remote set-url github "$GITHUB_REMOTE"
  else
    echo "    github remote already set"
  fi
else
  echo "    adding github remote"
  git remote add github "$GITHUB_REMOTE"
fi

echo ""
echo ">>> Step 3: Fetch GitHub state to compute the lease"
git fetch github main 2>/dev/null || echo "    (github/main may not exist yet — first push will create it)"

echo ""
echo ">>> Step 4: Show what will land on github/main"
if git rev-parse --verify github/main >/dev/null 2>&1; then
  echo "    Commits on local main NOT on github/main:"
  git log --oneline github/main..main | head -50
  echo ""
  echo "    Commits on github/main NOT on local main (will be overwritten):"
  git log --oneline main..github/main | head -50 || true
else
  echo "    First push to github/main."
fi

echo ""
echo ">>> Step 5: Push to GitHub with --force-with-lease (safe overwrite)"
echo "    This is DESTRUCTIVE if github/main has commits not on local main."
echo "    Ctrl+C now to abort."
sleep 3

if ! git push github main --force-with-lease; then
  cat <<'EOF'

ERROR: GitHub push failed. Most likely cause: no auth credentials.

Three fixes, pick whichever is easiest:

  1) GitHub CLI (recommended — handles OAuth via browser):
       brew install gh
       gh auth login           # pick HTTPS + browser auth
       cd /tmp/rayhealth-combined
       git remote set-url github https://github.com/durga710/rayhealth-evv-platform.git
       bash "$0"               # re-run this script

  2) SSH key:
       # If you have ~/.ssh/id_ed25519.pub or id_rsa.pub already, paste it at:
       #   https://github.com/settings/keys
       # Verify with: ssh -T git@github.com  (should greet "Hi durga710!")
       # Then re-run this script.

  3) HTTPS + Personal Access Token:
       # Generate token at https://github.com/settings/tokens (scope: repo)
       cd /tmp/rayhealth-combined
       git remote set-url github https://github.com/durga710/rayhealth-evv-platform.git
       git push github main --force-with-lease
       # When prompted for password, paste the PAT.

EOF
  exit 1
fi

echo ""
echo "=== Done ==="
git log --oneline -5
echo ""
echo "Verify: https://github.com/durga710/rayhealth-evv-platform/commits/main"
echo ""
echo "Vercel should auto-trigger a production deploy from this push."
echo "Watch: https://vercel.com/dashboard → RayHealth project → Deployments"
