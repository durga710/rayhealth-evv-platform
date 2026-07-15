# Agent 09 — Compliance & Security Review

**Authored by Durga Ghimeray**

---

**Scope reviewed:** the audit-packet feature (route, four new scoped repo methods, web page), the AI surfaces (command-center briefing, admin assistant, copilot ask/execute + context builder), the marketing/claims pages (Landing, Trust Center, HIPAA, Pricing, Privacy), and spot-checks of `auth-context.ts`, `require-capability.ts`, `safe-log.ts`, `cookies.ts`, and the `app.ts` mount/limiter/CSRF wiring. Adversarial, read-only. No source code was modified.

**Totals: 13 findings — 0 Critical · 2 High · 5 Medium · 4 Low · 2 Info.**

---

## Findings (most severe first)

### F1 — HIGH — Forbidden HIPAA claim still shipping: "HIPAA-compliant by design."
- **Where:** `packages/web/src/features/marketing/site/HipaaCompliancePage.tsx:255` (hero `<h1>`); the file's own language-guardrail comment at `HipaaCompliancePage.tsx:18` explicitly *endorses* "HIPAA-compliant" and "HIPAA-aligned" as allowed phrasing; `HipaaCompliancePage.test.tsx:16–19` asserts the forbidden headline, locking it in.
- **What's wrong:** Agent 00 §9.1/§10.1 forbids unqualified "HIPAA-compliant" as a product claim. Agents 00 and 04 both flagged this exact line; it has NOT been fixed. The page simultaneously links to a Privacy page that says vendor BAAs are still in progress — the two pages falsify each other.
- **Failure scenario:** A prospect's counsel (or the FTC, under deceptive-claims doctrine) screenshots `/compliance/hipaa` next to `/privacy`'s "BAA in progress" table. "HIPAA-compliant by design" with no executed Neon/Vercel/Resend/Firebase BAAs and no risk analysis is a materially false compliance representation. One falsifiable claim poisons every honest one on the Trust Center.
- **Required fix (before ship):** Replace the hero with an approved form — `"Designed with HIPAA-grade controls."` or `"HIPAA-ready architecture. Operational readiness in progress."` Rewrite the comment at lines 16–20 to match the Agent 00 §10.1 allowed list (delete "HIPAA-compliant"/"HIPAA-aligned" from the "we use" list). Update `HipaaCompliancePage.test.tsx:16–19` in the same commit and extend it into the shared forbidden-phrase test (Agent 00 §8.4).
- **Recommended fix:** Add the site-wide forbidden-phrase test across `marketing/**` and `landing/**` so this class of regression cannot recur.

### F2 — HIGH — Vercel Analytics mounted at the app root, covering authenticated PHI-bearing routes
- **Where:** `packages/web/src/main.tsx:19` — `<Analytics />` rendered unconditionally beside `<App />`; no `beforeSend` filter; comment at line 18 says "pageview pings only; no PHI in payload."
- **What's wrong:** Vercel Analytics sends the SPA route path on every client-side navigation. That includes authenticated paths carrying entity identifiers — `/admin/audit-packet/:visitId`, `/admin/staff/:caregiverId`, client detail routes, the caregiver portal. Vercel's BAA is **in progress** per `PrivacyPage.tsx` (and mirrored at `TrustCenterPage.tsx:176`). Agent 00 §9.2 is explicit: "Route paths with IDs (`/admin/staff/:caregiverId`) must not leak to third-party analytics without a BAA." The Trust Center also promises (line 315-316) "We do not route real patient data through a subprocessor until a ... BAA ... is executed" — visit/client record identifiers tied to an agency's usage pattern are exactly the data class that promise governs.
- **Failure scenario:** An admin opens an audit packet; the visit UUID and timestamp land in Vercel's analytics pipeline — a non-BAA vendor — creating an out-of-BAA disclosure record the moment real PHI ever enters the system, and contradicting the published subprocessor promise today.
- **Required fix (before ship):** Either (a) render `<Analytics />` only on public marketing routes (gate on `!isAuthenticated` / a route allowlist), or (b) add a `beforeSend` that drops or redacts any event whose path starts with `/admin`, `/portal`, `/caregiver`, `/superadmin` (redact the ID segments at minimum; dropping the events entirely is cleaner and matches the "not excluded from `/admin/*`" directive).
- **Recommended fix:** Add this to `scripts/security-surface-scan.ts` as a CI assertion (Analytics must not observe authenticated routes).

