# Agent 02 — Product Strategy

**Authored by Durga Ghimeray**

---

Anchor positioning (fixed, from Agent 00):

> **RayHealthEVV is the calm command center for Pennsylvania homecare agencies — scheduling, GPS EVV, compliance, billing readiness, caregiver training, and audit defense in one place.**

Everything below serves one buyer emotion: *"nothing is on fire, and if an auditor calls, we're ready this afternoon."* Every claim in this document is a capability statement backed by a real screen or route from the repo scout report. No invented metrics, no invented customers, no unqualified "HIPAA-compliant" language — per Agent 00 §9.1 and §10.

---

## 1. Final Product Narrative

### Elevator version (~4 sentences)

Running a Pennsylvania homecare agency means living in fear of three letters: a denied claim, a missed clock-out, and a DHS audit notice. RayHealthEVV puts your whole operation — scheduling, GPS-verified visits, credentials, authorizations, billing readiness, and caregiver training — on one calm screen, so you know in ten seconds whether anything is wrong today. Every visit captures all six federal EVV elements, every exception lands in a queue that drains to zero, and every action is written to a tamper-evident log that nobody — not even us — can edit. When the audit letter comes, you don't spend three weeks in a filing cabinet; you spend an afternoon assembling evidence the system has been keeping for you all along.

### Expanded version

**The problem, in the owner's words.** A PA homecare agency owner doesn't wake up thinking about software. They wake up thinking: did every caregiver show up yesterday, and can I prove it? Will Medicaid pay for the visits we already delivered? Is there a lapsed credential or a burned-out authorization hiding in a spreadsheet? And the deep one, the 2 a.m. one: if PA DHS audits us, do we survive it? Today those questions are answered by five disconnected tools, a coordinator's memory, and hope.

**What RayHealthEVV actually is.** It is an operating system for the agency, not a feature buffet. One login, three audiences:

- **The owner and admin team** get the Command Center (`/admin`) — a live board that answers "is anything wrong today?" without scrolling. Behind it: the Today Board for real-time visit status, Visit Review for exception handling, Authorizations with burn-down tracking, credential expiry alerts, and a Go-Live Readiness checklist that tells you honestly whether you're ready to operate.
- **Caregivers** get a mobile app (Expo/React Native) built around one job: clock in confidently. A live map shows the geofence, the button tells them exactly why it's enabled or disabled, a shift alert nudges them before start time, and clock-out is always available as a fallback so no one is ever trapped in a broken state — with the fallback surfaced to the office as an exception, not hidden.
- **Compliance and billing staff** get the Compliance Engine — exception resolution, visit-to-claim matching, 837P export, remittance (ERA/835) reconciliation, Sandata Alt-EVV and HHAeXchange submission, payroll-ready exports — organized around three jobs: Verify, Bill, Defend.

**Why it can be trusted.** The trust story is architectural, not decorative. Every visit records the six federal EVV elements required by the 21st Century Cures Act. The geofence decision is made on the server — a modified phone can't spoof it. The audit trail is append-only, enforced by a database trigger; corrections are new events, never overwrites. Every request is scoped to your agency in middleware — tenancy is never something a client gets to claim. Mobile sessions are individually revocable, so a lost phone is a two-click problem. And where the operational HIPAA journey is still in progress — vendor BAAs, formal readiness milestones — we say so, in public, on a dated status table, because in this market honesty *is* the differentiator.

**The payoff.** Fewer surprises before billing, because denial-risk conditions are flagged while you can still fix them. Fewer panicked phone calls, because every fear has a queue and every queue drains to zero. And when the audit letter arrives, the promise the product is built around: **audits become an afternoon.**

---

## 2. Buyer Personas

### 2.1 Agency Owner (economic buyer)

