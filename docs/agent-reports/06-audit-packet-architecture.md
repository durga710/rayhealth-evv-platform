# Agent 06 — Audit Packet Architecture

**Authored by Durga Ghimeray**

---

**Status:** Planning-phase build spec (no feature code written). Binding inputs: Agent 00 §9.6 audit-packet guardrails, §9.7 cross-agency rules, §10 non-negotiables; Agent 02 "Audit Afternoon" framing.

**User story:** As an agency admin, I can generate an audit packet for a single visit that helps defend EVV compliance to a PA DHS / Sandata auditor — counts, statuses, hashes, and the accountability trail; never a PHI dump.

**Relationship to what exists:** `packages/web/src/features/compliance-engine/AuditDefensePage.tsx` + `GET /api/compliance-engine/audit-defense/packet.csv` already produce a **date-range, count-first CSV** with an `X-Manifest-Sha256` integrity header. This feature is the complementary **per-visit deep packet**: everything an auditor asks about *one specific visit*, assembled on demand. It reuses the same conventions (integrity hash, counts, agency scoping, `audit.read` gating).

---

## 1. Evidence That Belongs in the Packet (field-by-field mapping)

Every item below maps to a real column/method in the repo. "MVP" = ships in the first implementation; "Deferred" = designed for, not built now.

### 1.1 Visit core (MVP)

| Packet field | Source | Notes |
|---|---|---|
| `visit.id` | `evv_visits.id` via `EvvRepository.getVisitByIdForAgency(id, agencyId)` (`packages/core/src/repositories/evv-repository.ts`) | The only fetch path — already tenant-scoped and 404-safe. |
| `visit.status` | `evv_visits.status` (`'pending' \| 'verified' \| 'flagged'`, `packages/core/src/domain/evv.ts`) | The headline verification verdict. |
| `visit.serviceCode` + `visit.serviceDescription` | `evv_visits.service_code` + `paServiceCodeDescriptions` (`packages/core/src/config/pennsylvania.ts`) | Cures-Act element #1. Description is static config, not PHI. |
| `visit.clockInTime` / `visit.clockOutTime` | `evv_visits.clock_in_time` / `clock_out_time` | Cures-Act #3, #6, #7. |
| `visit.scheduledStartTime` / `visit.scheduledEndTime` | `assignments.scheduled_start_time` / `scheduled_end_time` joined via `evv_visits.assignment_id` (see `packages/core/src/repositories/schedule-repository.ts`) | Lets the auditor compare scheduled vs. actual. Nullable — legacy assignments may lack them. |

### 1.2 Parties — minimum necessary (MVP)

| Packet field | Source | Notes |
|---|---|---|
| `caregiver.id`, `caregiver.name` | `evv_visits.caregiver_id` → `caregivers.first_name`/`last_name`, scoped by `caregivers.agency_id` (`caregiver-repository.ts`) | Cures-Act #5. Internal UUID + display name only. **No** email, phone, credentials detail, or HR data. |
| `client.id`, `client.name` | `evv_visits.client_id` → `clients.first_name`/`last_name` (same join pattern as `EvvRepository.getVisitsForCaregiverInAgency`) | Cures-Act #2. Internal UUID + name only — **not** the full client record, no address, no DOB, no Medicaid ID (see §2). |

### 1.3 GPS status + geofence result — derived, never raw (MVP)

Raw `clock_in_location` / `clock_out_location` (lat/lng) **never leave the server**. The route derives, per clock event:

| Packet field | Derivation |
|---|---|
| `geofence.clockIn.captured` (boolean) | `clock_in_location` present on the row. |
| `geofence.clockIn.accuracyM` (number \| null) | `clock_in_location.accuracy` — a quality scalar, not a coordinate. |
| `geofence.clockIn.result` (`'within' \| 'out_of_bounds' \| 'not_configured' \| 'not_captured'`) + `distanceM`, `allowedM` | Recompute server-side with `checkGeofence()` (`packages/core/src/security/geofence.ts`) against `ClientRepository.getClientGeofence(clientId, agencyId)` (`clients.latitude`/`longitude`/`geofence_radius_m`). `not_configured` = fail-open case (client has no registered coordinates), stated honestly in the packet. |
| `geofence.clockOut.*` | Same shape for `clock_out_location`; `not_captured` when the visit has no clock-out. |

