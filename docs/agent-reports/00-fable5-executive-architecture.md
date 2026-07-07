# Agent 00 — Fable 5 Executive Architecture

**Authored by Durga Ghimeray**

---

## 1. North-Star & Product Thesis

**North-star (one paragraph):**
RayHealthEVV™ is the calm command center for Pennsylvania homecare agencies — the single place where an agency owner sees, in under ten seconds, that today's visits are verified, this week's schedule holds, credentials and authorizations are current, claims are clean before submission, and every action is defensibly logged. It is not a feature buffet; it is an operating system whose emotional promise is *"nothing is on fire, and if an auditor calls, you are ready this afternoon."*

**12-month product thesis:**
The codebase is already unusually deep for its stage (six-element EVV, Sandata Alt-EVV async submission, HHAeXchange, 837P/835, append-only audit trail, capability RBAC, per-agency scoping verified in `packages/app/src/middleware/auth-context.ts`). The next 12 months are **not** about breadth. They are about three things, in order:

1. **Believability** — every public claim survives a skeptical agency owner and a lawyer. No invented outcome numbers, no "HIPAA-compliant" headline while BAAs are in progress.
2. **Polish-to-trust conversion** — the surfaces a buyer actually sees in a 30-minute demo (Landing → Command Center → Today Board → Clock-In on mobile → Visit Review → Audit Defense) must feel like one premium system, not five styling eras (`LandingPage.tsx` scoped CSS vs. `index.css` vs. inline styles in `CommandCenterPage.tsx`).
3. **First-agency operational readiness** — close the honest gaps the repo itself acknowledges ("Until those close, do not onboard real PHI"): BAAs executed, HIPAA-mode DB posture, pen test, mobile test coverage for the EVV path.

Win PA first. NJ config exists (`packages/core/src/config/states/new-jersey.ts`) — keep it dormant as proof of architecture, not a go-to-market.

---

## 2. Top 5 Highest-Impact Improvements (Ranked)