### F3 — MEDIUM — Pricing page: "BAA included" and "7-year retention" outrun the facts
- **Where:** `packages/web/src/features/marketing/site/PricingPage.tsx:66` — `'BAA included; engineered to HIPAA Security Rule controls'`; and `PricingPage.tsx:49` — `'Audit-grade trail, 7-year retention'`.
- **What's wrong:** (a) "BAA included" is a present-tense deliverable while the canonical `PrivacyPage.tsx` table says the upstream vendor BAAs (Neon, Vercel, Firebase, Resend) that a customer-facing BAA depends on are still in progress. Flagged by Agents 00 and 04; not fixed. (b) The retention machinery is built and documented around the HIPAA **6-year** floor (`packages/core/src/repositories/audit-event-repository.ts:146–158` — "6-year retention floor", `eventsApproachingSixYearLimit`). Nothing in the codebase evidences a 7-year guarantee.
- **Failure scenario:** An Enterprise buyer signs on "BAA included," discovers in diligence that the vendor BAA chain isn't executed, and now has a written misrepresentation in the sales artifact. Separately, a compliance officer asks for the 7-year retention policy document and there isn't one — only 6-year plumbing.
- **Required fix (before ship):** Change line 66 to `'BAA executed with your agency before any PHI is processed; engineered to HIPAA Security Rule controls'`. Change line 49 to `'Audit-grade trail, 6-year HIPAA retention'` (or produce a real 7-year policy first).

### F4 — MEDIUM — HIPAA page BAA sentence remains a present-tense factual claim with zero customers
- **Where:** `HipaaCompliancePage.tsx:365` — "RayHealthEVV™ signs a BAA with every customer agency before any production ePHI is processed."
- **What's wrong:** Agent 00 §9.1 required commitment phrasing ("We execute a BAA with every agency before any PHI is processed") and conditioned even that on the BAA template existing and vendor BAAs closing before first PHI. Unchanged. Note the Landing FAQ (`LandingPage.tsx:109`) and Trust Center roadmap (`TrustCenterPage.tsx:90`) already use the approved commitment form — this page is the odd one out.
- **Failure scenario:** "Signs" (habitual present) asserts an existing practice; with zero executed agency BAAs it is falsifiable in one diligence question.
- **Required fix (before ship):** Adopt the exact commitment wording already used on the Landing FAQ and Trust Center: "We execute a BAA with every agency before any PHI is processed."

### F5 — MEDIUM — Privacy page lead implies real PHI is handled today
- **Where:** `packages/web/src/features/marketing/site/PrivacyPage.tsx:38–42` — "We handle Protected Health Information (PHI) on behalf of the home-care agencies that license us as a Business Associate."
- **What's wrong:** Present tense, on the page every other page defers to as canonical, while the Trust Center (`TrustCenterPage.tsx:229–236`) says "No real PHI should be onboarded yet." This is the hard-rule pattern: implying real-PHI onboarding before operational readiness. Agent 07 noted it as an out-of-scope advisory; it is a required wording fix, not an advisory — the canonical page must not be the least accurate one.
- **Failure scenario:** A regulator or plaintiff reads the Privacy summary as an admission that PHI processing is live, importing every unfinished Security Rule obligation (risk analysis, executed BAAs) as a current violation rather than a roadmap item.
- **Required fix (before ship):** Reword to future/conditional: "RayHealthEVV™ is built to handle Protected Health Information (PHI) on behalf of home-care agencies as a Business Associate. Until our operational HIPAA readiness milestones (see /trust) are complete, no real PHI should be loaded into the platform." Keep the "HIPAA-aware" adjective or upgrade it to the approved "HIPAA-ready architecture."

