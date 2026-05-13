#!/usr/bin/env bash
#
# combine-mobile-into-bitbucket.sh
#
# Merges the rayhealth-evv-mobile repo into the Bitbucket-tracked
# rayhealthevv/rayhealthevv repo under packages/mobile-capacitor/.
# Preserves the mobile repo's full commit history via `git subtree add`.
#
# Why packages/mobile-capacitor (not packages/mobile):
#   The existing packages/mobile is the older Expo placeholder (2 screens,
#   not deployed). Adding the Capacitor app side-by-side as
#   packages/mobile-capacitor lets you decide later whether to remove the
#   placeholder. Renaming keeps both paths buildable in the meantime.
#
# What this script does:
#   1. Fresh-clones the Bitbucket repo into /tmp/rayhealth-combined
#   2. Adds the local mobile repo as a git remote
#   3. Runs `git subtree add` to import the mobile history into packages/mobile-capacitor/
#   4. Pushes the combined repo back to Bitbucket main
#
# Run from anywhere:
#   bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/combine-mobile-into-bitbucket.sh"

set -euo pipefail

WORK_DIR="/tmp/rayhealth-combined"
MOBILE_LOCAL="/Users/durgaghimeray/Documents/rayhealth-evv-mobile"
BITBUCKET="git@bitbucket.org:rayhealthevv/rayhealthevv.git"
SUBTREE_PREFIX="packages/mobile-capacitor"

echo ">>> Step 1: clean any prior attempt"
rm -rf "$WORK_DIR"

echo ">>> Step 2: clone Bitbucket fresh into $WORK_DIR"
git clone "$BITBUCKET" "$WORK_DIR"
cd "$WORK_DIR"

echo ">>> Step 3: confirm we're on main"
git checkout main
echo "    HEAD: $(git rev-parse --short HEAD) on $(git branch --show-current)"

echo ">>> Step 4: verify mobile repo exists locally"
if [ ! -d "$MOBILE_LOCAL/.git" ]; then
  echo "ERROR: $MOBILE_LOCAL is not a git repository (or doesn't exist)"
  echo "If the mobile repo lives at a different path, edit MOBILE_LOCAL at the top of this script."
  exit 1
fi

MOBILE_BRANCH="$(git -C "$MOBILE_LOCAL" branch --show-current)"
if [ -z "$MOBILE_BRANCH" ]; then
  echo "ERROR: could not detect mobile repo's current branch"
  exit 1
fi
MOBILE_HEAD="$(git -C "$MOBILE_LOCAL" rev-parse --short HEAD)"
echo "    mobile branch: $MOBILE_BRANCH @ $MOBILE_HEAD"

echo ">>> Step 5: add mobile as a remote in the combined repo"
git remote add mobile "$MOBILE_LOCAL"
git fetch mobile

echo ">>> Step 6: subtree add (preserves full mobile history)"
echo "    target: $SUBTREE_PREFIX/"
echo "    source: mobile/$MOBILE_BRANCH"
git subtree add --prefix="$SUBTREE_PREFIX" "mobile/$MOBILE_BRANCH"

echo ">>> Step 7: verify the combine worked"
echo ""
echo "    Top of new history:"
git log --oneline -5
echo ""
echo "    Files in $SUBTREE_PREFIX (first 20):"
ls -la "$SUBTREE_PREFIX" 2>/dev/null | head -20
echo ""
echo "    Commits brought in from mobile (count):"
git log --oneline "mobile/$MOBILE_BRANCH" 2>/dev/null | wc -l

echo ""
echo ">>> Step 8: push combined repo to Bitbucket"
git push origin main

echo ""
echo "=== Done ==="
echo ""
echo "Combined repo lives at $WORK_DIR — Bitbucket main now contains the"
echo "platform monorepo + the Capacitor mobile app under packages/mobile-capacitor/."
echo ""
echo "Next moves:"
echo "  - Verify on bitbucket.org/rayhealthevv/rayhealthevv/src/main/"
echo "  - Decide whether to remove the existing packages/mobile (Expo placeholder)"
echo "  - Update package.json workspaces if needed (packages/* should already cover the new dir)"
echo "  - Open the combined repo in your editor:"
echo "      open -a 'Visual Studio Code' $WORK_DIR"
