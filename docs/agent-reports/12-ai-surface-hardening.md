# Agent 12 - AI Surface Hardening

**Authored by Durga Ghimeray**

## Scope

Implemented the next engineering phase after the final product judgment: close the remaining AI-surface hardening items that were still open after the audit-read coverage, audit taxonomy, README Expo correction, and deployment build-command fixes had already landed.

## Changes Completed

- Admin assistant no longer stores verbatim admin/user transcript text in `support_conversations`.
- Admin assistant stored conversation rows now contain only redacted hash/length envelopes and no IP address.
- Admin assistant writes an append-only `copilot.query` audit event before returning the assistant response.
- Admin assistant `list_open_exceptions` now counts only unresolved exceptions with `e.approved_at is null`.
- Command Center AI briefings now write append-only `copilot.query` audit events with prompt/response hash and length metadata.
- Copilot confirmed actions now write the `copilot.action.confirmed` audit event before execution. If the audit write fails, execution is not attempted.
- Admin assistant and Command Center routes are mounted behind the same tight AI-cost limiter used for Copilot.
- Trust Center copy now states that admin-assistant transcript text is not retained.

## Tests Added

- `packages/app/src/routes/__tests__/admin-assistant-routes.test.ts`
- `packages/app/src/routes/__tests__/copilot-routes.test.ts`

Updated:

- `packages/app/src/routes/__tests__/command-center-routes.test.ts`
- `packages/web/src/features/marketing/site/TrustCenterPage.test.tsx`

## Verification

- `npm run build --workspace=@rayhealth/core` - pass
- `npm run typecheck --workspace=@rayhealth/app` - pass
- `npm run lint --workspace=@rayhealth/app` - pass
- `npm run build --workspace=@rayhealth/app` - pass
- `npm run test --workspace=@rayhealth/app -- --pool=threads` - pass, 39 files, 273 passed, 1 skipped
- `npm run typecheck --workspace=@rayhealth/web` - pass
- `npm run lint --workspace=@rayhealth/web` - pass
- `npm run test --workspace=@rayhealth/web -- --pool=threads` - pass, 17 files, 52 passed
- `npm run security:scan` - pass
- `git diff --check` - pass

## Remaining Before Real PHI

Operational/legal controls remain the real-PHI gate: executed customer and vendor BAAs, HIPAA-eligible hosting posture, formal risk analysis, third-party penetration test, cyber-liability insurance, operationalized incident response/backup/workforce/logging policies, subprocessor review, and production monitoring/alerting.
