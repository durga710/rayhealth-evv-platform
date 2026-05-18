# Script archive

One-shot helper scripts from earlier sessions. They've served their purpose (initial Bitbucket recovery, mobile subtree combine, dated commits, sessions 1–4 sync). Kept for forensic reference, not for re-execution.

**Current canonical scripts are at `scripts/`** at the repo root:
- `deploy.sh` — prompted end-to-end deploy walker
- `sync-session5-to-bitbucket.sh` — sync this-session work to Bitbucket
- `sync-session5-to-github.sh` — mirror to GitHub (where Vercel watches)
- `run-migrations-prompted.sh` — apply migrations with hidden-input URL prompt
- `neon-connection-test.sh` — pre-migration connectivity probe
- `security-surface-scan.ts` — regression gate, runs in CI
- `check.sh` — local "run everything" gate (lint + typecheck + tests + security:scan)

Update 2026-05-12: sync-session5-to-github.sh archived alongside its Bitbucket sibling — session 6 introduced sync-session6-to-github.sh which rsyncs new files AND pushes to GitHub in one step, superseding both.