`distanceM`/`allowedM` are exactly what `checkGeofence` already returns and what the existing 422 `GEOFENCE_OUT_OF_BOUNDS` envelope exposes in `packages/app/src/routes/evv-routes.ts` — an in/out determination + distance, **not** a movement trail (Agent 00 §9.6).

### 1.4 Cures-Act element presence checklist (MVP)

`curesActElements`: computed booleans keyed by `curesActEvvDataPoints` (`packages/core/src/config/pennsylvania.ts`): `service-type` (service_code present), `beneficiary` (client_id present), `date` + `start-time` (clock_in_time), `location` (clock_in_location captured), `provider` (caregiver_id), `end-time` (clock_out_time). Count-first — this is the single most persuasive table for a Sandata auditor.

### 1.5 Exception lifecycle (MVP)

`exceptions[]` from `evv_exceptions` by `visit_id`: `{ id, exceptionType, reason, status: 'open' | 'resolved', resolvedBy, resolvedAt }` — mapped from `exception_type`, `reason`, `approved_by`, `approved_at` (`evv-exception-repository.ts`). `status` is derived: resolved iff `approved_at` is set. **Read must be agency-scoped**: `EvvExceptionRepository` deliberately has no unscoped read (see its own NOTE about the deleted cross-tenant footgun) — the implementation adds a scoped read that joins `evv_exceptions → evv_visits → caregivers` and filters `caregivers.agency_id` (same pattern as `ComplianceEngineRepository.acknowledgeException`).

### 1.6 Edit / correction history — VMUR accountability trail (MVP)

`corrections[]` from `visit_maintenance` by `visit_id` (`visit-maintenance-repository.ts`, `packages/core/src/domain/visit-maintenance.ts`):

`{ id, requesterId, requesterName, reason, reasonCategoryCode, correctionCode, status ('pending'|'approved'|'rejected'), approverId, approverName, approvedAt, originalStartTime, originalEndTime, adjustedStartTime, adjustedEndTime }`

This is the non-repudiation core: `approver_id` + `approved_at` prove every post-finalization change was authorized by a named actor. Requires a new read method `findByVisitIdForAgency(visitId, agencyId)` (repo currently only has `requestUnlock`/`approveUnlock`) using the same `evv_visits → caregivers.agency_id` authorization join it already uses. Signature-attestation fields (`caregiverSignaturePresent`, `clientSignaturePresent`, `incompleteSignatureReason`) are booleans/short text and are IN — they are PA DHS Provider Spec evidence, not clinical content.

### 1.7 Audit-event chain — references and hashes, not payloads (MVP)

`auditEvents[]`: for each event, `{ id, eventType, entityType, outcome, actorId, actorType, occurredAt, payloadSha256 }`. **Never the raw `payload` object** (Agent 00 §9.6: "IDs and hashes, not raw payloads"). `payloadSha256` = SHA-256 of the canonical-JSON payload, computed server-side at packet time; an auditor can request targeted verification later through a logged channel.

Sources (all via `AuditEventRepository`, `audit-event-repository.ts`):
- `entity_type = 'evv.visit'`, `entity_id = visitId` — exception filings (`exception.filed`), VMUR lifecycle (`visit.maintenance.requested/approved`), etc.
- `entity_type = 'evv.clock-out'`, `entity_id = visitId` — geofence denials at clock-out (see `evv-routes.ts`).
- `entity_type = 'evv.clock-in'`, `entity_id = assignmentId` — geofence denials at clock-in are keyed by the **assignment** id; the packet includes these because repeated `permission.denied` rows are exactly what an auditor probes.

**Design constraint found while reading the repo:** `AuditEventRepository.findByEntity(entityType, entityId)` does **not** filter by `agency_id`. It must not be used directly. The implementation adds `findByEntityForAgency(agencyId, entityType, entityId)` (a one-line `where agency_id` addition) — consistent with Agent 00 §9.7 rule 2 ("every repository query must filter by the context agencyId").

### 1.8 Aggregator submission status (MVP)