### F6 — MEDIUM — Trust Center overstates AI audit-logging: two of three AI surfaces don't write the append-only trail
- **Where:** Claim: `TrustCenterPage.tsx:162–164` — "AI queries and approved actions are recorded in the same append-only audit trail as every other state change." Reality: (a) admin assistant `POST /admin-assistant/chat` logs the exchange only to the mutable `support_conversations` table, best-effort (swallowed on failure) — `packages/app/src/routes/admin-assistant-routes.ts:189–199`; no `audit_events` row is written. (b) The command-center AI briefing `POST /command-center/briefing` writes **no** log of any kind — `packages/app/src/routes/command-center-routes.ts:91–121`. (c) Only the copilot writes `copilot.query` / `copilot.action.*` audit events (`copilot-routes.ts:210–236, 299–321`), and even those are best-effort.
- **Failure scenario:** A diligence auditor asks "show me the audit-trail rows for these three AI features you advertise as logged." Two of three produce nothing from `audit_events`, converting an honest page into a demonstrably false one.
- **Required fix (before ship):** Either wire `audit_events` writes (`eventType: 'copilot.query'`-class, prompt-hash payload, mirroring copilot-routes) into admin-assistant `/chat` and command-center `/briefing`, or narrow the Trust Center sentence to "Copilot queries and approved actions are recorded in the append-only audit trail; assistant conversations are logged with session and model metadata." Wiring the logging is strongly preferred — the briefing prompt is count-only, so a hash + counts payload is cheap.
- **Recommended fix:** Make the copilot's audit write fail-closed or at least alarmed (see F9).

### F7 — MEDIUM — HIPAA page subprocessor table contradicts the canonical Privacy/Trust tables
- **Where:** `HipaaCompliancePage.tsx:153–172` — lists Vercel, "Postgres provider (Neon or equivalent)", and Expo; omits AWS (Bedrock), Cloudflare, Google Firebase, Resend; has no BAA-status column; and describes the database data class as "ePHI at rest" in the present tense.
- **What's wrong:** PrivacyPage and TrustCenterPage (`TrustCenterPage.tsx:175–182`) publish a six-vendor list with per-vendor BAA status and declare Privacy the canonical, dated source. A third, divergent list — with no status column, a hedge vendor ("or equivalent"), and a vendor the other pages don't disclose (Expo) — breaks the single-source-of-truth promise both other pages make in prose.
- **Failure scenario:** An auditor diffs the three public subprocessor lists and asks which one is true; every answer damages the "canonical, dated source" claim.
- **Required fix (before ship):** Mirror the PrivacyPage table exactly (vendors + BAA status), or replace the table with one line deferring to `/privacy`. If Expo genuinely touches build artifacts only, disclose it consistently on the canonical table or remove it here.

### F8 — LOW — AI-spend endpoints run under the loose default limiter while their sibling gets a tight one
- **Where:** `packages/app/src/app.ts:307` (`/admin-assistant` — no per-route limiter) and `app.ts:315` (`/command-center`, whose `POST /briefing` calls Bedrock) vs. `app.ts:308` (`/copilot` behind `copilotLimiter`, 40/15 min) and `app.ts:303–305` (audit surfaces at 30/15 min). All still sit behind `authenticatedDefaultLimiter` (300/15 min, `app.ts:281`), CSRF (`app.ts:282`), and capability guards — so this is cost/abuse hardening, not an open door.
- **Failure scenario:** A scripted (or XSS-driven, though CSRF+HttpOnly make that hard) session hammers `/admin-assistant/chat` 300×/15 min, each turn fanning out to 4 Bedrock tool-call steps — ~1,200 model+DB round trips per window per IP, an order of magnitude above the copilot's ceiling for the same class of surface.
- **Required fix:** None blocking. **Recommended fix:** mount both under `copilotLimiter` (one-line changes beside `app.ts:307/315`).

### F9 — LOW — Copilot audit writes are best-effort; failures are swallowed
- **Where:** `copilot-routes.ts:232–236` (`copilot.query`) and `:317–321` (`copilot.action.confirmed`) — `catch` writes to stderr and continues.
- **What's wrong:** The audit-packet route correctly treats its disclosure log as a precondition (fail-closed, `audit-packet-routes.ts:274–300`). The copilot — the surface the Trust Center explicitly advertises as audit-logged — silently proceeds if the audit insert fails. Prompts are hashed, so PHI-retention risk is nil; the gap is trail completeness for an *executed action*.
- **Required fix:** None blocking (starter posture defensible for queries). **Recommended fix:** make `copilot.action.confirmed` fail-closed like `phi.export` — an unlogged state change contradicts "every state change is written to an audit table."