### #1 — Marketing-claims truth pass (Landing, HIPAA page, Pricing)
- **What:** Remove or reframe the invented "40% fewer claim denials in the first quarter" metric (`packages/web/src/features/landing/LandingPage.tsx`, lines ~16 and ~149's companion stats). Rewrite the `/compliance/hipaa` hero "HIPAA-compliant by design." (`HipaaCompliancePage.tsx` line 255) to approved language ("Designed with HIPAA-grade controls; operational HIPAA readiness in progress"). Reconcile `PricingPage.tsx` "BAA included" and `HipaaCompliancePage.tsx` "signs a BAA with every customer agency" with `PrivacyPage.tsx`, which correctly admits Neon/Vercel/Resend BAAs are *in progress*.
- **Why it matters to a buyer:** Agency owners in Medicaid homecare are professionally suspicious. One claim they can falsify destroys trust in every claim they can't verify. The Privacy page's honesty is an asset — the landing page's 40% number contradicts it on the same site.
- **Effort:** Small (1–2 days, copy + tests — note `HipaaCompliancePage.test.tsx` asserts the current headline and must be updated with it).
- **Risk of not doing it:** Legal exposure (FTC deceptive-claims territory), lost deals in diligence, and it poisons the well for the honest engineering underneath.

### #2 — One design system, applied to the demo path
- **What:** Kill the three styling sources of truth. Extract `CommandCenterPage.tsx` inline styles (hardcoded gradients like `#0F172A → #1E293B`) into `index.css` classes; move the landing page's massive scoped `<style>` block onto the shared token palette; establish a single token source that generates both web CSS variables and `packages/mobile/src/features/common/tokens.ts`.
- **Why it matters to a buyer:** "Premium" is perceived as consistency. When the Command Center KPI cards, the landing hero, and the mobile clock-in all share one visual language, the product reads as engineered, not assembled.
- **Effort:** Medium (3–5 days; the scout scoped the pieces at 1–3 hours each — the token-sync build step is the long pole).
- **Risk of not doing it:** Drift compounds; every new screen doubles down on whichever era its author copied from, and the demo feels like a prototype.

### #3 — The "Audit Afternoon" flow: Audit Defense → exportable evidence packet (PHI-guarded)
- **What:** Make the existing Compliance Engine → Audit Defense screen the flagship fear-killer: pick a date range + client/caregiver, get a structured, count-first evidence packet (visit verification status, exception resolutions with actor+timestamp, audit-event chain references). Guardrails in §9.6 below are mandatory.
- **Why it matters to a buyer:** A PA DHS audit is the single scariest event in an agency owner's year. "Audits become an afternoon" is already the landing-page promise (step 05) — the product must demonstrably cash that check in a demo.
- **Effort:** Medium (the audit-event repo, retention sweep, and Audit Defense page exist; this is composition + export, ~1–2 weeks).
- **Risk of not doing it:** The marketing promise stays a slogan; competitors with worse engineering but a "print audit binder" button win the emotional sale.

### #4 — Mobile EVV path hardening: tests + offline story
- **What:** `packages/mobile/src` has zero test coverage on the flow that generates the legally-binding record (ClockInScreen geofence logic, visit-state machine, auth). Add Vitest coverage for `visit-state.ts`, `geofence.ts`, and clock-in/out behavior; then verify and document the offline/poor-signal behavior the marketing already advertises ("Telephony & offline EVV: covering every home" — a landing-page article claim that must match reality or be removed).
- **Why it matters to a buyer:** The mobile app is where compliance is *created*. A missed clock-out or a geofence bug is a denied claim. Buyers ask "what happens in a dead zone?" in every demo.
- **Effort:** Medium (4–6 hours for first tests per scout; offline verification 3–5 days).
- **Risk of not doing it:** A field bug in clock-in is the one class of defect that costs the customer real money and triggers churn plus reputational damage in a small, talkative market.

### #5 — Demo-mode agency: seeded, realistic, resettable, zero-PHI
- **What:** A first-class seeded demo agency (fictional clients/caregivers, PA task codes, a week of schedules, a handful of open exceptions, one in-progress visit) with a one-command reset. Never demo on production data; never fake it live.
- **Why it matters to a buyer:** Every sales call currently depends on hand-built state. A canned demo agency makes the 30-minute walkthrough repeatable, lets the Command Center's 60-second refresh show live movement, and structurally prevents the temptation to show real PHI.
- **Effort:** Small–Medium (import service and repositories exist; this is a seed script + fixtures, ~1 week).
- **Risk of not doing it:** Inconsistent demos, embarrassing empty states, and eventual PHI exposure when someone demos on a real tenant.

---

## 3. Do-Not-Build-Yet List

Explicitly deferred. These add surface area, review burden, or compliance risk without moving a PA buyer to signature:

1. **New-state expansion beyond PA/NJ config** — no OH, no multi-state marketing. NJ stays a dormant architectural proof.
2. **Autonomous AI actions** — the copilot's propose-and-approve pattern (`admin-assistant-routes.ts`, `/copilot/*`) is exactly right; do not add auto-execute, auto-scheduling, or AI-written claim edits.
3. **Native payroll processing / payments** — payroll-ready *exports* are the correct boundary. Becoming a money mover adds regulatory weight for zero EVV differentiation.
4. **Family/client-facing portal** — a whole new PHI-bearing audience, consent model, and support surface. Not until agency-side is proven.
5. **Public API / partner integrations program** — the OpenAPI doc quick-win is fine as documentation; do not commit to external API stability contracts yet.
6. **Storybook and internal ops dashboards** (scout quick-wins #6, #8) — nice-to-haves; they serve engineers, not buyers. Sequence after the demo path is polished.
7. **In-house telephony (TVV) EVV** — until the offline story in #4 is verified, do not expand modality claims; fix the claim or the feature first.
8. **Marketplace/staffing features** (open-shift bidding across agencies) — directly threatens the cross-agency isolation guarantee that underpins trust.

---

## 4. Buyer-Trust Features (what makes an owner believe it's safe and real)

Lead with what is genuinely strong — this platform's trust story is *architectural*, and that is rarer than features:

- **Tamper-evident audit trail** — append-only `audit_events` with a DB trigger blocking mutation, self-logging retention sweep. Say it plainly on the compliance pages: "the log cannot be edited, even by us."
- **Per-agency PHI scoping enforced in middleware** — every request context carries `agencyId` from a server-validated session (verified in `auth-context.ts`); no client-supplied tenancy.
- **Revocable mobile sessions** — JWTs pinned to HS256 with mandatory `jti` backed by a `mobile_sessions` row; logout and password reset actually terminate access. This is a real differentiator versus "signature-only JWT" competitors — surface it in security documentation.
- **No-localStorage-auth CI gate** (`scripts/security-surface-scan.ts`) — evidence of a security *culture*, not a checkbox. Mention it in the trust page.
- **Server-side geofence as source of truth** (`packages/core/src/security/geofence.ts` + 422 GEOFENCE_OUT_OF_BOUNDS) with client-side UX feedback — the clock-in can't be spoofed by a modified client.
- **Honest vendor BAA status table** (`PrivacyPage.tsx`) — keep and elevate this. Radical transparency about "in progress" is a trust feature, not a weakness. Add "last updated" dates.
- **Human-in-the-loop AI, audit-logged** — "proposes, you approve; every query and action logged" is already the copy and the code. Keep them locked together.
- **RayVerify / status page** — a public status page is table stakes for "real company" perception; ensure it reflects actual health endpoints.

---

## 5. Fear-Reduction Features (audit panic, denials, missed clock-outs, exposure)

Map each owner fear to a product answer and make that answer demo-visible:

| Owner fear | Product answer | Where |
|---|---|---|
| "DHS audit letter arrives" | Audit Afternoon packet (#3), Audit Defense screen, immutable trail | Compliance Engine |
| "Claims will be denied" | Pre-submission exception queue, unit/rate validation, visit-to-claim reconciliation — frame as *"denials caught before billing,"* never as a percentage promise | Billing, Visit Review |
| "Caregiver forgot to clock out" | Clock-out always enabled as fallback + exception surfaced same-day in Visit Review; shift-alert scheduler nudges before shifts | Mobile + `evv-exception` service |
| "A credential lapsed and nobody noticed" | Credential expiry alerts + scheduling guardrails that block publishing conflicted weeks | `credential-policy-service.ts`, AssignmentsPage |
| "Authorization units will run out mid-month" | Auth burn-down on AuthorizationsPage; expiry surfacing | Authorizations |
| "Am I even ready to go live?" | Go-Live Readiness checklist — this page is an underrated closer; polish it early | `GoLiveReadinessPage.tsx` |
| "Is my data separate from other agencies?" | Per-agency scoping, stated plainly + evidenced by per-actor access-log exports | HIPAA page §74 already promises this — verify it exists before demoing |

The unifying principle: **every fear gets a queue, and every queue drains to zero.** The Command Center's job is to show all queues at or near zero.

---

## 6. Simplification Targets

1. **Compliance Engine sprawl** — twelve sub-screens (overview, audit-defense, exceptions, authorizations, medicaid, payroll, claims, remittances, evv-submission, hhaexchange-submission, clearinghouse, credentials). A buyer cannot hold twelve tabs. Regroup into three jobs: **Verify** (exceptions, visit review), **Bill** (claims, remittances, payroll, clearinghouse), **Defend** (audit defense, credentials, authorizations). Navigation, not rebuild.
2. **Dashboard redundancy** — Command Center vs. DashboardPage vs. TodayBoardPage is three answers to "how are we doing?" Pick Command Center as the single front door, make Today Board a drill-in, and fold or retire `/admin/overview` analytics into Command Center.
3. **Route surface (~70 route files)** — fine internally, but freeze net-new top-level routes until the demo path is polished; every new route is new capability-guard and audit-log review surface.
4. **Marketing information architecture** — solutions × platform × resources × compliance is a lot of pages to keep honest. Every page is a claims-liability surface; prune any page that isn't pulling demo requests.
5. **Two learning surfaces** (LearningHubPage vs. LearningPortalPage, plus caregiver-side hub/training/detail) — clarify admin-authoring vs. caregiver-consumption naming so demos don't stumble explaining which is which.

---

## 7. Least-Premium UI Areas

Per the scout's design-system findings, in priority order:

1. **`CommandCenterPage.tsx`** — the flagship screen has 20+ inline `style={{}}` objects and hardcoded gradient hexes. The most-demoed screen is the least-systematized. Fix first.
2. **`LandingPage.tsx`** — a self-contained `<style>` block duplicating the palette; visually ambitious but structurally orphaned from `index.css`. Migrate onto shared tokens (careful: it has its own refined aesthetic — port the tokens *up* into the system where the landing look is better, don't flatten it).
3. **Web/mobile token drift** — teal/orange live in `index.css` and again in `tokens.ts`. One generated source (#2 above).
4. **Empty and loading states outside the tested trio** — EmptyState/ErrorRetry/LoadingSkeleton exist and are tested; audit that *every* admin screen actually uses them. A blank table during a demo reads as broken.
5. **The twelve Compliance Engine screens** — likely built fast and least consistently; after regrouping (§6.1), restyle the surviving screens with the shared card/table/badge classes.

---

## 8. Definition of "Demo-Ready" (concrete and testable)

RayHealthEVV is demo-ready when all of the following pass, on the seeded demo agency (#5), on a cold start:

1. **The 30-minute golden path runs clean:** Landing → Login → Command Center → Today Board → mobile Clock-In inside geofence (live map) → visit appears verified in Visit Review → one exception resolved → Audit Defense shows the resolution in the trail → Go-Live Readiness checklist. Zero console errors, zero blank states, zero copy that references missing data.
2. **Ten-second calm test:** an owner looking at the Command Center can answer "is anything wrong today?" within 10 seconds, without scrolling.
3. **Every number on screen is real:** every KPI, count, and trend is computed from the demo dataset — nothing hardcoded, nothing invented. (This is testable: grep the demo path for literal numeric props.)
4. **Every public claim is defensible:** the forbidden-phrase list (§9.1) passes as an automated test across `packages/web/src/features/marketing/**` and `landing/**` — extend the pattern `HipaaCompliancePage.test.tsx` already established for "HIPAA certified" to the full forbidden list, all pages.
5. **Visual coherence:** the golden-path screens use only `index.css` tokens/classes (no inline hex colors); web and mobile show the same brand palette side-by-side.
6. **Failure grace:** kill the API mid-demo — every screen on the golden path shows ErrorRetry, not a white screen. (RouteErrorBoundary exists; verify coverage.)
7. **Reset in one command:** demo agency restored to a known state in under a minute.
8. **No real PHI anywhere** in the demo tenant, screenshots, or seeded fixtures — enforced by review, and by the fact that the platform is not yet cleared for real PHI at all.

---

## 9. Risk Review

### 9.1 HIPAA language — direction: honest wording, enforced by tests
**Current overclaims found (fix in priority order):**
- `HipaaCompliancePage.tsx:255` — hero `"HIPAA-compliant by design."` and the file's own comment (line ~18) blesses "HIPAA-compliant" as allowed. **It is not.** Replace with approved forms: *"Designed with HIPAA-grade controls"* / *"HIPAA-ready architecture; operational HIPAA readiness in progress."* Update `HipaaCompliancePage.test.tsx:16` which asserts the current headline.
- `HipaaCompliancePage.tsx:365` — *"signs a BAA with every customer agency before…"* — present-tense factual claim with zero customers. Reword to commitment: *"We execute a BAA with every agency before any PHI is processed."* Acceptable only if the BAA template genuinely exists and upstream vendor BAAs (Neon, Resend, Vercel — "in progress" per `PrivacyPage.tsx:190–207`) are closed before first PHI.
- `PricingPage.tsx:66` — *"BAA included; engineered to HIPAA Security Rule controls"* — second half fine; "BAA included" must match the BAA reality above.
- `LoginPage.tsx:403` — "HIPAA compliance documentation" link text: acceptable as a pointer, but the destination page must carry the corrected language.
- **Positive:** `PrivacyPage.tsx`'s per-vendor BAA status table is the model. Make it the canonical source and have other pages defer to it.
**Enforcement:** one shared forbidden-phrase test (per §8.4). Forbidden: "HIPAA certified", "fully HIPAA compliant", "HIPAA-compliant" (as an unqualified product claim), "guaranteed compliance", any implication that real PHI is supported today.

### 9.2 PHI exposure — direction: count-first, PHI-last
- **Analytics:** Vercel Analytics is on the web package. Confirm it is excluded from `/admin/*` and `/portal/*` (authenticated, PHI-bearing routes) or configured to never capture URL params/content. Route paths with IDs (`/admin/staff/:caregiverId`) must not leak to third-party analytics without a BAA.
- **Logs:** audit events store "payload hash" per the scout — keep hashing, never raw payloads with PHI in general server logs. Add a lint/review rule: no `console.log` of request bodies in `packages/app`.
- **AI prompts:** copilot answers "with your agency context" — the context assembly is the PHI choke point. Direction: counts and statuses by default; named-client data only when the user's question requires it, only via the BAA'd inference path (AWS Bedrock is the only "BAA active" vendor per PrivacyPage), and the existing prod ban on `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY` stays permanent. The public `/support/*` AI chat must have **zero** database access — verify it cannot be prompt-injected into a data path.
- **Exports:** 837P, payroll, and audit exports necessarily contain PHI — every export must be audit-logged with actor + scope (verify `export-routes.ts` passes through `audit-log.ts`), and download URLs (S3 documents) must be short-lived and agency-scoped.
- **Cross-agency:** see 9.7.

### 9.3 EVV compliance — direction: protect the chain of custody
- Six-element capture is real (`packages/core/src/domain/evv.ts`, clock-in/out routes). Keep server-side geofence as sole source of truth; client checks are UX only.
- **Clock-out fallback** (always enabled, last-known location) is operationally correct but is the integrity soft spot: every fallback clock-out must be flagged as an exception with reason codes and appear in Visit Review — never silently equivalent to an in-fence clock-out.
- **Edits to visit records** must never overwrite: corrections are new events referencing the original, with actor/reason, consistent with the append-only audit model. If any visit-maintenance path (`/maintenance/*`, `visit-maintenance` domain) does in-place mutation of EVV records, that is the #1 compliance bug to find and fix before first customer.
- Don't advertise telephony/offline modalities (landing article) beyond what's verified (§2.4).

### 9.4 AI usage — direction: propose-only, PHI-minimized, logged
The current posture (human confirms every action; queries and actions audit-logged; rate-limited; BAA-only inference enforced by env-var bans) is the correct ceiling for the next 12 months. Non-negotiables: no auto-execution; PHI-minimized context (count-only where possible); every prompt/response pair referenced in the audit trail (hashed content is fine); public support chat firewalled from tenant data; no new AI vendors without a BAA row added to the Privacy page *first*.

### 9.5 Fake/public marketing claims — direction: remove the fiction, keep the honesty
- **Remove:** "40% Fewer claim denials in the first quarter" (`LandingPage.tsx:16`) — no customer base can support it. Replace with a capability statement ("Denial-risk flags before you bill") or a verifiable fact ("Six federal EVV elements on every visit").
- **Keep:** the outcome-statements-by-role pattern (LandingPage lines 76–89) with its explicit "not fabricated customer quotes" stance — this is the template for all future social proof. No invented logos, names, or agencies, ever; the compliance-alignment badges (PA DHS, Cures Act, Sandata) are fine as *alignment* claims, not endorsements — ensure copy says "aligned," never "certified/approved by."
- **Audit:** "100% Aligned with PA DHS and the Cures Act" — "100%" of a self-defined checklist is defensible only if the checklist is published; prefer dropping "100%."

### 9.6 Audit-packet guardrails (binding on the Audit Packet agent)
**Belongs in the packet:** visit verification status + six-element presence per visit; exception lifecycle (opened/resolved, actor, timestamp, reason code); audit-event chain references (IDs and hashes, not raw payloads); credential/authorization validity at time of service; submission/acknowledgment status to aggregators; counts and date ranges.
**Does NOT belong:** clinical notes or care details beyond service codes; caregiver SSNs/HR data; full GPS coordinate history (packet states in/out-of-fence determination + distance, not a movement trail); other clients' data in any joined view; raw audit payloads; anything outside the requested date/client/caregiver scope.
**Mechanics:** packet generation is itself an audit-logged event with actor and scope; output is agency-scoped by construction (scope derived from `req.auth.agencyId`, never from request body); exports carry a generated-at timestamp and integrity hash; no packet endpoint is reachable without an admin capability guard.

### 9.7 Cross-agency data boundaries — direction: never weaken, keep proving
`auth-context.ts` derives `agencyId` from server-validated session/JWT — correct. Standing rules: (1) no endpoint may accept `agencyId` from body/query as an authority signal; (2) `requireCapability` (`require-capability.ts`) checks role only — it is *not* a tenancy check, so every repository query must filter by the context `agencyId` (direction to downstream agents: prefer repository constructors/methods that *require* agencyId over ad-hoc `.where` clauses); (3) super-admin (`/superadmin/*`) cross-tenant access must be separately audit-logged as cross-tenant; (4) any future "marketplace" idea that shares data across agencies is rejected by default (§3.8); (5) add at least one automated cross-tenant isolation test per major resource (attempt to read agency B's client with agency A's session → 404/403) if not already present.

---

## 10. Directive to Downstream Agents (non-negotiables)

1. **No forbidden HIPAA phrasing, anywhere.** Allowed: "HIPAA-ready architecture", "operational HIPAA readiness in progress", "designed with HIPAA-grade controls", "BAA readiness roadmap". If you touch marketing copy, run the forbidden-phrase test you will find (or create) per §8.4.
2. **No invented numbers, logos, testimonials, or customers.** Capability statements only. The "40%" metric dies and does not come back in another form.
3. **Never weaken agency scoping.** `agencyId` comes from `req.auth` only. New queries filter by it. New routes get a capability guard *and* pass through audit logging.
4. **Audit trail is append-only, forever.** No UPDATE/DELETE paths to `audit_events` or EVV records; corrections are new events.
5. **AI is propose-only, PHI-minimized, BAA-vendored, audit-logged.** The Gemini/Google key prod ban stays.
6. **Design tokens over inline styles.** No new inline hex colors on web; new styles go through `index.css` variables (and the token sync once built). Mobile styles go through `tokens.ts`.
7. **Server is the source of truth for geofence and time.** Client-side checks are UX only.
8. **README fix:** correct the Capacitor claim to Expo/React Native — documentation honesty is product honesty.
9. **Demo work uses the seeded demo agency only.** No real or realistic-looking PHI in fixtures, screenshots, or seeds.
10. **Scope discipline:** nothing on the Do-Not-Build-Yet list (§3) gets built, scaffolded, or "just prototyped" without an updated directive from this document.