`aggregator`: `{ sandataStatus, sandataConfirmationId, hhaexchangeStatus, hhaexchangeConfirmationId }` straight from `evv_visits.sandata_status` / `sandata_confirmation_id` / `hhaexchange_status` / `hhaexchange_confirmation_id` (all mapped in `EvvRepository.mapRowToVisit` and the mark-submission methods). "Did the state receive it?" answered with a confirmation ID — high audit value, zero PHI.

### 1.9 Packet integrity metadata (MVP)

`packet`: `{ generatedAt (ISO), generatedBy (req.auth.userId), agencyId (req.auth.agencyId), integritySha256 }` where `integritySha256` = SHA-256 of the canonical JSON of everything above (excluding the hash field itself). Mirrors the `X-Manifest-Sha256` convention already shipped in `AuditDefensePage.tsx` / the audit-defense CSV endpoint.

### 1.10 Deferred (designed-for, not MVP)

| Item | Why deferred | Future source |
|---|---|---|
| **Date-range packet** (`GET /admin/audit-packet?from&to`) | The existing `/compliance-engine/audit-defense/packet.csv` already covers range-level counts + manifest hash; per-visit depth is the new value. A range variant is composition of the per-visit builder later. | Same builder over `EvvRepository.getVisitsForExport(agencyId, fromIso, toIso)` visit-id list. |
| **Authorization validity at time of service** (unit balance, auth window) | Needs a visit→assignment→authorization join + as-of-date unit math not currently exposed as a single repo method. MVP carries the *service-code match* implicitly (the clock-in route rejects mismatches — `evv-routes.ts` "serviceCode does not match the client authorization"). | `authorization` repository + assignment linkage. |
| **Billing/claim readiness** (claim generated/validated/submitted for this visit) | Claim linkage lives in the claims domain; surfacing `claim.generated`/`claim.submitted` audit rows keyed to claims requires a claim↔visit resolution step. Partial signal already appears in `auditEvents[]` if any events are keyed to the visit. | `claim` repository join; add `billing: { claimStatus }`. |
| **Credential validity at time of service** (Agent 00 §9.6 lists it) | Needs `credential-compliance-service` as-of-date evaluation; keep the packet honest rather than approximate. | `credential-policy-service.ts` / `credential-compliance-service.ts`. |
| PDF generation, ZIP bundles, emailed packets | No PDF pipeline exists; do not invent one (see §5). | Print CSS → browser print-to-PDF is the MVP export. |

---

## 2. Explicit Exclusions — PHI Minimization

Binding list. The response schema in §3 is a **whitelist**; anything not listed there is excluded by construction.

1. **No raw GPS coordinates, ever.** `clock_in_location` / `clock_out_location` lat/lng never appear in the response, the web page, or the printed output. Only: captured-boolean, accuracy meters, `checkGeofence` result (`within`/`out_of_bounds`), `distanceM`, `allowedM`. No movement trail exists in the data model (locations are captured only at clock-in/out) and none is implied.
2. **No clinical or care-plan content.** The visit model (`packages/core/src/domain/evv.ts`) carries no clinical notes — the packet must not grow them from other tables either. Service description comes only from the static `paServiceCodeDescriptions` config map.
3. **No raw audit payloads.** `audit_events.payload` is reduced to `payloadSha256` + `eventType` + `outcome`. Payloads can contain request fragments; hashes are tamper-evidence without disclosure.
4. **No SSN, DOB, Medicaid ID, address, phone, or email** for either party. PA DHS audit defense at packet level needs *which* client/caregiver and *what happened* — payer-identifier resolution belongs to the claims/aggregator submission pipeline (which already carries it under its own controls), not a screen-renderable packet. If a future auditor workflow demands a Medicaid ID, it becomes a separately gated, separately audit-logged field — not a default.
5. **Client identity = minimum necessary:** internal UUID + display name (`clients.first_name` + `last_name`), exactly the precedent set by `EvvRepository.getVisitsForCaregiverInAgency` (`clientName` synthesis). Never the full client row.
6. **Caregiver identity = internal UUID + display name.** No credential documents, no HR data, no compensation.
7. **No cross-client or cross-visit data.** The packet is strictly the requested visit; exceptions/corrections/audit events are keyed to that visit id (clock-in denials keyed to its assignment id). No "other visits that day" joins in MVP.
8. **No raw aggregator request/response bodies.** Only status enum + confirmation ID.
9. **No free-text fields other than** `exceptions[].reason`, `corrections[].reason`, and `corrections[].incompleteSignatureReason` — these are operator-authored compliance justifications (required by the PA Provider Spec, see `visit-maintenance.ts` OTHR/signature refinements) and are the accountability record itself. They are IN by necessity; nothing else free-text is.