### F10 — LOW — Admin assistant's "open exceptions" tool counts resolved exceptions too
- **Where:** `admin-assistant-routes.ts:56–64` — `list_open_exceptions` SQL has no `e.approved_at is null` filter; it counts every `evv_exceptions` row for the agency, then the tool description (`:164`) tells the model these are open-exception counts.
- **Failure scenario:** An owner asks "how many open exceptions do we have?" and gets the all-time total; the AI confidently reports a compliance backlog that doesn't exist (or, worse in a demo, contradicts the Command Center's correct `openExceptions` number on the same screen).
- **Required fix:** None (correctness, not disclosure). **Recommended fix:** add `and e.approved_at is null`, matching the derivation used everywhere else (`approvedAt` set ⇒ resolved, e.g. `audit-packet-routes.ts:207`).

### F11 — LOW — Admin-assistant conversations stored verbatim (with IP) in the public-chat table
- **Where:** `admin-assistant-routes.ts:190–196` — the raw user message and model reply are inserted into `support_conversations`, the same table used by the anonymous marketing chat, with `ip_address`.
- **What's wrong:** Admins will type client names into this box ("did Maria Gomez's visit close out?"). That verbatim PHI-bearing text then lives indefinitely in a mutable table designed for anonymous pre-sales chat, with no retention/purge policy in evidence — while the copilot deliberately stores only a prompt hash for exactly this reason (`copilot-routes.ts:12–14, 208–209`).
- **Failure scenario:** A future support-chat admin view or export surfaces internal agency-context conversations alongside public ones; or a breach of that one table discloses free-text PHI that the copilot's design specifically avoided retaining.
- **Required fix:** None blocking pre-PHI. **Recommended fix (before first real PHI):** store a hash + length like the copilot, or move admin-assistant transcripts to their own table with a documented retention window and agency_id scoping.

### F12 — INFO — "The log cannot be edited, even by us" is slightly absolute
- **Where:** `TrustCenterPage.tsx:66`; same construction at `LandingPage.tsx:71` (compliance-officer quote) and `LandingPage.tsx:97` ("cannot be edited — not even by us").
- **What's wrong / verdict:** Confirms Agent 07's advisory note. A database superuser could drop `audit_events_block_mutation_trg`. This is security-strength phrasing, not a HIPAA overclaim — non-blocking. **Recommended:** Agent 07's suggested tightening: "cannot be edited by the application — a Postgres trigger rejects any UPDATE or DELETE."

### F13 — INFO — "100% Visibility into upcoming renewals" self-graded stat
- **Where:** `packages/web/src/features/marketing/site/WorkforceTrainingPage.tsx:38` — `{ v: '100%', l: 'Visibility into upcoming renewals' }`.
- **What's wrong:** Agent 00 §9.5 disfavors self-graded percentages ("prefer dropping '100%'"). "Visibility" is a capability, so this is far milder than the deleted "100% aligned" — but it is the same pattern. **Recommended:** reword to "Every renewal visible before it lapses" (no percentage).

---

## Audit-Packet PHI & tenancy verdict: **PASS**

The new `GET /admin/audit-packet/:visitId` correctly excludes PHI and scopes **every** sub-read by the caller's agency. Evidence, line by line:

**Tenancy — every read is agency-scoped, agencyId from `req.auth` only:**
- `audit-packet-routes.ts:132` — `const agencyId = req.auth.agencyId;` — no agency identifier is read from params/query/body anywhere in the file.
- Visit: `EvvRepository.getVisitByIdForAgency` (`audit-packet-routes.ts:140`; impl `evv-repository.ts:166–175`, `where('u.agency_id', agencyId)` join) — returns `null` identically for "missing" and "other tenant"; the route returns the same `404 {message:'Visit not found'}` for both (`:141–144`), no existence oracle.
- Audit events: three calls to `findByEntityForAgency(agencyId, …)` (`audit-packet-routes.ts:163–165`); impl `audit-event-repository.ts:69–78` filters `agency_id`. The unscoped `findByEntity` (`:54–59`) is not imported or called in this route, and its doc comment now names it forbidden for cross-tenant surfaces.
- VMUR corrections: `findByVisitIdForAgency` (`:160`; impl `visit-maintenance-repository.ts:102–127`, authorization join `evv_visits → caregivers.agency_id`, deliberately not trusting the denormalized `visit_maintenance.agency_id`).
- Exceptions: `findExceptionsByVisitForAgency` (`:159`; impl `evv-exception-repository.ts:35–44`, same join; the repo NOTE documents the deleted unscoped footgun).
- Caregiver name: `caregiverRepo.findById(visit.caregiverId, agencyId)` (`:155`; impl `caregiver-repository.ts:26–29`, `where({id, agency_id})`).
- Client name/geofence: `getClientNameForAgency` / `getClientGeofence` (`:156–157`; impl `client-repository.ts:97–111` and `:71–88`, both `where({id, agency_id})`).
- Schedule: `getAssignmentScheduleForAgency` (`:158`; impl `schedule-repository.ts:95–111`, joins to `clients.agency_id`).

