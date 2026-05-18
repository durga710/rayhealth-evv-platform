#!/usr/bin/env bash
#
# extract-to-standalone-repo.sh
#
# Cleanly extracts /Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh
# into a self-contained git repo at /tmp/rayhealth-standalone with only this
# project's history. The original $HOME repo is left untouched.
#
# After this runs successfully you can `cd /tmp/rayhealth-standalone`, add a
# Bitbucket remote, and push without exposing the rest of your home directory.

set -euo pipefail

EXTRACT_DIR="/tmp/rayhealth-standalone"
SUBDIR="Desktop/rayhealthevv-fresh/rayhealth-fresh"

echo ">>> Step 1: clean up any prior attempt"
rm -rf "$EXTRACT_DIR"
rm -rf /tmp/rayhealth-extract

echo ">>> Step 2: clone \$HOME into $EXTRACT_DIR"
git clone --no-local "$HOME" "$EXTRACT_DIR"

echo ">>> Step 3: filter to just the project subdirectory"
cd "$EXTRACT_DIR"
git filter-repo --subdirectory-filter "$SUBDIR"

echo ">>> Step 4: verify the extraction"
echo "--- pwd ---"
pwd
echo "--- git log (top 5) ---"
git log --oneline -5
echo "--- ls (top level — should show packages/, docs/, etc — NOT .aws/, .codex/) ---"
ls -la | head -20

echo ""
echo ">>> Done. If the ls above shows packages/, docs/, PROJECT_STATUS.md etc,"
echo ">>> the extraction worked. Continue with:"
echo "    cd $EXTRACT_DIR"
echo "    git remote add origin git@bitbucket.org:<YOUR-WORKSPACE>/rayhealth-evv.git"
echo "    git push -u origin codex/security-phase-1"