---

## 3. API Contract

### 3.1 Endpoint

```
GET /admin/audit-packet/:visitId
```

- **File:** `packages/app/src/routes/audit-packet-routes.ts` (new).
- **Mount:** in `packages/app/src/app.ts` next to its siblings, with the same limiter:
  `app.use(`${prefix}/admin/audit-packet`, adminAuditLimiter, auditPacketRoutes);`
  (matches lines 302–303 pattern: `/admin/audit-retention`, `/admin/audit-events` under `adminAuditLimiter`, 30/15min).
- **Auth:** session/JWT via the global `authContext` middleware; `requireCapability('audit.read')` (§4).
- **Tenancy:** `agencyId` from `req.auth.agencyId` only. No agency identifier accepted from path, query, or body (Agent 00 §9.7 rule 1).
- **Date-range variant:** deferred (§1.10). The route file should be structured so a `GET /` range handler can be added without reshaping the per-visit response.

### 3.2 Request validation

- `visitId` validated with the existing `evvVisitIdSchema` (`z.string().uuid()`, `packages/core/src/domain/evv.ts`). Invalid → `400 { "message": "Valid visit id is required" }` (mirrors `evv-routes.ts` clock-out wording).

### 3.3 Response — `200 application/json`

```jsonc
{
  "packet": {
    "generatedAt": "2026-07-06T18:04:11.212Z",   // string (ISO 8601)
    "generatedBy": "uuid",                        // req.auth.userId
    "agencyId": "uuid",                           // req.auth.agencyId (echo of server truth)
    "integritySha256": "hex64"                    // SHA-256 of canonical JSON of all fields below
  },
  "visit": {
    "id": "uuid",
    "status": "pending" | "verified" | "flagged",
    "serviceCode": "T1019" | "S5125" | "T1004" | "T1021" | null,
    "serviceDescription": "string | null",        // from paServiceCodeDescriptions
    "scheduledStartTime": "ISO | null",           // assignments.scheduled_start_time
    "scheduledEndTime": "ISO | null",             // assignments.scheduled_end_time
    "clockInTime": "ISO",
    "clockOutTime": "ISO | null"
  },
  "caregiver": { "id": "uuid", "name": "string" },
  "client":    { "id": "uuid | null", "name": "string | null" },
  "curesActElements": {                           // Record<CuresActDataPoint, boolean>
    "service-type": true, "beneficiary": true, "date": true,
    "location": true, "provider": true, "start-time": true, "end-time": false
  },
  "geofence": {
    "clockIn": {
      "captured": true,
      "accuracyM": 12.4,                          // number | null — quality scalar only
      "result": "within" | "out_of_bounds" | "not_configured" | "not_captured",
      "distanceM": 34,                            // number | null (null when not computable)
      "allowedM": 100                             // number | null
    },
    "clockOut": { /* same shape */ }
  },
  "exceptions": [{
    "id": "uuid",
    "exceptionType": "string",                    // evv_exceptions.exception_type
    "reason": "string",
    "status": "open" | "resolved",                // derived: approved_at set → resolved
    "resolvedBy": "uuid | null",                  // approved_by
    "resolvedAt": "ISO | null"                    // approved_at
  }],
  "corrections": [{                               // VMUR trail, visit_maintenance
    "id": "uuid",
    "status": "pending" | "approved" | "rejected",
    "requesterId": "uuid", "requesterName": "string | null",
    "reason": "string",
    "reasonCategoryCode": "MTLB|DCDB|MFLB|MFLA|ACLN|ATGL|AGRS|WKAP|CNCL|HOLI|WKLI|OTHR|null",
    "correctionCode": "TIME_CHANGE|...|OTHER|null",
    "approverId": "uuid | null", "approverName": "string | null",
    "approvedAt": "ISO | null",
    "originalStartTime": "ISO | null", "originalEndTime": "ISO | null",
    "adjustedStartTime": "ISO | null", "adjustedEndTime": "ISO | null"
  }],
  "auditEvents": [{
    "id": "uuid",
    "eventType": "string",                        // one of auditEventTypes
    "entityType": "evv.visit" | "evv.clock-in" | "evv.clock-out",
    "outcome": "success" | "failure" | "denied",
    "actorId": "uuid",
    "actorType": "user" | "service" | "system",
    "occurredAt": "ISO",
    "payloadSha256": "hex64"                      // NEVER the payload itself
  }],
  "aggregator": {
    "sandataStatus": "pending|submitted|accepted|rejected|null",
    "sandataConfirmationId": "string | null",
    "hhaexchangeStatus": "pending|submitted|accepted|rejected|null",
    "hhaexchangeConfirmationId": "string | null"
  }
}
```

