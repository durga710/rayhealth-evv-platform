# Agent 06 — Audit Packet

**Authored by Durga Ghimeray**

---

Implementation phase (Sonnet) for the MVP EVV Audit Packet feature, built exactly to `docs/agent-reports/06-audit-packet-architecture.md`. No redesign — this document records what was built, the final contract as shipped, and full verification results.

## 1. Files created

| File | Purpose |
|---|---|
| `packages/app/src/routes/audit-packet-routes.ts` | `GET /:visitId` — assembles and returns the packet. |
| `packages/app/src/routes/__tests__/audit-packet-routes.test.ts` | Backend tests 1–12 (§6.1 of the spec). |
| `packages/core/src/__tests__/evv-exception-repository.test.ts` | New suite for `findExceptionsByVisitForAgency` (test 15). |
| `packages/web/src/features/compliance-engine/AuditPacketPage.tsx` | Print-friendly packet viewer + visit-id lookup form. |
| `packages/web/src/features/compliance-engine/AuditPacketPage.test.tsx` | Frontend tests 16–20 (minus route-gating, covered by `App.tsx`'s existing `AdminRoute`). |

## 2. Files modified

| File | Change |
|---|---|
| `packages/core/src/domain/evv.ts` | Added `hhaexchangeStatus` / `hhaexchangeConfirmationId` to `evvVisitSchema` (lines 41–43) — the columns already existed and were already written by `EvvRepository.markHhaexchangeSubmission`, just never read back. |
| `packages/core/src/repositories/evv-repository.ts` | `mapRowToVisit` now maps the two new columns (lines 309–310). |
| `packages/core/src/repositories/audit-event-repository.ts` | Added `findByEntityForAgency(agencyId, entityType, entityId)` (line 69) — agency-scoped sibling of the unscoped `findByEntity`. |
| `packages/core/src/repositories/visit-maintenance-repository.ts` | Added `findByVisitIdForAgency(visitId, agencyId)` (line 102); extended `mapRowToMaintenance` to surface `reasonCategoryCode`, `correctionCode`, `originatorRole`, `originalStartTime/EndTime`, and the signature-attestation fields, which existed as columns but were never mapped. |
| `packages/core/src/repositories/evv-exception-repository.ts` | Added `findExceptionsByVisitForAgency(visitId, agencyId)` (line 35). |
| `packages/core/src/repositories/client-repository.ts` | Added `getClientNameForAgency(clientId, agencyId)` (line 97) — id + first/last name only, never the full client row. |
| `packages/core/src/repositories/schedule-repository.ts` | Added `getAssignmentScheduleForAgency(assignmentId, agencyId)` (line 95) — scheduled start/end only. |
| `packages/app/src/app.ts` | Imported and mounted the router: `app.use('${prefix}/admin/audit-packet', adminAuditLimiter, auditPacketRoutes)`, alongside `/admin/audit-events`. |
| `packages/web/src/App.tsx` | Lazy-imported `AuditPacketPage`; added routes `audit-packet` and `audit-packet/:visitId` under the existing admin-only `Audit` nav group (`allowedRoles: ['admin']`); added the sidebar link next to Audit Events. |
| `packages/web/src/index.css` | Added `@media print` rules (packet-focused): hides sidebar/mobilebar/scrim/AdminAssistant/`.no-print` controls, forces a light surface, keeps `.section-card`s from breaking across pages, and shows a fixed running header (`.audit-packet__print-header`) with agency/visit/generated-at/hash on every printed page. |
| `packages/web/src/features/evv/VisitReviewPage.tsx` | Added an "Audit packet" deep-link per row → `/admin/audit-packet/:visitId` (spec's optional, low-cost item). |
| `packages/web/src/features/evv/VisitReviewPage.test.tsx` | Wrapped in `<MemoryRouter>` — required once the page renders a react-router `<Link>`. |
| `packages/core/src/__tests__/audit-event-repository.test.ts` | Extended with a `findByEntityForAgency` scoping test. |
| `packages/core/src/__tests__/visit-maintenance-tenant-isolation.test.ts` | Extended with a `findByVisitIdForAgency` scoping + name-join test. |

## 3. Response contract as built

Matches architecture §3.3 exactly — `packet`, `visit`, `caregiver`, `client`, `curesActElements`, `geofence.{clockIn,clockOut}`, `exceptions[]`, `corrections[]`, `auditEvents[]`, `aggregator`. Every field is mapped individually in `audit-packet-routes.ts` (`visitPayload`, `caregiverPayload`, `clientPayload`, `exceptionsPayload`, `correctionsPayload`, `auditEventsPayload`, `aggregatorPayload`) — no repository row is ever spread into the response.

Errors: `400 { message: 'Valid visit id is required' }` (bad UUID) · `403 { message: 'Forbidden' }` (via `requireCapability`) · `404 { message: 'Visit not found' }` (missing or cross-tenant, identical body/status) · `500 { message: 'Internal Server Error' }` (including audit-write failure).

## 4. PHI-exclusion, agency-scoping, and audit-on-generate — how they're enforced

- **No raw GPS ever crosses the API.** `deriveGeofence()` (`audit-packet-routes.ts` lines ~90–120) takes the raw `{lat,lng,accuracy}` internally and returns only `{captured, accuracyM, result, distanceM, allowedM}`. `checkGeofence`/`haversineMeters` (from `@rayhealth/core`) are used only inside this function; the raw location objects are never assigned into any response field. Test: PHI-exclusion suite asserts the JSON body contains no `"lat"`, `"lng"`, `clockInLocation`, `clockOutLocation`, or the seeded coordinate literal.
- **No raw audit payloads.** `auditEventsPayload` maps each event to `{id, eventType, entityType, outcome, actorId, actorType, occurredAt, payloadSha256}` via `sha256OfCanonicalJson(e.payload ?? {})` (line ~199) — `payload` itself is never assigned onto the response object.
- **Minimum-necessary parties.** `caregiverPayload`/`clientPayload` are `{id, name}` built from `CaregiverRepository.findById` (existing) and the new `ClientRepository.getClientNameForAgency` — never the full caregiver/client row (no email, phone, NPI, address, DOB, Medicaid number).
- **Every sub-collection read is agency-scoped**, called only through the new scoped methods:
  - `AuditEventRepository.findByEntityForAgency(agencyId, entityType, entityId)` — used three times (`evv.visit`/visitId, `evv.clock-out`/visitId, `evv.clock-in`/assignmentId) at lines 163–165. The unscoped `findByEntity` is never imported/called in this route.
  - `VisitMaintenanceRepository.findByVisitIdForAgency(visitId, agencyId)` and `EvvExceptionRepository.findExceptionsByVisitForAgency(visitId, agencyId)` both join through `evv_visits → caregivers.agency_id`.
  - `agencyId` is read exclusively from `req.auth.agencyId` — never from params/query/body.
  - 404 parity: `EvvRepository.getVisitByIdForAgency` returns `null` for both "doesn't exist" and "belongs to another agency"; the route returns the identical `{message: 'Visit not found'}` body/status either way (test 3 asserts deep-equality between the two cases).
- **`phi.export` audit event is mandatory and fail-closed** (route lines ~275–291): the write happens via `auditRepo.create(...)` *before* `res.json(...)`, outside any try/catch that would swallow it — if it throws, the outer route-level `try/catch` returns `500` and the packet is never sent (test 9). The event's `payload.integritySha256` ties the log row to the exact packet produced (test 8). A 404 returns before this write runs, so no `phi.export` row is created for a failed lookup.
- **Integrity hash.** `sha256OfCanonicalJson()` (canonical = recursively key-sorted JSON) hashes the full response body minus `packet.integritySha256` itself; `packet.generatedAt/generatedBy/agencyId` are included, so two generations of an unchanged visit differ only in `generatedAt` and the hash (test 10).
- **Capability + rate limit.** `requireCapability('audit.read')` (admin-only per `ROLE_CAPABILITIES`) gates the route; it's mounted under the same `adminAuditLimiter` (30/15 min) as `/admin/audit-events` and `/admin/audit-retention`.

## 5. Tests added

- **Backend** (`audit-packet-routes.test.ts`, 20 individual tests covering the 12 spec test cases — some split into sub-cases, e.g. one `it` per role / per geofence state): capability gating (coordinator/caregiver/family → 403, admin → 200), cross-tenant 404, nonexistent 404 (deep-equal), invalid-id 400, full response-shape assembly, PHI-exclusion string assertions, all four geofence-derivation states, audit-log-on-generate (+ none-on-404), fail-closed on audit-write throw, integrity-hash recompute + generatedAt-only diff across two calls, cross-agency audit-event exclusion, and a real rate-limit-mount test (temporarily flips `NODE_ENV`/`ALLOWED_ORIGINS` to exercise `adminAuditLimiter` for real and asserts a `429` after 31 requests).
- **Core** (repository unit tests, DB-optional — skip gracefully with a console warning when no DB is reachable, matching this suite's existing convention): `findByEntityForAgency` scoping (extended `audit-event-repository.test.ts`), `findByVisitIdForAgency` scoping + requester/approver name join (extended `visit-maintenance-tenant-isolation.test.ts`), and a new `evv-exception-repository.test.ts` for `findExceptionsByVisitForAgency` scoping.
- **Frontend** (`AuditPacketPage.test.tsx`, 7 tests): full-section render from a mocked response with the integrity hash visible, loading skeleton, `ErrorRetry` + working retry on non-404 failure, `EmptyState` on 404, no raw lat/lng-shaped strings in the DOM, `window.print()` invoked by the Print button, and the visit-id lookup form when no `:visitId` param is present. Route admin-gating is inherited from `App.tsx`'s existing `AdminRoute`/`ADMIN_ROLES` wrapper (not re-tested per-route, consistent with sibling pages like `AuditEventsPage`).

No existing test was deleted or weakened; `VisitReviewPage.test.tsx` was updated only to wrap the render in `<MemoryRouter>`, required because the page now renders a react-router `<Link>`.

## 6. Verification results

| Step | Command | Result |
|---|---|---|
| 1 | `npm run build --workspace=@rayhealth/core` | **Pass** |
| 2 | `npx tsc --noEmit -p packages/core/tsconfig.json` | **Pass** — no errors |
| 3 | `npm run test --workspace=@rayhealth/core` | **Pass** — 25 files, 159 tests (new DB-backed tests skip gracefully — no DB in this environment, consistent with existing suite behavior) |
| 4 | `npx tsc --noEmit -p packages/app/tsconfig.json` | **Pass** — no errors |
| 5 | `npx vitest run --no-file-parallelism --pool=threads` (in `packages/app`) | **Pass** — 37 files, 267 tests, 1 pre-existing skip |
| 6 | `npx tsc --noEmit -p packages/web/tsconfig.json` | **Pass** — no errors |
| 7 | `npm run test --workspace=@rayhealth/web` | **Pass** — 15 files, 42 tests |
| 8 | `npm run lint --workspace=@rayhealth/app` | **Pass** — no errors/warnings |
| 8 | `npm run lint --workspace=@rayhealth/web` | **Pass** — no errors/warnings |

Everything is green.