- **Their day:** Split between growth (referral sources, hiring) and dread management (cash flow, payer remittances, whatever the coordinator escalated). Checks in on operations in stolen moments — between meetings, at night, on a phone.
- **Top fear:** A PA DHS audit letter, and its cousin: a denied-claims backlog that quietly starves the agency of cash.
- **Needs from RayHealthEVV:** One screen that says "you're fine" or "here's the one thing that isn't" — in ten seconds. Proof-on-demand for auditors. Confidence that switching platforms won't blow up billing.
- **The moment that wins them:** Opening the Command Center on the demo agency and answering "is anything wrong today?" unprompted, in under ten seconds — then watching Audit Defense produce a structured evidence view for a date range they choose.
- **Message that lands:** *"You'll know in ten seconds if anything's wrong — and when the audit letter comes, you're ready that afternoon."*

### 2.2 Administrator (day-to-day operator, often the real decision-driver)

- **Their day:** Intake paperwork, payer setup, staff files, chasing signatures, fixing whatever the last system got wrong. They are the person who will actually live in the product eight hours a day.
- **Top fear:** Being blamed for a compliance miss they had no visibility into — a lapsed credential, an expired authorization, an unsubmitted EVV batch.
- **Needs from RayHealthEVV:** Everything in one place with a paper trail: staff roster with credential status (`/admin/staff`), client records with geofence setup (`/admin/clients`), authorization tracking (`/admin/authorizations`), bulk import so onboarding isn't manual re-entry (`/admin/import`), and the Go-Live Readiness checklist (`/admin/readiness`) so "are we set up right?" has a definitive answer.
- **The moment that wins them:** Seeing the Go-Live Readiness checklist turn items green as setup completes — the system telling *them* they did it right, instead of them hoping.
- **Message that lands:** *"Nothing falls through the cracks, because everything has a place, a status, and a log."*

### 2.3 Scheduler / Coordinator

- **Their day:** The human router. Callouts at 6 a.m., swaps, "who can cover Mrs. K on Thursday," making sure the caregiver actually has the credential and the client actually has authorization units left. Lives on the phone.
- **Top fear:** Publishing a week that's silently broken — a double-booked caregiver, a visit scheduled against an expired credential or a drained authorization — and finding out from an angry family or a denied claim.
- **Needs from RayHealthEVV:** The visual week board with conflict detection and draft/publish modes (`/admin/assignments`), recurring templates with PA task codes (`/admin/templates`, `/admin/recurring-schedules`), and a live Today Board (`/admin/today`) so "did the 9 a.m. visit start?" doesn't require a phone call.
- **The moment that wins them:** Trying to publish a conflicted week and having the system stop them with a specific, plain-English reason — the mistake caught *before* it becomes real.
- **Message that lands:** *"Publish with confidence — conflicts, credentials, and authorizations are checked before the schedule goes out, not after."*

### 2.4 Compliance Officer (in small agencies, often the owner or admin wearing a second hat)

- **Their day:** Reconciling what was scheduled vs. what was verified vs. what was billed. Working exception queues. Keeping the credential and authorization calendars alive. Preparing for surveys and audits nobody else thinks about until they happen.
- **Top fear:** An unexplainable gap — a visit with a missing element, an edit with no author, a record they can't defend under questioning.
- **Needs from RayHealthEVV:** Visit Review with exception queues (`/admin/review`), the Compliance Engine's Audit Defense and exception-resolution screens (`/admin/compliance-engine/audit-defense`, `/exceptions`), the append-only audit event browser (`/admin/audit-events`), credential compliance tracking (`/compliance-engine/credentials`), and aggregator submission status (Sandata/HHAeXchange) so "did the state receive it?" is a screen, not a support ticket.
- **The moment that wins them:** Watching an exception get resolved and then finding that resolution — actor, timestamp, reason — in the immutable audit trail seconds later. The chain of custody is real.
- **Message that lands:** *"Every action is logged, the log can't be edited — even by us — and corrections are new events, never overwrites."*

### 2.5 Caregiver (the adoption gate — if they won't use it, nothing above matters)