### 3.4 Errors

| Status | Condition | Body |
|---|---|---|
| `400` | `visitId` not a UUID | `{ "message": "Valid visit id is required" }` |
| `403` | role lacks `audit.read` | `{ "message": "Forbidden" }` (from `requireCapability`) |
| `404` | visit does not exist **or** belongs to another agency — indistinguishable | `{ "message": "Visit not found" }` |
| `500` | internal error, **including audit-log write failure** (§4.3) | `{ "message": "Internal Server Error" }` |

The 404 comes from `EvvRepository.getVisitByIdForAgency` returning `null` for both cases by design ("returns null without leaking cross-tenant existence"). Identical body and status for both — no timing/shape oracle.

---

## 4. Access Control

### 4.1 Capability

**`audit.read`** — a real capability in `packages/core/src/config/pennsylvania.ts` (`Capability` union, line ~86), granted **only to `admin`** in `ROLE_CAPABILITIES` (coordinator, caregiver, family do not have it). It already gates the two closest siblings: `GET /admin/audit-events` (`audit-events-routes.ts`, `requireCapability('audit.read')`) and `/admin/audit-retention`. The audit packet is the same class of surface (admin-only compliance disclosure), so it takes the same guard via `packages/app/src/middleware/require-capability.ts`. No new capability is invented for MVP.

### 4.2 Tenancy

`requireCapability` is role-only — it is **not** a tenancy check (Agent 00 §9.7). Tenancy is enforced in every repository call:
- Visit: `EvvRepository.getVisitByIdForAgency(id, req.auth.agencyId)` (join `users.caregiver_id → users.agency_id`).
- VMUR: new `findByVisitIdForAgency` reusing the repo's `evv_visits → caregivers.agency_id` authorization join.
- Exceptions: new scoped read joining through `evv_visits → caregivers.agency_id`.
- Audit events: new `findByEntityForAgency(agencyId, ...)` — the existing unscoped `findByEntity` is **forbidden** in this route.
- Caregiver/client names: `caregiver-repository` / `client-repository` reads that already require `agencyId`.

### 4.3 Packet generation is itself a logged PHI disclosure

On every successful build, before the response is sent, write via `AuditEventRepository.create`:

```ts
{
  agencyId: req.auth.agencyId,
  actorId: req.auth.userId,
  actorType: 'user',
  eventType: 'phi.export',            // real value in auditEventTypes (packages/core/src/domain/audit.ts)
  entityType: 'evv.visit.audit-packet',
  entityId: visitId,
  outcome: 'success',
  payload: {
    scope: 'visit',
    integritySha256,                   // ties the log row to the exact packet produced
    counts: { exceptions, corrections, auditEvents }
  },
  occurredAt: new Date().toISOString()
}
```

**Mandatory, not best-effort:** unlike the geofence-denial logging in `evv-routes.ts` (best-effort, wrapped in try/catch), this write is a HIPAA §164.312(b) disclosure record — if the audit insert fails, the route returns `500` and does **not** return the packet. An unlogged PHI export must be impossible by construction (risk R4, §7). Failed lookups (404) are not logged as `phi.export` (nothing was disclosed); they surface through the normal request-audit middleware (`packages/app/src/middleware/audit-log.ts`).

---

## 5. Print / Export Behavior (MVP)

