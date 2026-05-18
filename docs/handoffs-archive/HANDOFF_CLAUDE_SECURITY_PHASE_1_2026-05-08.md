# Claude Handoff: Security Architecture Phase 1

Date: 2026-05-08
Branch: `codex/security-phase-1`
Workspace: `/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh`

## Mission

Brian asked Codex to design a security architecture for the RayHealth EVV apps while Claude worked other tasks, then to keep working on implementation. Brian has now asked Codex to stop so Claude can take over.

This handoff captures what is done, what is partially done, what is dirty in the worktree, and the safest next steps.

Important repo note: the Git root appears to be `/Users/durgaghimeray`, not only this project folder. Scope git commands carefully to this project and stage files explicitly.

## Architecture Docs Added

Committed:

- `7fcc8cb docs: add security architecture design`
- `8b06d0b docs: add security hardening implementation plan`

Files:

- `docs/superpowers/specs/2026-05-08-security-architecture-design.md`
- `docs/superpowers/plans/2026-05-08-security-architecture-phase-1.md`

The implementation plan frames Phase 1 around secure session handling, CSRF protection, structured audit persistence, mobile secure storage, and guardrail checks.

## Security Implementation Completed And Committed

Committed on `codex/security-phase-1`:

- `fc8ea1f add durable session repository`
- `0c55581 harden web auth with cookie sessions`
- `51f1c70 persist structured audit events`
- `f526abd move web auth to cookie sessions`
- `299b6af store mobile auth in secure storage`

Key outcomes:

- Added durable session domain/repository support in `packages/core`.
- Added `sessions` migration schema support.
- Added app cookie helpers and token hashing.
- Added CSRF middleware for cookie-authenticated protected routes.
- Updated app auth routes so web login creates an HttpOnly `rayhealth_session` cookie and CSRF token.
- Kept mobile auth separate: `/auth/mobile/login` returns a JWT for native clients.
- Updated `/auth/me` to support session auth and CSRF rotation.
- Updated auth context to prefer cookie session auth while retaining bearer fallback where needed.
- Added structured audit event repository support and persisted auth/audit events.
- Moved web client auth away from localStorage bearer tokens and into cookie-backed session state.
- Moved mobile token storage to `expo-secure-store`.

Domain/security notes:

- This is directionally correct for HIPAA: browser clients no longer keep bearer tokens in localStorage, cookie sessions are HttpOnly, CSRF is enforced for cookie-authenticated unsafe methods, and audit events move toward durable persistence.
- Live database migration still needs to be applied in the intended environment before relying on the new `sessions` and audit event persistence tables.
- Some repository tests intentionally skip DB-backed cases when no database/migration environment is configured.

## Other Commits Interleaved By Another Agent

Do not revert these unless Brian explicitly asks:

- `ce116c8 feat: expand PA compliance schema with caregivers, credentials, audit, exceptions`
- `bd1b70c feat: enrich landing page with stats, how-it-works, roles, compliance, FAQ`

These appear unrelated to Codex's security work.

## Current Uncommitted State

Intentional but not committed: Task 6 guardrails/check script work.

- `package.json`
- `scripts/security-surface-scan.ts`
- `scripts/check.sh`
- `packages/app/eslint.config.js`
- `packages/core/eslint.config.js`
- `packages/web/eslint.config.js`

What those changes do:

- Add root scripts:
  - `security:scan`: `tsx scripts/security-surface-scan.ts`
  - `check`: `./scripts/check.sh`
- Add a security scan that fails on web/mobile token storage regressions such as `rayhealth_token`, `localStorage.setItem('rayhealth_...`, and web bearer-token attachment patterns.
- Add a full validation wrapper running lint, typecheck, test, build, then security scan.
- Add minimal ESM ESLint flat configs for app/core/web because root lint failed without them.

Generated/build artifacts currently dirty. These should usually not be committed unless the project intentionally tracks them:

