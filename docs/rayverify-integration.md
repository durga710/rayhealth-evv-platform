# RayVerify Integration — Architecture & Build Plan

> **Positioning.** RayHealthEVV is the product agencies buy. **RayVerify is the
> verification engine underneath it** (Stripe → Radar). RayVerify also stands
> alone as a B2G program-integrity platform for state Medicaid / MCO / OIG. Both
> stories hold simultaneously because RayVerify is consumed as a *service*, not
> merged as code.

Status: **proposal** · Author: platform · Last updated: 2026-06-29

---

## 1. Reality baseline (what exists today)

From a direct read of both codebases:

| Capability | RayHealthEVV (this repo) | RayVerify (`durga710/RayVerify`) |
|---|---|---|
| Stack | Express · Knex · React/Vite · Capacitor · Vercel | NestJS · Prisma · Next.js · Terraform/AWS |
| GPS geofence | ✅ live (`core/security/geofence.ts`, Haversine) | consumes a radius anchor |
| Fraud detection | ❌ none | ✅ **real** — 6 explainable detectors (~792 LOC) |
| Identity / liveness | ❌ none | ⚠️ **stub only** (`StubIdentityProvider` returns fixed scores) |
| Device trust (root/emulator) | ❌ not captured | interface exists; no real signal source |
| Audit trail | ✅ append-only (`audit_events` + trigger) | own hash-chain audit |
| Investigator dashboard | n/a | 🟡 11 Next.js pages (scaffold) |
| Tests | extensive | ⚠️ 1 backend spec |

**Consequence for messaging:** today we can truthfully market **GPS + geofence**
(live) and **fraud intelligence** (real logic). Face match / liveness / device
hardware / ML scoring are **roadmap** — do not present them as live until a real
provider is wired (see §7).

## 2. Architecture decision

**Decision: RayVerify is a standalone service consumed by RayHealthEVV over HTTP.
Do NOT merge the codebases.**

Rationale:
- The stacks share almost nothing (NestJS/Prisma vs Express/Knex). A merge is
  weeks of framework reconciliation for negative value.
- RayVerify already has its own Terraform/AWS deploy and must remain sellable
  standalone (B2G). A service boundary preserves that.
- It mirrors the reference model (Stripe deploys Radar as part of its platform;
  consumers call it through one API).

```
RayHealthEVV (Vercel)                         RayVerify (AWS, standalone)
─────────────────────                         ──────────────────────────
completed EvvVisit                            NestJS API
   │  signals (geo, time, device, billing)       ├─ /visits  /clock-in /clock-out
   ├──────────────  POST /verify  ──────────────▶├─ /visits/:id/verify
   │                                              ├─ FraudService → 6 detectors
   ◀────────  verification package  ─────────────┤   → 0–100 score + explanations
   │  store verdict (R27 table)                   └─ audit hash-chain
   └─ surface "Verified by RayVerify" in Visit Review
```

## 3. The integration contract

### 3.1 Client SDK

A thin package in this monorepo: **`packages/rayverify-client`** (pure fetch,
mirrors the existing `core/src/integrations/*` pattern — discriminated result
types, config-gated, never throws on non-2xx).

```ts
export interface RayVerifyConfig {
  baseUrl: string;            // RayVerify API base (per environment)
  apiKey: string;             // service credential, AES-GCM at rest
  organizationId: string;     // RayVerify tenant for this agency
}

export type VerifyResult =
  | { kind: 'not_configured'; reason: string }
  | { kind: 'ok'; verdict: VisitVerdict }
  | { kind: 'error'; message: string; retryable: boolean };

export interface VisitVerdict {
  rayverifyVisitId: string;
  status: 'VERIFIED' | 'REVIEW' | 'REJECTED';
  fraudScore: number;                 // 0–100
  detectors: Array<{ type: string; triggered: boolean; severity: number; explanation: string }>;
  identity: { result: 'PASS' | 'REVIEW' | 'FAIL'; confidence?: number; liveness?: number } | null;
}
```

### 3.2 Field mapping (RayHealthEVV → RayVerify)

RayVerify's `CreateVisitDto` / `ClockEventDto` and its fraud `VisitFeatureContext`
map cleanly onto data we already store:

| RayVerify input | RayHealthEVV source |
|---|---|
| `caregiverId` | `EvvVisit.caregiverId` |
| `patientId` | `EvvVisit.clientId` |
| `serviceCode` | `EvvVisit.serviceCode` |
| `scheduledStart/End` | assignment `scheduled_start/end_time` |
| clock-in `lat/lng/accuracyMeters` | `EvvVisit.clockInLocation.{lat,lng,accuracy}` |
| clock-out `lat/lng` | `EvvVisit.clockOutLocation` |
| `authorization.{latitude,longitude,radiusMeters}` | `Client.{latitude,longitude,geofenceRadiusM}` ✅ already exists |
| `billedUnits` | claim line units (billing) |
| `deviceId` | mobile session device id |
| `identity{confidence,liveness}` | **gap** — null until a real provider is wired |
| `device{isRooted,isEmulator}` | **gap** — mobile must capture & send |