- **MVP export = print-friendly HTML.** New page `packages/web/src/features/compliance-engine/AuditPacketPage.tsx` at `/admin/audit-packet` (visit-id entry / deep link `/admin/audit-packet/:visitId` from Visit Review), rendering the §3.3 JSON as sectioned cards: Visit summary → Cures-Act checklist → Geofence results → Exceptions → Corrections (VMUR) → Audit-event chain → Aggregator status → Packet metadata (generated-at, generated-by, `integritySha256` displayed prominently, matching the manifest-hash display convention in `AuditDefensePage.tsx`).
- A "Print packet" button calls `window.print()`. Print CSS (`@media print` block in `packages/web/src/index.css`, using existing tokens — no inline hex per Agent 00 §10.6) hides the admin sidebar/nav/buttons, forces light surfaces, keeps tables intact, and prints a header/footer with agency name, visit id, generated-at, and the integrity hash on every page.
- "Export to PDF" for MVP **is** the browser's print-to-PDF from this view. **Do not build a server-side PDF pipeline** — none exists in the repo and inventing one is out of scope.
- **Deferred:** server-rendered PDF; per-visit CSV; ZIP bundle combining this packet with the existing date-range audit-defense CSV; emailed packets (an email is an uncontrolled PHI channel — rejected until a design exists).

---

## 6. Test Cases

### 6.1 Backend — `packages/app/src/routes/__tests__/audit-packet-routes.test.ts` (supertest, matching sibling suites)

1. **Capability gating:** `coordinator`, `caregiver`, and `family` sessions get `403 Forbidden`; `admin` gets `200`.
2. **Cross-tenant 404:** seed agency A and agency B with a visit each; agency A admin requesting agency B's visit id → `404 { message: 'Visit not found' }`.
3. **Nonexistent 404 indistinguishable:** random UUID → same status, same body as test 2 (assert deep-equal bodies).
4. **Invalid id:** non-UUID `:visitId` → `400`.
5. **Response shape:** seeded visit with clock-out, one exception, one approved VMUR, geofence-denial audit rows → assert every §3.3 field present with correct types; `curesActElements` keys exactly equal `curesActEvvDataPoints`; `corrections[0].approverId`/`approvedAt` populated.
6. **PHI-exclusion assertions (the load-bearing tests):**
   - `JSON.stringify(res.body)` contains none of: `"lat"`, `"lng"`, `"clockInLocation"`, `"clockOutLocation"`, the seeded coordinate literals (e.g. `40.2732`), `"ssn"`, `"dob"`, `"medicaid"`, client street address string, caregiver email.
   - `auditEvents[*]` has `payloadSha256` and **no** `payload` key.
7. **Geofence derivation:** (a) in-fence seed → `result: 'within'` with numeric `distanceM ≤ allowedM`; (b) out-of-fence seed → `'out_of_bounds'`; (c) client with `latitude/longitude` null → `'not_configured'`; (d) visit without clock-out → `clockOut.result: 'not_captured'`.
8. **Audit-log-on-generate:** after a `200`, exactly one new `audit_events` row with `event_type = 'phi.export'`, `entity_type = 'evv.visit.audit-packet'`, `entity_id = visitId`, `agency_id` = requester's agency, payload `integritySha256` equal to the response's hash. After a `404`, **no** `phi.export` row.
9. **Audit-write failure fails closed:** stub `AuditEventRepository.create` to throw → route returns `500` and response contains no packet data.
10. **Integrity hash:** recompute SHA-256 over the canonical JSON of the response minus `packet.integritySha256` and assert equality; two consecutive generations of an unchanged visit differ only in `generatedAt`/hash.
11. **Tenancy of sub-collections:** seed an `audit_events` row for the same `entityId` but a different `agency_id` → it must **not** appear in `auditEvents[]` (proves `findByEntityForAgency` is used, not `findByEntity`).
12. **Rate limiting mount:** route registered under `adminAuditLimiter` (assert 429 after limit in a limiter-enabled test, or assert mount config if limiter is bypassed under `NODE_ENV=test` as in `app.ts`).

### 6.2 Core — repository unit tests (extend existing suites in `packages/core/src/__tests__/`)