- **Their day:** Driving between homes, delivering hands-on care, squeezing documentation into doorway moments. The phone app is a chore between them and the person they're there for. Low tolerance for friction; justified suspicion of surveillance.
- **Top fear:** Being blamed for a tech failure — "the app wouldn't let me clock in" — and losing pay or trust because of it. Second fear: being tracked all day.
- **Needs from RayHealthEVV:** A today screen that shows exactly where to be and when (DashboardScreen → `/api/mobile/caregiver/today`), a clock-in screen that shows the geofence on a live map with their distance so the button's state is never a mystery (ClockInScreen), a shift alert before start time (shift-alert-scheduler), clock-out that always works as a fallback so they're never stuck, and honest scope: location is captured at clock-in and clock-out for visit verification — the app is not a tracking device.
- **The moment that wins them:** Walking into the geofence, watching the map confirm it, tapping Clock In, and getting the completion celebration at clock-out. Thirty seconds, zero ambiguity, done.
- **Message that lands:** *"Clock in with confidence — the app shows you exactly where you stand, and you're never locked out of clocking out."*

### 2.6 Family / Client Representative (influencer, not a user — no portal exists and none is planned per Agent 00 §3.4)

- **Their day:** Coordinating care for a parent or family member, often from a distance. Their touchpoint is the agency and the caregiver, not our software.
- **Top fear:** The visit that quietly doesn't happen — and nobody being able to tell them for sure.
- **Needs from RayHealthEVV (indirect):** An agency that can answer, immediately and truthfully, "did today's visit happen?" — because the Today Board and GPS verification make it a fact, not a claim.
- **The moment that wins them:** The agency answering their worried call in one breath: "Yes — verified on-site at 9:02, completed at 11:04."
- **Message that lands (delivered *through* the agency, and usable in agency-owner marketing):** *"Every visit is GPS-verified at the door — so when a family asks, your answer is a fact."* We do not build a family portal; we make the agency the hero of that conversation.

---

## 3. Landing Page Messaging

Applies to `packages/web/src/features/landing/LandingPage.tsx`. All copy below passes Agent 00's forbidden-phrase rules (§9.1, §10.1–2).

### Headline

> **The calm command center for Pennsylvania homecare.**

### Subheadline

> Scheduling, GPS-verified EVV, compliance, billing readiness, caregiver training, and audit defense — one platform, one login, one answer to "is anything wrong today?"

### Trust row (directly under the hero — facts and alignments only, no endorsements, no customer counts)

- **Six federal EVV elements, captured on every visit** (Cures Act aligned)
- **Aligned with PA DHS EVV requirements** — Sandata Alt-EVV and HHAeXchange submission built in ("aligned," never "certified/approved by")
- **Tamper-evident audit trail** — append-only by database design; corrections are new events
- **Server-verified GPS geofencing** — the clock-in decision is made on our servers, not the phone
- **Designed with HIPAA-grade controls** — encryption in transit, per-agency data isolation, immutable audit logging; see our compliance page for our honest readiness status

### Replaced claims (explicit, per the brief)

| Remove (invented / overclaimed) | Replace with (honest) |
|---|---|
| "40% fewer claim denials in the first quarter" | **"Denial-risk flags before you bill."** Supporting line: *"Missing EVV elements, authorization gaps, and unit overruns are surfaced in a review queue before claims go out — so problems get fixed pre-submission, not post-denial."* |
| "HIPAA-compliant by design" | **"Designed with HIPAA-grade controls. Operational HIPAA readiness in progress."** Supporting line: *"We publish our vendor BAA status and readiness roadmap openly — see exactly where we stand before you send us a single record."* (Links to the Trust Center / `/compliance/hipaa`, which defers to the `PrivacyPage.tsx` BAA status table as canonical.) |
| "100% aligned with PA DHS and the Cures Act" | Drop the "100%": **"Aligned with PA DHS EVV requirements and the 21st Century Cures Act."** |

### HIPAA/compliance teaser (exact honest phrasing for the landing page section)