**PHI minimization — whitelist enforced:**
- Raw lat/lng never cross the API: `deriveGeofence` (`audit-packet-routes.ts:87–119`) consumes the location internally and returns only `{captured, accuracyM, result, distanceM, allowedM}`; the honest four-state `result` includes `not_configured` (no fail-open "within").
- Audit payloads reduced to `payloadSha256` (`:241`), never `payload`.
- Parties are `{id, name}` only (`:182–188`) — no DOB/SSN/Medicaid ID/address/phone/email is selected by any repository method used.
- Every response section is mapped field-by-field (`visitPayload :170–179`, `exceptionsPayload :203–210`, `correctionsPayload :213–228`, `auditEventsPayload :231–242`, `aggregatorPayload :245–250`); no repository row is spread.
- Frontend (`AuditPacketPage.tsx`) renders only the derived geofence facts (`GeofenceCard :174–189`) and hash-truncated identifiers; no coordinate-shaped value exists in the DOM contract.

**Controls:**
- Capability: `requireCapability('audit.read')` (`:125`) — admin-only per `ROLE_CAPABILITIES`; capability check precedes any lookup, so a 403 leaks only the caller's own role.
- Rate limit: mounted under `adminAuditLimiter` (30/15 min), `app.ts:305`, same as its audit siblings.
- **Audit-log-on-generate is mandatory and fail-closed:** the `phi.export` event (`:277–295`) is awaited *before* `res.json` (`:297`) with no inner try/catch — a throw hits the route-level catch (`:301–304`) and returns 500 with no packet body. The event carries the packet's `integritySha256`, binding log row to artifact. A 404 returns before the write, so failed lookups create no false disclosure record.

No blocking defects found in this feature. Agent 06's implementation report is **CONFIRMED** accurate against the code.

## AI/PHI verdict: **PASS with required wording/logging fix (F6)**

- **Command-center briefing is genuinely count-only.** `buildBriefingPrompt` (`command-center-service.ts:199–236`) serializes only aggregate numbers (visit counts, exception counts, expiry counts, rates) plus attention-item titles; no names, no identifiers. Gated by `requireCapability('agency.read')` (`command-center-routes.ts:91`) and agency-scoped composition (`:22–57`). Gap: it writes no audit event (F6).
- **Admin assistant is count-only and tenant-bound.** All four tools return counts/aggregates; every SQL statement binds `ctx.agencyId` as `$1` (`admin-assistant-routes.ts:45–112`); the system prompt forbids naming patients (`:16–21`); capability-gated `agency.read` (`:11`); CSRF via the global `requireCsrf` (`app.ts:282`). Gaps: audit trail (F6), verbatim transcript retention (F11), open-exception filter bug (F10), no tight limiter (F8).
- **Copilot sends no client PHI to the model.** The context blob (`copilot-context.ts:84–129`) contains caregiver `{id, name, status}` (workforce roster data, capped at 50, role-scoped — caregivers see only themselves, family gets an empty blob) and course catalog entries; **no client names, visits, or clinical data**. Inference is Bedrock-only, enforced at boot by the Google/Gemini key ban (`app.ts:184–188`). Prompts are stored as hashes, not text (`copilot-routes.ts:209`). `POST /execute` is human-confirmed, schema-validated, and the executor re-verifies tenancy server-side (`copilot-action-executor.ts:80–96, 136–142` — cross-agency caregiver/course rejected with `ActionAuthorizationError`), so a prompt-injected cross-tenant UUID cannot execute.
- **Propose-only holds.** No AI code path mutates state without the `POST /copilot/execute` human confirmation; the briefing and assistant are read-only.