13. `VisitMaintenanceRepository.findByVisitIdForAgency` returns rows for the owning agency and `[]`/null for another agency.
14. `AuditEventRepository.findByEntityForAgency` filters by `agency_id`.
15. Scoped exception read joins through `evv_visits → caregivers.agency_id` and excludes other tenants.

### 6.3 Frontend — `packages/web/src/features/compliance-engine/AuditPacketPage.test.tsx` (React Testing Library, matching `AuditDefensePage` conventions)

16. Renders all packet sections from a mocked §3.3 response; integrity hash visible.
17. Loading state uses `LoadingSkeleton`; fetch failure renders `ErrorRetry` (Agent 00 §8.6 — never a white screen); 404 renders a not-found empty state (`EmptyState`).
18. **No raw coordinates rendered:** with a mocked response, assert the DOM contains no lat/lng-like strings; geofence section shows `result`/`distanceM` only.
19. Print button calls `window.print` (spy).
20. Route is admin-gated in `App.tsx` (`AdminRoute`), consistent with `/admin/audit-events`.

---

## 7. Compliance & Audit Risks and Mitigations

| # | Risk | Mitigation in this design |
|---|---|---|
| R1 | **Over-collection** — packet drifts into a PHI dump ("just add the address…") | Whitelist response schema (§3.3) enforced by shape tests + PHI-exclusion string assertions (test 6); §8 checklist binds the implementer; deferred items require their own minimization review before inclusion. |
| R2 | **Cross-agency leakage** — visit id from another tenant, or sub-collections (audit events keyed only by entity id) leaking across agencies | Every fetch tenant-scoped (§4.2); the unscoped `AuditEventRepository.findByEntity` is explicitly forbidden and a scoped variant added; test 11 proves it; identical 404 for missing vs. cross-tenant (test 3). |
| R3 | **Existence oracle** — 403 vs 404 distinctions revealing that a visit id exists in another agency | Single `404 Visit not found` for both cases, inherited from `getVisitByIdForAgency` semantics; capability check (403) happens before any lookup, so a 403 reveals only the caller's own role. |
| R4 | **The packet becomes an unlogged PHI export** | `phi.export` audit event is a *precondition of responding* — fail-closed on audit-write failure (§4.3, test 9). The event carries the packet's integrity hash, binding log to artifact. |
| R5 | **Raw GPS reconstruction** — coordinates leaking via geofence math or audit payloads | Only derived `result/distanceM/allowedM/accuracyM` cross the API (§1.3); audit payloads reduced to hashes (§1.7); tests 6 and 18 assert absence at both API and DOM layers. |
| R6 | **Bulk exfiltration via the endpoint** — scripted admin session harvesting packets | Mounted under `adminAuditLimiter` (30 req/15 min, same as `/admin/audit-events`); one visit per request; every request individually `phi.export`-logged with actor, so harvesting is self-evident in the trail. |
| R7 | **Packet tampering after generation** ("the printout was edited") | `integritySha256` over canonical JSON, displayed on screen and printed on every page; same defense already offered by the audit-defense CSV's `X-Manifest-Sha256`. |
| R8 | **False confidence from fail-open geofence** — packet showing `within` when no fence was configured | Honest four-state `result` including `not_configured` (§1.3), mirroring the documented fail-open rationale in `geofence.ts`; the packet never converts absence of a check into a pass. |
| R9 | **Scope creep into date-range mass export before controls mature** | Range variant explicitly deferred (§1.10); the existing count-first CSV covers range needs; any future range packet inherits this section's controls. |

---

## 8. Data-Minimization Rules — Binding Checklist for the Implementation (Sonnet) Phase

The implementation MUST satisfy every line; the §6 tests encode most of them.

