# RayHealth EVV Platform Readiness

Last updated: 2026-05-09

This document keeps the product story, demo behavior, and compliance posture aligned while the platform is still early. It is not legal advice; verify state requirements with counsel and the current Pennsylvania DHS/CMS materials before production go-live.

## Reference Sources

- CMS EVV guidance: https://www.medicaid.gov/medicaid/home-community-based-services/guidance/electronic-visit-verification-evv
- Pennsylvania DHS EVV provider page: https://www.pa.gov/agencies/dhs/resources/for-providers/evv.html
- HHS HIPAA Security Rule overview: https://www.hhs.gov/hipaa/for-professionals/security/index.html

## Current Working Story

- The web app is a Pennsylvania-focused EVV and home-care operations portal.
- The landing page should describe credible workflows: credential-first staffing, authorization-aware scheduling, caregiver EVV capture, exception review, and audit evidence.
- The admin app currently relies on `/api/*` web calls, so Express must keep `/api` route compatibility in addition to root-mounted routes.
- Session auth uses HttpOnly cookies and CSRF tokens for the web flow; bearer JWT remains available for mobile/tests.
- Audit middleware records protected writes and PHI-sensitive client reads, including actor, agency, resource, request path, status, and outcome.

## Messaging Guardrails

- Prefer "HIPAA-aware", "audit-ready workflow", and "Pennsylvania-focused" until production controls are independently reviewed.
- Do not claim state certification, Sandata certification, or complete HIPAA compliance without evidence packets and legal review.
- Be explicit that Pennsylvania is the first operating profile; other states need dedicated policy profiles before launch.
- Avoid marketing copy that implies EVV submission is live until aggregator export, rejection handling, and maintenance workflows are fully implemented and tested.

## Feature Readiness

| Area | Current status | Next implementation target |
| --- | --- | --- |
| Login/session security | Working web session pattern with CSRF and secure cookie helpers | Complete demo credential seeding and environment documentation |
| Admin API routing | `/api` route compatibility added for web/Vercel calls | Keep new web fetches behind the same `/api` prefix |
| Agency setup | Read-only demo data; save path is not production-ready | Persist agency updates with validation, audit context, and PA-only state guardrails |
| Staff/invites | Invite endpoint returns pending invite response | Persist invites, enforce role validation, expiration, and invited-by audit data |
| Clients/authorizations | Basic create/list paths exist | Add stronger validation, payer/service-code checks, and safer PHI display patterns |
| Templates/assignments | Basic template and assignment workflows exist | Enforce caregiver eligibility and authorization date/unit constraints before assignment |
| EVV review | Basic visit list and maintenance approval hooks exist | Scope visits by agency, expose exception reasons, and avoid synthetic correction timestamps |
| Aggregator submission | Not implemented | Design Sandata/PROMISe export records, rejection queues, and evidence retention |
| Mobile caregiver flow | Directionally represented in product story | Verify offline queue, location accuracy handling, and caregiver assignment sync |

## Documentation Priorities

- Add an operator quickstart that explains local setup, required environment variables, demo users, and safe test data.
- Add a compliance evidence map that links each EVV/HIPAA control to code, tests, screenshots, and open gaps.
- Add a feature status page that clearly marks demo-only, partially implemented, and production-ready workflows.
- Add state-policy profile documentation before expanding beyond Pennsylvania.

## QA Checklist

Run focused checks after changes:

```bash
npm run test --workspace=@rayhealth/web
npm run test --workspace=@rayhealth/app
npm run typecheck --workspace=@rayhealth/web
npm run typecheck --workspace=@rayhealth/app
```

Run the full repository gate before merging:

```bash
./scripts/check.sh
```
