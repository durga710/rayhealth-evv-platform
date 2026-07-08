# Agent 15 - Analytics Privacy CI Guard

**Authored by Durga Ghimeray**

## Scope

Closed a remaining guardrail gap from the security review: Vercel Analytics was
already wired through `dropAuthenticatedEvents`, but `security:scan` did not
fail if a future change mounted analytics without the privacy gate.

## Changes Completed

- Extended `scripts/security-surface-scan.ts` to keep Vercel Analytics
  centralized in `packages/web/src/main.tsx`.
- Added a scanner assertion that the Analytics mount imports
  `dropAuthenticatedEvents`.
- Added a scanner assertion that the Analytics mount uses
  `beforeSend={dropAuthenticatedEvents}` so authenticated route paths with
  entity identifiers are dropped before they reach Vercel Analytics.

## Verification

- `npm run security:scan` - pass.
- `npm run test --workspace=@rayhealth/web -- analytics.test.ts --pool=threads`
  - pass, 1 file / 5 tests. The first sandboxed attempt hit a Vitest config
  access-denied error; the escalated rerun passed.

## Remaining

- Operational/legal controls remain the real-PHI gate: Vercel, Google Firebase
  / Cloud, and Resend BAAs; formal risk analysis; third-party penetration
  test; cyber-liability insurance; policy rehearsal; and dedicated production
  monitoring/alerting evidence.