The fraud detectors that work **immediately** on existing data: impossible-travel,
duplicate-visit, gps-anomaly, abnormal-duration. The two that need new signals:
identity-mismatch (needs identity provider), shared-device (needs `deviceId`).

### 3.3 Call shape

v1 mirrors a completed visit into RayVerify and reads the verdict:

```
POST /visits                → rayverifyVisitId
POST /visits/:id/clock-in   → geo + device
POST /visits/:id/clock-out  → geo + billedUnits
POST /visits/:id/verify     → VisitVerdict   ← RayHealthEVV stores this
```

> **Alternative (smaller RayVerify change):** add a stateless
> `POST /fraud/score` that accepts a full `VisitFeatureContext` and returns the
> score without persisting a visit. Cleaner for RayHealthEVV (no dual write of
> visit state), but requires RayHealthEVV to assemble the context (recent-visit
> history). **Recommended for v1** to keep RayHealthEVV the system of record and
> RayVerify the scoring engine. Track as a RayVerify enhancement.

## 4. RayHealthEVV-side changes

### 4.1 Persistence (migration R27, into `schema.ts`)

```
visit_verifications
  visit_id            uuid PK → evv_visits(id) on delete cascade
  agency_id           uuid
  rayverify_visit_id  text
  status              text        -- VERIFIED | REVIEW | REJECTED
  fraud_score         integer     -- 0–100
  detectors           jsonb       -- per-detector results + explanations
  identity            jsonb       -- nullable
  verified_at         timestamptz
  created_at/updated_at
```

`agency_rayverify_config` (parallels the Sandata/HHAeX config layer):
`agency_id`, `base_url`, `organization_id`, `credentials_encrypted` (AES-GCM),
`enabled`. Reuse `security/cell-cipher.ts`.

### 4.2 Service + wiring

- `core/src/integrations/rayverify/` — client + mapper + result types (same shape
  discipline as the Sandata integration just shipped).
- A job/endpoint that, on visit verification (or a sweep of completed visits),
  calls RayVerify and upserts `visit_verifications`. Honest gating: returns
  `not_configured` when the agency hasn't set up RayVerify — never fakes a score.
- Surface in **Visit Review**: a fraud-score badge + an expandable verdict panel
  (each detector's explanation). Read-only; no PHI leaves the agency tenant
  beyond the verification signals.

### 4.3 Feature flag

Per-agency via the existing `agency_features` mechanism: `rayverify_enabled`.
Off by default; enable per pilot agency. The marketing surface (§7) is independent
of the flag.

## 5. Mobile (caregiver app) — later phase

To unlock identity + device-trust:
- capture `deviceId` (already partially available via mobile session),
- device-trust signals (rooted/jailbroken/emulator) via a Capacitor plugin,
- optional selfie + liveness capture, sent to RayVerify's identity provider.

These are **Phase 3** — they depend on a real identity provider existing in
RayVerify first.

## 6. Phased build plan

| Phase | Deliverable | Depends on | Risk |
|---|---|---|---|
| **1 — Fraud wiring** | `rayverify-client` SDK · R27 tables · `agency_rayverify_config` · score completed visits · Visit Review badge/panel · feature flag. Runs the 4 detectors that work on existing data. | RayVerify deployed + reachable | Med (additive, flagged) |
| **2 — Marketing** | Premium RayVerify landing section + `/rayverify` product page + nav, **framer-motion** (marketing routes only). Copy scoped to what's true (§7). | none | Low |
| **3 — Identity** | Wire a real biometric provider into RayVerify's `IdentityProvider` interface (replaces the stub); enables identity-mismatch + liveness. | vendor selection | Med |
| **4 — Mobile + dashboard** | Mobile capture (device-trust, selfie/liveness) · investigator/fraud dashboard surfacing. | Phase 3 | Larger |

## 7. Truthful messaging guardrail

The marketing section may claim, **today**: layered verification, GPS + geofence
(live), fraud intelligence (impossible travel, duplicate visits, GPS anomalies,
abnormal duration), explainable scoring, audit evidence. It must frame **identity
/ face / liveness / device hardware** as "rolling out" — not live — until Phase 3
lands a real provider. A "verified identity" headline backed by a stub is the one
claim that creates real exposure.

## 8. Open decisions

1. **Hosting:** stand up RayVerify on its existing Terraform/AWS, or containerize
   alongside? (Recommend: its own AWS, per the standalone-product goal.)
2. **`/fraud/score` stateless endpoint** in RayVerify (recommended v1) vs. mirror
   full visit lifecycle.
3. **Tenancy mapping:** RayHealthEVV agency ↔ RayVerify organization provisioning.
4. RayVerify is **under-tested (1 spec)** — harden the fraud engine before a
   production pilot.
