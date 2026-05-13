#!/usr/bin/env bash
#
# run-migrations-prompted.sh
#
# Prompts for the Neon DATABASE_URL with hidden input (no shell quoting
# headaches, no placeholder mistakes), then applies the 8 dated migrations.
#
# Usage:
#   bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/run-migrations-prompted.sh"

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"

echo "==================================================="
echo " RayHealth — Apply migrations to Neon"
echo "==================================================="
echo ""
echo "Get your connection string from:"
echo "  https://console.neon.tech/ → project → Dashboard → Connection Details"
echo ""
echo "It looks like:"
echo "  postgres://<user>:<pass>@ep-<host>.<region>.aws.neon.tech/neondb?sslmode=require"
echo ""
echo "Make sure 'Pooled connection' is toggled ON in the Neon dashboard."
echo ""
echo "Paste the full URL below (input is hidden, no characters will appear):"
echo ""

# Read with -s so zsh/bash don't echo the URL or try to interpret its specials.
read -rs NEON_URL
echo "(received)"
echo ""

if [ -z "$NEON_URL" ]; then
  echo "ERROR: empty URL. Aborting."
  exit 1
fi

if [[ "$NEON_URL" != postgres://* && "$NEON_URL" != postgresql://* ]]; then
  echo "ERROR: URL doesn't start with postgres:// or postgresql://."
  echo "       Got: $(echo "$NEON_URL" | head -c 20)..."
  exit 1
fi

if [[ "$NEON_URL" == *"<"* ]] || [[ "$NEON_URL" == *">"* ]] || [[ "$NEON_URL" == *"USER:PASS"* ]]; then
  echo "ERROR: URL still has placeholder text in it. Paste the real URL from Neon."
  exit 1
fi

echo ">>> Running migrations…"
cd "$SOURCE"
DATABASE_URL="$NEON_URL" npx tsx packages/core/scripts/apply-new-migrations.ts

echo ""
echo "Done. Look for 'ok: true' and every step status: ok above."