> **Security you can verify. Compliance we won't overstate.**
> RayHealthEVV is engineered to HIPAA Security Rule controls: per-agency data isolation enforced on every request, an audit trail that is append-only by database design, revocable mobile sessions, and server-side verification of every clock-in. Our operational HIPAA readiness — including vendor business associate agreements — is in progress, and we publish its status openly. We'll execute a BAA with every agency before any PHI is processed. If a compliance page you're reading anywhere doesn't say exactly where a vendor stands, ask why. Ours does.
> *[Button: See our compliance status →]*

### Section order (top to bottom)

1. **Hero** — headline, subheadline, primary CTA ("Book a 30-minute demo"), secondary CTA ("See how audit defense works").
2. **Trust row** (the five fact/alignment items above).
3. **"Is anything wrong today?"** — Command Center screenshot-led section; the ten-second calm promise.
4. **The five fears, answered** — fear → queue mapping (audit letter → Audit Defense; denials → pre-billing review; missed clock-out → fallback + same-day exception; lapsed credential → expiry alerts + publish guardrails; auth burn-out → burn-down tracking). This *is* the capabilities grid, reframed around the buyer's anxieties.
5. **RayVerify / how EVV verification works** — six elements, server-side geofence, mobile clock-in visuals (keep the existing RayVerify section, on-message).
6. **The Audit Afternoon** — the flagship story: date range in, structured evidence out, every resolution traceable. (Keep the existing "step 05: audits become an afternoon" promise — this section shows the product cashing it.)
7. **Caregiver experience** — the mobile clock-in flow; adoption is an owner concern, so show how little friction caregivers face.
8. **Honest compliance teaser** (the exact copy above).
9. **How switching works** — bulk import (`/admin/import`), Go-Live Readiness checklist, PA task codes built in. De-risks the migration objection.
10. **Pricing teaser** → `/pricing` (with "BAA included" corrected to match BAA reality per Agent 00 §9.1).
11. **Outcome statements by role** — keep the existing pattern with its explicit "these are role-based outcome statements, not customer quotes" stance. No logos, no names, no invented testimonials.
12. **FAQ** — lead with the hard ones: "Are you HIPAA compliant?" (answered honestly), "What happens in a dead zone?" (answered only to the extent verified — do not advertise offline/telephony beyond what Agent 00 §2.4 confirms), "How do we get our data out?" (exports are a feature, not a hostage negotiation).
13. **Final CTA** — "See your agency calm. Book the 30-minute walkthrough."

---

## 4. Admin Command Center Priorities

What an owner must see first at `/admin` (CommandCenterPage), ranked. Everything listed maps to data the repo can compute today (command-center-routes.ts, evv-exception service, credential-policy-service, authorization repository, aggregator transmission services). Rule inherited from Agent 00 §8.3: **every number is computed, never hardcoded.**

1. **Today's visit health strip** — verified / in-progress / upcoming / missed-or-late counts, one glance, no scrolling. This is the ten-second calm test. Click-through → Today Board (`/admin/today`).
2. **Attention queue (exceptions needing a human)** — open EVV exceptions ranked by billing impact: missed clock-outs, out-of-fence fallback clock-outs, missing elements. Click-through → Visit Review (`/admin/review`). The unifying principle: every fear gets a queue, and this is the master queue.
3. **Billing-readiness indicator** — visits verified-and-clean vs. blocked-by-exception for the current billing period; aggregator submission status (Sandata/HHAeXchange batches pending, acknowledged, or errored). Frame as "clean before you bill," never as a denial-percentage promise.
4. **Expiring soon** — credentials and authorizations approaching expiry or unit exhaustion (credential-policy-service + authorization burn-down). Click-through → `/admin/staff`, `/admin/authorizations`.
5. **Schedule integrity for the week ahead** — unfilled shifts, unpublished drafts, conflicts detected. Click-through → `/admin/assignments`.
6. **AI briefing** (existing) — a short, plain-language digest of the above; propose-only, PHI-minimized (counts and statuses, not client details, per Agent 00 §9.4). Positioned below the numbers, never as their replacement — the owner must be able to verify the briefing against the board above it.
7. **Audit-trail heartbeat** — a quiet, small confidence signal: events logged today, retention sweep last run (audit-retention service self-logs). Reinforces "everything is being recorded" without demanding attention.
8. **Go-Live Readiness shortcut** — for pre-launch agencies, a persistent card showing checklist completion (`/admin/readiness`); disappears or minimizes once live.

