#!/usr/bin/env bash
#
# neon-connection-test.sh
#
# Prompts for the Neon DATABASE_URL with hidden input, then attempts a single
# SELECT 1 with a 10-second hard timeout. Use this BEFORE the full migrations
# script to isolate connectivity / auth / SSL issues.
#
# Usage:
#   bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/neon-connection-test.sh"

set -eo pipefail

SOURCE="/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"

echo "==================================================="
echo " RayHealth — Neon connection sanity check"
echo "==================================================="
echo ""
echo "This will:"
echo "  1. Prompt for your DATABASE_URL (hidden input)"
echo "  2. Try a single SELECT 1 query with a 10s timeout"
echo "  3. Print a clear pass/fail message"
echo ""
echo "Paste the full Neon URL below:"
echo ""

read -rs NEON_URL
echo "(received)"
echo ""

if [ -z "$NEON_URL" ]; then
  echo "ERROR: empty URL. Aborting."
  exit 1
fi

# Sanity checks before we waste 10 seconds on a timeout
if [[ "$NEON_URL" != postgres://* && "$NEON_URL" != postgresql://* ]]; then
  echo "ERROR: URL must start with postgres:// or postgresql://"
  echo "       First 20 chars: $(echo "$NEON_URL" | head -c 20)..."
  exit 1
fi

if [[ "$NEON_URL" == *"<"* ]] || [[ "$NEON_URL" == *">"* ]] || [[ "$NEON_URL" == *"USER:PASS"* ]]; then
  echo "ERROR: URL still has placeholder text. Paste the real URL."
  exit 1
fi

if [[ "$NEON_URL" != *"sslmode=require"* ]]; then
  echo "WARNING: URL is missing ?sslmode=require — Neon requires SSL."
  echo "         If the connection fails, append &sslmode=require (or"
  echo "         ?sslmode=require if there's no query string yet) and retry."
  echo ""
fi

# Surface what host we're trying to reach (no auth info)
HOST=$(echo "$NEON_URL" | sed -nE 's|.*@([^:/?]+).*|\1|p')
if [ -n "$HOST" ]; then
  echo ">>> Target host: $HOST"
else
  echo "WARNING: could not parse host from URL"
fi
echo ""

echo ">>> Running SELECT 1 (10s timeout)…"
cd "$SOURCE"

# Inline TS using the existing knex setup. 10s timeout enforced via
# Promise.race so a hung connect doesn't sit forever.
DATABASE_URL="$NEON_URL" npx tsx -e "
import { createDb } from './packages/core/src/db/knex.js';
const db = createDb();
const timeout = new Promise((_resolve, reject) => {
  setTimeout(() => reject(new Error('Timed out after 10s — host likely unreachable or wrong')), 10_000);
});
const query = db.raw('SELECT 1 as ok').then((r) => r.rows ?? r);
try {
  const result = await Promise.race([query, timeout]);
  console.log('CONNECTION OK:', JSON.stringify(result));
  await db.destroy();
  process.exit(0);
} catch (err) {
  console.error('CONNECTION FAILED:', err.message);
  try { await db.destroy(); } catch {}
  process.exit(1);
}
"