- `packages/app/.turbo/turbo-lint.log`
- `packages/app/.turbo/turbo-test.log`
- `packages/app/dist/...`
- `packages/app/tsconfig.tsbuildinfo`
- `packages/core/.turbo/turbo-lint.log`
- `packages/core/.turbo/turbo-test.log`
- `packages/core/tsconfig.tsbuildinfo`
- `packages/mobile/.turbo/turbo-build.log`
- `packages/web/.turbo/turbo-lint.log`
- `packages/web/tsconfig.tsbuildinfo`
- untracked generated files under `packages/app/dist/routes/...`

Unrelated landing work appears dirty/untracked and should not be touched by the security handoff:

- `packages/web/src/index.css`
- `packages/web/src/features/landing/HeroGraphic.tsx`
- `packages/web/.gitignore`

Also note: `scripts/` is showing as an untracked directory because of the unusual Git root/workspace setup. It contains both older docs scripts and the new security scripts. Stage only specific intended files.

## Verification Already Run

Passed:

- `npm --workspace @rayhealth/core run test -- --run src/__tests__/session-repository.test.ts`
- `npm --workspace @rayhealth/app run test`
- `npm --workspace @rayhealth/core run typecheck`
- `npm --workspace @rayhealth/web run test`
- `npm --workspace @rayhealth/mobile run lint`
- `npm --workspace @rayhealth/mobile run build`
- `npm run security:scan`

Known warning:

- Core DB repository test emitted a skip warning where no database/migration environment was available.

Failed before the latest guardrail edits:

- `./scripts/check.sh` failed at `npm run lint` because app/core/web lacked ESLint flat configs.

After that failure, Codex added:

- `packages/app/eslint.config.js`
- `packages/core/eslint.config.js`
- `packages/web/eslint.config.js`

Codex did not rerun `./scripts/check.sh` after adding those configs because Brian asked Codex to stop.

## Recommended Next Steps For Claude

1. Review the uncommitted Task 6 guardrail files.
2. Rerun `./scripts/check.sh`.
3. If lint/typecheck issues appear, fix only the intended source/config files.
4. Avoid staging generated `.turbo`, `dist`, or `tsconfig.tsbuildinfo` artifacts unless project policy intentionally tracks them.
5. Avoid touching or reverting the unrelated landing page work.
6. If the check script passes, commit the guardrail work with a focused message such as `add security regression checks`.
7. Continue from `docs/superpowers/plans/2026-05-08-security-architecture-phase-1.md`, likely Task 7 or PR finalization.

Suggested verification commands:

```bash
git branch --show-current
git status --short -- package.json package-lock.json scripts packages/app packages/core packages/web packages/mobile docs/superpowers
./scripts/check.sh
npm run security:scan
```

Suggested careful staging if Task 6 is accepted:

```bash
git add package.json scripts/security-surface-scan.ts scripts/check.sh packages/app/eslint.config.js packages/core/eslint.config.js packages/web/eslint.config.js
git status --short -- package.json scripts packages/app/eslint.config.js packages/core/eslint.config.js packages/web/eslint.config.js
git commit -m "add security regression checks"
```

Do not use broad `git add scripts/` or `git add .` from this repo state.

## Quick Mental Model Of The New Auth Boundary

- Web browser auth uses an HttpOnly session cookie named `rayhealth_session`.
- Unsafe cookie-authenticated requests require CSRF validation.
- Mobile native auth uses JWT returned by `/auth/mobile/login` and stored in Expo SecureStore.
- Server auth context accepts session cookies first, then bearer auth fallback.
- Audit persistence now has structured repository support instead of only process logging.

## Risks To Keep In Mind

- Migrations must be applied before deploying code that depends on durable sessions/audit events.
- CSRF behavior should be visually/API tested against real web login flows before production promotion.
- Mobile SecureStore behavior should be tested in Expo/iOS simulator for cold launch restore and logout clearing.
- `npm install` for `expo-secure-store` reported 4 moderate vulnerabilities; no audit fix was attempted.
- The Git root/workspace mismatch makes accidental staging easy. Be explicit.