Consolidation directive (from Agent 00 §6.2): the Command Center is the single front door. Today Board is its drill-in; fold `/admin/overview` (DashboardPage) analytics into the Command Center over time. Do not present a buyer with three competing answers to "how are we doing?"

---

## 5. Caregiver Mobile Priorities

Ranked by adoption impact. All map to existing screens in `packages/mobile/src/features/`.

1. **Clock-in clarity above all** (ClockInScreen) — the live map with geofence circle, distance/accuracy readout, and a button whose enabled/disabled state is always explained on screen. The caregiver should never wonder *why* they can't clock in — show "You're 240 m from the zone" not a dead button. This is the screen that makes or breaks adoption.
2. **Clock-out always works** — the existing fallback (clock-out enabled regardless of fence, last-known location) is the caregiver's safety net; keep it, and keep it honest by flagging every fallback as an exception for office review (Agent 00 §9.3). Caregiver message: "you're never trapped." Office message: "nothing is hidden."
3. **Today at a glance** (DashboardScreen) — visit cards with client, address, time window, geolock indicator, and clear state badges (Now / In progress / Done). The app opens to "where do I need to be," not a menu.
4. **Shift countdown and pre-shift nudge** (shift-alert-scheduler) — the haptic + notification before shift start turns "I forgot to clock in" into a rare event instead of a payroll dispute. Make the countdown visible on the next-visit card.
5. **Completion celebration** — the existing clock-out sparkle moment is not fluff; it is the emotional receipt that "my work is recorded and I'm covered." Keep it fast and skippable, never gating.
6. **Trust and privacy transparency** — a plain-language note (Help screen + first-run): location is captured at clock-in and clock-out to verify the visit; this is not continuous tracking. Caregivers who feel surveilled quietly sabotage adoption; caregivers who feel *protected by the record* become advocates.
7. **Reliability signals** — visible sync/state feedback so a slow network never looks like a lost clock-in. Note the constraint from Agent 00 §2.4: do not promise offline capture in-app or in marketing until the offline story is verified; until then, honest in-app messaging about connectivity beats a claim the field will falsify.
8. **Schedule and history self-service** (ScheduleScreen, VisitsScreen) — week view and visit history reduce "when do I work?" calls to the coordinator, which is an adoption win for the *office*, reinforcing the loop.
9. **Training in the same app** (TrainingScreen) — courses and certificates where the caregiver already lives; positions the app as career support, not just a punch clock.

---

## 6. Trust / Compliance Messaging (feed for the Trust Center agent)

**Voice:** calm, specific, verifiable. Every trust statement follows the pattern *claim → mechanism → where to see it*. We never say "trust us"; we say "here's the mechanism, go look."

**The core trust narrative:** RayHealthEVV's trust story is architectural. Most vendors bolt compliance messaging onto ordinary software; this platform's guarantees are properties of how the system is built — and several are enforced by machines, not policies.

**Pillars (all verified in the repo; cite mechanisms, per Agent 00 §4):**