1. Response is built **only** from the §3.3 whitelist. Never spread a repository row into the response (`...visit` is forbidden); map field-by-field.
2. `agencyId` comes from `req.auth.agencyId` exclusively. No agency identifier is read from params, query, or body.
3. No raw lat/lng anywhere: API response, page DOM, print output, logs. Geofence facts are `captured / accuracyM / result / distanceM / allowedM` only.
4. Audit events expose `payloadSha256`, never `payload`.
5. Client and caregiver are `{ id, name }` only. No address, DOB, SSN, Medicaid ID, email, phone, HR or credential documents.
6. Every repository read in the route filters by the context `agencyId`; adding or using any unscoped read is a review-blocking defect. Do not call `AuditEventRepository.findByEntity` from this route.
7. `phi.export` audit row (eventType from `auditEventTypes`) is written before responding; on audit-write failure return 500 with no packet body. 404s write no `phi.export`.
8. 404 body/status identical for "not found" and "other tenant".
9. Free text is limited to `exceptions[].reason`, `corrections[].reason`, `corrections[].incompleteSignatureReason`. No other free-text fields enter the packet.
10. No new capability, no capability downgrade: `requireCapability('audit.read')`, admin-only per `ROLE_CAPABILITIES`.
11. Mount under `adminAuditLimiter`. No unauthenticated or public variant, ever.
12. No PDF library, no email delivery, no S3 persistence of packets in MVP — the packet is generated on demand and not stored (nothing new to retain, breach, or purge).
13. Web page uses design tokens (`index.css` variables) — no inline hex (Agent 00 §10.6); failure states use `ErrorRetry`/`EmptyState`.
14. Do not modify `audit_events` write paths, EVV rows, or any append-only structure. This feature is read-plus-one-audit-insert.

---

## Implementation Handoff to Sonnet

Build exactly this, in this order:

**Backend**
1. `packages/core/src/repositories/audit-event-repository.ts` — add `findByEntityForAgency(agencyId: string, entityType: string, entityId: string): Promise<AuditEvent[]>` (the existing `findByEntity` plus `.where({ agency_id: agencyId })`). Do not change `findByEntity` callers elsewhere.
2. `packages/core/src/repositories/visit-maintenance-repository.ts` — add `findByVisitIdForAgency(visitId: string, agencyId: string): Promise<VisitMaintenance[]>` using the repo's existing `evv_visits → caregivers.agency_id` join; map with the existing `mapRowToMaintenance` (extend mapping to include `reason_category_code`, `correction_code`, `original_start_time`, `original_end_time`, signature fields if the columns exist — verify against the migration before mapping).
3. Agency-scoped exception read: add `findExceptionsByVisitForAgency(visitId, agencyId)` joining `evv_exceptions → evv_visits → caregivers` filtered on `caregivers.agency_id` (place per the note in `evv-exception-repository.ts`: scoped reads follow the `ComplianceEngineRepository.acknowledgeException` pattern).
4. **Create `packages/app/src/routes/audit-packet-routes.ts`** — `GET /:visitId` per §3: validate with `evvVisitIdSchema`; `requireCapability('audit.read')`; fetch visit via `getVisitByIdForAgency`; join names via caregiver/client repos; scheduled times from `assignments` by `visit.assignmentId`; derive geofence via `ClientRepository.getClientGeofence` + `checkGeofence`; assemble §3.3 shape; SHA-256 canonical JSON (node `crypto`); write the §4.3 `phi.export` event (fail-closed); respond.
5. Mount in `packages/app/src/app.ts`: `app.use(`${prefix}/admin/audit-packet`, adminAuditLimiter, auditPacketRoutes);` beside line ~303.
6. **Create `packages/app/src/routes/__tests__/audit-packet-routes.test.ts`** — tests 1–12 (§6.1); extend core suites for tests 13–15.

**Frontend**
7. **Create `packages/web/src/features/compliance-engine/AuditPacketPage.tsx`** (+ `AuditPacketPage.test.tsx`, tests 16–20) — sections per §5, `getJson` from `lib/api-client.js`, `LoadingSkeleton`/`ErrorRetry`/`EmptyState`, integrity hash display, Print button.
8. Modify `packages/web/src/App.tsx` — lazy routes `/admin/audit-packet` and `/admin/audit-packet/:visitId` under `AdminRoute`; sidebar link in the admin shell nav next to Audit Events (the "Defend" group per Agent 00 §6.1).
9. Modify `packages/web/src/index.css` — `@media print` rules for the packet page (hide nav/sidebar/buttons; repeat header with agency, visit id, generated-at, integrity hash; token-based colors only).
10. Optional, low-cost: a "Generate audit packet" link from `VisitReviewPage.tsx` rows to `/admin/audit-packet/:visitId`.

**Response contract to build:** exactly §3.3; errors exactly §3.4; minimization rules §8 are acceptance criteria, not suggestions.