## Final compliance-wording decision: **APPROVED WITH REQUIRED FIXES**

**Approved as written (verified against code and the canonical Privacy table):**
- `LandingPage.tsx` — the rebuilt page. The "40%"/"100%" fabrications are gone (`:33–41` fact strip is capability-only), the hero trust row (`:26–31`), pain-to-outcome (`:44–50`), role cards with the no-fabricated-quotes stance, the HIPAA FAQ (`:109`, approved commitment form), the softened dead-zone FAQ (`:111`), and the Trust Center teaser (`:93–100`). **Agent 04's removal claims are CONFIRMED.** (F12/F13 phrasing polish recommended, non-blocking.)
- `TrustCenterPage.tsx` — **Agent 07's APPROVED verdict is CONFIRMED for 33 of its 34 audited sentences**: no forbidden phrasing anywhere, roadmap marks nothing complete (`:86–141`), the "No real PHI should be onboarded yet" banner (`:229–236`), and a subprocessor table identical to Privacy (`:175–182`). **One correction to Agent 07:** sentence #29 ("AI queries and approved actions are recorded in the same append-only audit trail") was approved as accurate but is only true for the copilot — see F6; fix the code or the sentence.
- `PricingPage.tsx` — everything except line 49 and line 66 (F3).
- `PrivacyPage.tsx` — the per-vendor BAA status table and the collection/use disclosures remain the model of honesty; only the present-tense lead (F5) must change.

**Required changes (with exact replacements):**
1. `HipaaCompliancePage.tsx:255` → `"Designed with HIPAA-grade controls."` (or `"HIPAA-ready architecture. Operational readiness in progress."`); fix the guardrail comment `:16–20` and `HipaaCompliancePage.test.tsx:16–19` with it. (F1)
2. `HipaaCompliancePage.tsx:365` → `"We execute a BAA with every agency before any PHI is processed."` (F4)
3. `HipaaCompliancePage.tsx:153–172` subprocessor table → mirror the canonical PrivacyPage six-vendor table with BAA status, or defer to `/privacy`. (F7)
4. `PricingPage.tsx:66` → `"BAA executed with your agency before any PHI is processed; engineered to HIPAA Security Rule controls"`; `PricingPage.tsx:49` → `"Audit-grade trail, 6-year HIPAA retention"`. (F3)
5. `PrivacyPage.tsx:38–42` → `"RayHealthEVV™ is built to handle Protected Health Information (PHI) on behalf of home-care agencies as a Business Associate. Until our operational readiness milestones (see /trust) are complete, no real PHI should be loaded into the platform."` (F5)
6. `TrustCenterPage.tsx:162–164` → either wire audit-event logging into admin-assistant `/chat` and command-center `/briefing`, or reword to `"Copilot queries and approved actions are recorded in the append-only audit trail; assistant and briefing requests are logged with model and session metadata."` (F6)
7. `main.tsx:19` → exclude Vercel Analytics from authenticated routes (F2 — a claims issue as much as a technical one, because of the Trust Center subprocessor promise).

**Prior-report verdicts:** Agent 06 (audit packet, both docs) — CONFIRMED accurate. Agent 04 (landing truth-pass) — CONFIRMED, including its §7 follow-up list, which correctly predicted every marketing finding above that remains unfixed. Agent 07 (Trust Center) — CONFIRMED with the single F6 correction noted above.

**Hard-rule sweep results:** No "HIPAA certified"/"fully HIPAA compliant"/"guaranteed compliance" anywhere. No browser sessions in localStorage (only chat session IDs in sessionStorage — `AdminAssistant.tsx:31`, `SupportChat.tsx:26`; auth is HttpOnly cookie, verified `cookies.ts:34–45`, `auth-context.ts:17–43`). No public unauthenticated route exposing tenant data (public mounts are health/marketing/support/invitations/superadmin-login, all rate-limited, `app.ts:247–275`). JWTs pinned to HS256 with mandatory revocable `jti` (`auth-context.ts:59–76`). CSRF global on the authenticated surface (`app.ts:282`). `safe-log.ts` redacts Medicaid/SSN/JWT/secret patterns and never logs request bodies. The one hard-rule violation found is F1; the one binding-directive violation is F2.