1. **The log cannot be edited — even by us.** Append-only `audit_events` with a database trigger blocking mutation; the retention sweep logs its own runs. Say it exactly that plainly.
2. **Your agency's data is walled off on every request.** Agency scope derives from a server-validated session in middleware (`auth-context.ts`) — never from anything the client sends. One agency can never see another's records.
3. **Clock-ins can't be spoofed.** The geofence decision is server-side (Haversine check, 422 GEOFENCE_OUT_OF_BOUNDS); the phone's map is feedback, not authority.
4. **Lost phone ≠ lost security.** Mobile sessions are individually revocable (JWTs pinned to a server-side session row); logout and password reset actually terminate access — a genuine differentiator vs. signature-only JWT products.
5. **A security culture you can inspect.** CI fails if browser-storage auth patterns reappear (`security-surface-scan.ts`); CSRF on every state change; bcrypt; TOTP 2FA; optional passkeys; rate limits on every sensitive surface; HSTS/CSP via Helmet.
6. **AI that proposes, never acts alone.** Every copilot action requires human approval; every query and action is audit-logged; inference only through BAA-covered vendors, with non-BAA AI keys banned in production by code.
7. **Honesty as policy.** The dated, per-vendor BAA status table (from `PrivacyPage.tsx`) is the canonical compliance-status source; every other page defers to it. Add "last updated" dates. The Trust Center's most persuasive page is the one that admits what's in progress.

**Approved HIPAA language (the only forms permitted, per Agent 00 §10.1):**
- "HIPAA-ready architecture"
- "Designed with HIPAA-grade controls"
- "Operational HIPAA readiness in progress"
- "BAA readiness roadmap"
- "We execute a BAA with every agency before any PHI is processed" (commitment phrasing — only while the BAA template exists and vendor BAAs close before first PHI)

**Forbidden:** "HIPAA certified," "fully HIPAA compliant," unqualified "HIPAA-compliant," "guaranteed compliance," any implication real PHI is supported today. Enforced by the shared forbidden-phrase test (Agent 00 §8.4).

**Recommended Trust Center structure:** (1) Security architecture — the seven pillars with mechanisms; (2) HIPAA readiness — honest status + BAA table + roadmap with dates; (3) EVV integrity — six elements, chain of custody, corrections-as-new-events; (4) Data boundaries — per-agency isolation, export rights, no data hostage-taking; (5) AI governance — propose-only, PHI-minimized, logged; (6) Status — RayVerify/status page wired to real health endpoints (`/health`, `/health/db`, `/health/audit-pipeline`).

---

## 7. Highest-Impact Feature Priorities (ranked backlog)

Fully consistent with Agent 00's Top 5 and Do-Not-Build-Yet list. Ranked by movement toward a signed PA agency.

1. **Marketing-claims truth pass** (Agent 00 #1) — kill "40% fewer denials" and "HIPAA-compliant by design"; reconcile Pricing/HIPAA/Privacy BAA language; ship the forbidden-phrase test across all marketing pages. *Buyer effect: survives diligence.* Effort: small.
2. **One design system on the demo path** (Agent 00 #2) — Command Center inline styles → `index.css` classes; landing CSS onto shared tokens (porting the landing's superior aesthetic *up* into the system); web/mobile token sync. *Buyer effect: reads as engineered, not assembled.* Effort: medium.
3. **Audit Afternoon: Audit Defense → exportable evidence packet** (Agent 00 #3) — date range + client/caregiver in, structured count-first packet out; §9.6 guardrails binding (no raw payloads, no GPS trails, no cross-client data, packet generation itself audit-logged, scope from `req.auth.agencyId` only). *Buyer effect: the emotional close.* Effort: medium.
4. **Mobile EVV hardening** (Agent 00 #4) — tests for `visit-state.ts`, `geofence.ts`, clock-in/out; verify or retract the offline/telephony landing claim. *Buyer effect: the "dead zone" demo question gets a true answer.* Effort: medium.
5. **Seeded demo agency, resettable, zero PHI** (Agent 00 #5) — fictional PA agency, week of schedules, open exceptions, one in-progress visit, one-command reset. *Buyer effect: every demo is the good demo.* Effort: small-medium. **Note: this is the enabler for the demo script in §8 — sequence it early even though it ranks fifth in customer-facing impact.**
6. **Compliance Engine regroup: Verify / Bill / Defend** (Agent 00 §6.1) — navigation-level consolidation of twelve sub-screens into three jobs; restyle survivors with shared classes. *Buyer effect: a buyer can hold three jobs in their head; twelve tabs read as chaos.* Effort: small (navigation, not rebuild).
7. **Command Center as single front door** (Agent 00 §6.2) — fold `/admin/overview` analytics in; Today Board becomes the drill-in; add the billing-readiness and expiring-soon cards from §4 if not present. Effort: small-medium.
8. **Go-Live Readiness polish** — Agent 00 calls this page "an underrated closer"; make it demo-worthy: clear gates, plain-English items, progress that visibly moves during onboarding. Effort: small.
9. **Empty/error/loading state audit** — every golden-path screen uses EmptyState/ErrorRetry/LoadingSkeleton; kill-the-API test passes (Agent 00 §8.6). Effort: small.
10. **README/documentation honesty fix** — Capacitor → Expo/React Native (Agent 00 §10.8). Effort: trivial; do it in the first PR that touches docs.

**Not on this backlog (Do-Not-Build-Yet, restated so no downstream agent "helpfully" adds them):** new-state expansion beyond dormant NJ config; autonomous AI actions; native payroll/payments; family/client portal; public partner API commitments; Storybook/internal ops dashboards; telephony (TVV) EVV; cross-agency marketplace features.

---

## 8. Demo Story for Agency Owners (30-minute golden path)

**Preconditions:** seeded demo agency (backlog #5), cold start, reset run beforehand; web on the projector, phone in hand (or mirrored); one visit seeded as "scheduled to start during the demo window"; two or three open exceptions seeded, one resolvable live. No real PHI anywhere. Never fake anything live — if a thing isn't built, it isn't in the demo.

---

**Scene 1 — Landing (2 min) · `/`**
*Show:* Hero, trust row, scroll pause on "The Audit Afternoon" section.
*Say:* "Everything on this page is a capability or an alignment — no invented numbers, no fake logos. I want to show you the product cashing the biggest promise on this page: that an audit becomes an afternoon. Let's log in."
*Purpose:* Set the honesty frame early; it makes every later claim land harder.

**Scene 2 — Command Center (5 min) · `/admin`**
*Show:* The live board. Stay silent for ten seconds, then ask *them*: "Is anything wrong at this agency today?"
*Say:* "You just answered that yourself, from a screen you've never seen, in ten seconds. That's the whole design goal. Every count here is computed live — visits verified, exceptions open, credentials expiring, this week's schedule integrity. And every fear on this board has a queue, and every queue drains to zero."
*Then:* Point at the attention queue: "Two exceptions. Hold that thought — we'll resolve one and then watch the system remember we did."

**Scene 3 — Today Board (4 min) · `/admin/today`**
*Show:* Real-time visit statuses; the seeded in-progress visit; the visit scheduled to start in a few minutes.
*Say:* "This is your coordinator's morning. Every visit today — started, verified, running late — without a single phone call. See this 10:30 visit? Maria hasn't clocked in yet. She's about to, and you're going to watch it happen from her side."

**Scene 4 — Mobile Clock-In (6 min) · phone, ClockInScreen**
*Show:* Log in as the demo caregiver. Dashboard shows today's visits. Open the 10:30 visit → live map, geofence circle, distance readout. Walk "into" the fence (seeded coordinates), button enables, clock in. At the end of the scene, clock out → completion celebration.
*Say:* "This is the entire caregiver experience: where am I going, am I in the zone, one tap. The map is feedback — the actual geofence decision happens on our servers, so a modified phone can't fake a visit. And notice clock-out is always available: your caregiver is never trapped by the app. If they clock out outside the zone, it doesn't disappear — it becomes an exception your office sees the same day. Nothing hidden, nobody stuck."
*Beat:* Flip to the projector — the Today Board has moved. "No refresh, no phone call. Your board already knows."

**Scene 5 — Visit Review & exception resolution (6 min) · `/admin/review`**
*Show:* The verified visit with all six EVV elements present. Then open a seeded exception (e.g., yesterday's missed clock-out), resolve it live with a reason code.
*Say:* "Six federal elements on every visit — who, for whom, where, what service, time in, time out. That's the Cures Act requirement, captured automatically. Now the important part: this exception from yesterday. Watch what resolving it looks like — reason code, my name, timestamp. In most agencies this fix lives in someone's memory. Here it becomes a permanent record. And this same queue is what protects your billing: visits with problems get fixed *here*, before a claim ever goes out — denial risk handled pre-submission, not post-denial."

**Scene 6 — Audit Defense (5 min) · `/admin/compliance-engine/audit-defense`**
*Show:* Pick a date range covering the demo. The exception resolution from Scene 5 appears in the trail — actor, timestamp, reason, chained to the original event. Show (or preview, honestly labeled if still in development) the structured evidence packet: verification status, six-element presence, exception lifecycle, aggregator submission status.
*Say:* "Here's the moment this product exists for. The audit letter arrives — today, that means three weeks of panic and a filing cabinet. Here, you pick the date range and the system hands you the evidence it's been keeping the whole time. And the log behind this is append-only at the database level — there is no edit button, not for you, not for us. Corrections are new events pointing at the old ones. That's what 'defensible' means: what auditors distrust isn't mistakes — it's records that can be quietly rewritten. Yours can't be."
*Discipline:* If the export packet isn't shipped yet, say "the packet export ships [honest status]" — never simulate it.

**Scene 7 — Go-Live Readiness & close (2 min) · `/admin/readiness`**
*Show:* The checklist, partially complete for the demo agency.
*Say:* "Last thing, because switching systems is the scariest part of this decision. This checklist is how we onboard you — imports for your clients, staff, and authorizations, PA task codes built in, and you go live when the list says you're ready, not when a sales calendar says so. One honest note before you ask: our operational HIPAA readiness, including vendor BAAs, is in progress and published openly on our compliance page — we'll execute a BAA with your agency before any real records are processed. We'd rather show you exactly where we stand than hand you a claim you can't check. So — want to see this board with your agency's names on it?"
*CTA:* Schedule the onboarding/import working session.

**Timing:** 2+5+4+6+6+5+2 = 30 minutes. **Fallback:** if anything breaks live, the screen must fail to ErrorRetry, not a white screen (Agent 00 §8.6) — and the presenter says "that's our error handling," turning the failure into a trust beat.

---

## Handoffs — the single most important thing for each downstream agent

- **Design System agent:** One token source of truth that both `index.css` and mobile `tokens.ts` consume — and port the landing page's refined aesthetic *up* into the system rather than flattening it. Consistency across the seven demo scenes is the deliverable; the demo path ships zero new inline hex colors.
- **Landing agent:** The truth pass is the feature. Replace "40% fewer claim denials" with "Denial-risk flags before you bill" and "HIPAA-compliant by design" with "Designed with HIPAA-grade controls; operational HIPAA readiness in progress" — and make the forbidden-phrase test pass across every marketing page before any visual work counts as done.
- **Command Center agent:** Win the ten-second calm test — an owner answers "is anything wrong today?" without scrolling, and every number on the screen is computed from real data (the seeded demo agency), never hardcoded. Order per §4: visit health, attention queue, billing readiness, expiring soon, schedule integrity.
- **Trust Center agent:** Every claim follows *claim → mechanism → where to see it*, the `PrivacyPage.tsx` BAA status table (with last-updated dates) is the canonical compliance-status source all other pages defer to, and only the approved HIPAA phrasings in §6 appear anywhere.
- **Audit Packet agent:** Agent 00 §9.6 is binding law — count-first, PHI-last: verification status, exception lifecycle, event-chain references and hashes; no raw payloads, no GPS movement trails, no clinical detail, no cross-client data. Scope derives from `req.auth.agencyId` only, and generating a packet is itself an audit-logged event.
- **Mobile agent:** Clock-in clarity plus the honest fallback — the caregiver always understands why the button is enabled or disabled (distance shown, never a mystery-dead button), clock-out always works, and every fallback clock-out is flagged as an exception rather than hidden. Test `visit-state.ts` and `geofence.ts` before touching visuals; promise no offline capability anywhere until it's verified.
