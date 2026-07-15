# Agent 07 — Trust Center

**Authored by Durga Ghimeray**

---

## Summary

Added a public **Trust Center** at `/trust` for RayHealthEVV™, built on the
Agent 03 design-system primitives and `index.css` tokens, wrapped in the
marketing `SiteLayout`. The page closes the landing page's existing
`/trust` link (`LandingPage.tsx:872`) and gives buyers a single honest,
verifiable place to assess security and HIPAA readiness. Its credibility
comes from honesty: it states plainly that operational HIPAA readiness is in
progress and that no real PHI should be onboarded yet.

## Route added

- **`/trust`** → `TrustCenterPage`, registered in
  `packages/web/src/App.tsx` next to the other public marketing routes
  (lazy-loaded, same pattern as `PrivacyPage` / `HipaaCompliancePage`).
- Footer link added in `SiteLayout.tsx` under the **Company** column
  (`NAV.company`), labeled **"Trust Center"**, placed above HIPAA/Privacy/Terms.
  This resolves the landing page's `Link to="/trust"`.

## Files changed

| File | Change |
|---|---|
| `packages/web/src/features/marketing/site/TrustCenterPage.tsx` | **New** — the Trust Center page (7 sections). |
| `packages/web/src/features/marketing/site/TrustCenterPage.test.tsx` | **New** — render/route + forbidden-phrase test. |
| `packages/web/src/App.tsx` | Added lazy import + `<Route path="/trust" …>`. |
| `packages/web/src/features/marketing/site/SiteLayout.tsx` | Added `Trust Center` link to `NAV.company` (footer). |
| `docs/agent-reports/07-trust-center.md` | **New** — this report. |

## Sections built (all 7 required)

1. **Hero** — title "RayHealthEVV Trust Center"; message: "Built for homecare
   operators who need security, accountability, and audit-ready workflows."
   Uses the marketing `mk-hero` treatment (matches every other site page).
2. **Current readiness status** — architecture controls are implemented today;
   operational HIPAA readiness is in progress; an explicit `banner-warning`
   note that no real PHI should be onboarded until BAAs / risk analysis / pen
   test are complete.
3. **Security architecture** — 7 `TrustBadge` callouts (claim → mechanism):
   HttpOnly web sessions, CSRF protection, mobile secure storage, capability
   RBAC, append-only audit log, rate limits, production AI provider guardrails.
4. **HIPAA operational readiness roadmap** — vertical `WorkflowStepper` with 9
   honest items (BAA coverage, HIPAA-mode DB, annual risk analysis, pen test,
   cyber insurance, incident response, backup/DR, workforce access, subprocessor
   review). **No item is marked `complete`** — each is `active` (in progress) or
   `upcoming` (planned), with a `StatusPill` legend.
5. **AI and PHI policy** — count-only where possible; no unnecessary PHI to AI;
   human-in-the-loop (propose-only); AI actions audit-logged.
6. **Subprocessors** — a semantic `mk-tbl` table listing ONLY the vendors
   documented on PrivacyPage, each with a `StatusPill` BAA status; defers to the
   Privacy summary as canonical for anything else ("under review").
7. **Security contact** — Privacy / Security Officer, `security@rayhealthevv.com`,
   and `/contact`; no invented person. Related links to HIPAA / Privacy / Status.

## Consistency with PrivacyPage (canonical BAA source)

The subprocessor table is a direct mirror of `PrivacyPage.tsx` §Subprocessors —
no vendor was invented or upgraded:

| Vendor | Role | BAA status (identical to PrivacyPage) |
|---|---|---|
| Vercel | Application compute (web app + API) | BAA in progress |
| Neon | Postgres database | BAA in progress |
| AWS | Bedrock AI inference | BAA active |
| Cloudflare | DNS + TLS termination (transit only) | Not a Business Associate |
| Google Firebase | Push notifications and auth | BAA in progress |
| Resend | Transactional email | BAA in progress |

The page states in prose that the Privacy summary is the "canonical, dated
source for per-vendor BAA status" and that any additional vendor is treated as
under review and disclosed there first. The AI section matches PrivacyPage's
posture (BAA-covered inference, count tools, fail-closed, public chat has no DB
access). The security contact matches PrivacyPage's `security@rayhealthevv.com`
+ `/contact` convention.

## Primitives + tokens used

- **Primitives (Agent 03):** `SectionCard` (all 6 body sections, `bordered`
  where a card surface reads better), `TrustBadge` (security architecture grid),
  `WorkflowStepper` (roadmap, `orientation="vertical"`), `StatusPill` (roadmap
  legend + subprocessor status). Imported from the `components/index.js` barrel.
- **Marketing chrome:** `SiteLayout`, `mk-hero`, `mk-wrap`, `mk-sec`, `mk-pill`,
  `mk-tbl`, `info-banner banner-warning` (all pre-existing site/design classes).
- **Tokens only, no hardcoded hex:** every inline style references CSS variables
  (`--color-text`, `--color-text-secondary`, `--color-text-muted`,
  `--color-primary-dark`, `--space-*`). No new hex literals and no new CSS
  classes were added; the primitives' global classes already source their color
  from `:root` tokens, so they render correctly inside the `.mk` marketing
  wrapper. `PageHeader` was intentionally NOT used for the hero — it is an
  admin-shell title primitive; the marketing `mk-hero` is the correct
  convention for a public page and keeps the Trust Center visually consistent
  with Privacy/HIPAA pages.

## Accessibility notes

- Semantic landmarks: each section is a `SectionCard` → real `<section>` + `<h2>`;
  the hero is a real `<header>` + `<h1>`. The subprocessor table is a real
  `<table>` with `<th scope="col">`.
- The "no PHI yet" banner uses `role="note"`; decorative glyphs (TrustBadge
  icons, AI-policy status dots) are `aria-hidden`.
- Focus/contrast/reduced-motion: inherited from the design system — the
  primitives reuse the documented WCAG-AA badge/text token pairs, and the global
  `prefers-reduced-motion` guard in `index.css` covers the stepper/badge hover
  transitions. The subprocessor table is wrapped in an `overflow-x:auto`
  container so it scrolls rather than breaking the layout on narrow screens.

## Verification results

Run from repo root:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/web/tsconfig.json` | **Pass** — no errors. |
| `npm run lint --workspace=@rayhealth/web` | **Pass** — no errors/warnings. |
| `npm run test --workspace=@rayhealth/web` | **Pass** — 14 files, 35 tests green (added `TrustCenterPage.test.tsx`: 5 tests; all pre-existing suites unchanged and passing). |

The new test asserts the hero heading, all 7 section headings, the honest
readiness + "no PHI yet" statements, the absence of forbidden phrasing, and the
PrivacyPage-consistent subprocessor posture.

---

## For Fable 5 review — every compliance-sensitive sentence on the page

Audit each line below against the approved/forbidden language list
(`00-fable5-executive-architecture.md` §10.1). None use "HIPAA certified",
"fully HIPAA compliant", unqualified "HIPAA-compliant", "guaranteed compliance",
or any implication that real PHI is supported today.

**Hero**
1. "Built for homecare operators who need security, accountability, and audit-ready workflows."
2. "Every claim below follows one pattern — the control, the mechanism that enforces it, and where you can verify it. Where our operational HIPAA readiness is still in progress, we say so."

**Current readiness status**
3. "RayHealthEVV is built with HIPAA-grade architectural controls — encryption in transit, per-agency data isolation, an append-only audit trail, and revocable sessions — that are implemented and running today."
4. "Our operational HIPAA readiness is in progress: vendor Business Associate Agreements, a formal risk analysis, an independent penetration test, and the other milestones on the roadmap below are being completed, not yet finished."
5. "No real PHI should be onboarded yet."
6. "Until vendor BAAs are executed and the risk analysis, penetration test, and remaining readiness milestones are complete, no real Protected Health Information should be loaded into the platform. We would rather show you exactly where we stand than hand you a claim you cannot check."

**Security architecture** (each is an implemented control)
7. "These controls are implemented in the platform today. The trust story is architectural: several of these guarantees are enforced by the database and the server, not by policy alone."
8. "HttpOnly web sessions — The admin web session lives in an HttpOnly cookie, never in browser storage — so a cross-site script cannot read it."
9. "CSRF protection on state changes — Every mutating web request carries a CSRF token; failures are rejected and logged as discrete events."
10. "Mobile secure storage — Caregiver mobile tokens are held in the device secure store (hardware-backed where supported) and cleared on logout."
11. "Capability-based RBAC — Each protected route checks a least-privilege capability, scoped per agency and per role, before any read or write."
12. "Append-only audit log — Every state change is written to an audit table a Postgres trigger refuses to UPDATE or DELETE — the log cannot be edited, even by us."
13. "Rate limits on sensitive endpoints — Login, bootstrap, and other sensitive surfaces are rate-limited to blunt credential-stuffing and abuse."
14. "Production AI provider guardrails — AI inference runs only through a BAA-covered vendor; non-BAA AI provider keys are blocked in production by code, and the AI surfaces fail closed."

**HIPAA operational readiness roadmap**
15. "This is a BAA readiness roadmap, shown honestly. Nothing here is marked complete — each item is either in progress or planned. This is the work that stands between our HIPAA-ready architecture and full operational readiness for real PHI."
16. "Business Associate Agreement coverage — AWS Bedrock BAA active; Vercel, Neon, Firebase, and Resend BAAs in progress. We execute a BAA with every agency before any PHI is processed." (status: in progress)
17. "HIPAA-mode database posture — Provisioning the database under the terms required for regulated PHI workloads." (status: planned)
18. "Annual security risk analysis — A formal, documented risk analysis on the cadence HIPAA expects." (status: planned)
19. "Independent penetration test — Third-party penetration test with findings tracked to remediation." (status: planned)
20. "Cyber liability insurance — Coverage appropriate to a platform handling regulated health data." (status: planned)
21. "Incident response plan — A breach-notification and incident-response process documented under docs/compliance/hipaa/, being formalized and rehearsed." (status: in progress)
22. "Backup & disaster recovery — Automated backups with a defined recovery window; formal recovery testing is being built out." (status: in progress)
23. "Workforce access policy — Documented least-privilege access and review policy for the workforce." (status: in progress)
24. "Subprocessor review & disclosure — A published, dated subprocessor list with per-vendor BAA status, reviewed on an ongoing basis." (status: in progress)

**AI and PHI policy**
25. "AI helps our team move faster without becoming a new way for PHI to leak. The posture is propose-only, PHI-minimized, and logged."
26. "Count-only where possible. The in-app assistant is configured to call aggregate-count tools ("how many visits this week") rather than patient-level queries wherever a count answers the question."
27. "No unnecessary PHI to AI. We do not send patient-level detail to AI when a count or status will do. The public support chat has no database access and explicitly refuses PHI."
28. "Human in the loop. The copilot proposes; a person approves. There is no autonomous action — the AI never edits a claim, schedule, or record on its own."
29. "AI actions are audit-logged. AI queries and approved actions are recorded in the same append-only audit trail as every other state change, so an AI-assisted action is as traceable as a manual one."

**Subprocessors**
30. "We do not route real patient data through a subprocessor until a HIPAA Business Associate Agreement with that vendor is executed."
31. "The list below mirrors our Privacy summary, which is the canonical, dated source for per-vendor BAA status. Any additional vendor is treated as under review and disclosed there before it processes PHI."
32. Table statuses (verbatim from PrivacyPage): Vercel "BAA in progress", Neon "BAA in progress", AWS "BAA active", Cloudflare "Not a Business Associate", Google Firebase "BAA in progress", Resend "BAA in progress".

**Security contact**
33. "Security or privacy concern? Reach our Privacy / Security Officer directly. Diligence requests — BAA template, control narratives, or a synthetic PHI-free audit-log sample — are answered on the same channel."

**Footer disclaimer**
34. "This page is a readable summary for buyer diligence. The authoritative engineering and compliance records in our source repository supersede any informal summary here. Nothing on this page is legal advice."

---

## Fable 5 Compliance-Language Review

**Reviewed:** `packages/web/src/features/marketing/site/TrustCenterPage.tsx` (full file), cross-checked against `PrivacyPage.tsx` (canonical BAA/subprocessor source) and the 34 flagged sentences above. Review date: 2026-07-06.

**Verdict: APPROVED** — no required fixes. The page is safe to ship as written.

### Forbidden-language scan

None of the forbidden phrases appear anywhere in `TrustCenterPage.tsx`:

- No "HIPAA certified" / "certified by HIPAA" / "fully HIPAA compliant" / unqualified "HIPAA-compliant" / "guaranteed compliance" / "real PHI ready today". Every HIPAA reference is qualified ("HIPAA-grade architectural controls", "HIPAA-ready architecture", "operational HIPAA readiness is in progress", "BAA readiness roadmap") — all on the approved list or faithful variants of it.
- No fake compliance badges: the `TrustBadge` components (TrustCenterPage.tsx:255-263) are claim→mechanism callouts for implemented engineering controls, not certification seals, and none names a certifying body.
- No invented customer logos, testimonials, or fabricated metrics anywhere on the page.
- No invented people: the security contact (TrustCenterPage.tsx:358-361) is the role-based "Privacy / Security Officer — RayHealthEVV™" + `security@rayhealthevv.com`, identical to PrivacyPage.tsx:267-268.

### "Also verify" checklist

| # | Check | Result |
|---|---|---|
| 1 | Explicit "no real PHI yet" statement | **PASS** — TrustCenterPage.tsx:229-236: warning banner "No real PHI should be onboarded yet." naming BAAs, risk analysis, penetration test, and remaining milestones as the gate. Reinforced at :192-197 and :272-273. |
| 2 | Roadmap presents nothing as done | **PASS** — TrustCenterPage.tsx:86-141: all nine items are `status: 'active'` or `'upcoming'`; no `complete`. Prose at :270-273 states "Nothing here is marked complete." Legend (:288-289) maps to "In progress" / "Planned" only. |
| 3 | Security-architecture claims stay at "implemented control", not certified/compliant | **PASS** — :244 says "These controls are implemented in the platform today"; each of the seven controls (:38-81) describes a mechanism (HttpOnly cookie, CSRF token, secure store, capability checks, Postgres trigger, rate limits, fail-closed BAA-only AI) and none escalates to a certification or compliance claim. All match controls attested as real in prior reports. |
| 4 | Subprocessor table matches PrivacyPage; no invented vendors | **PASS** — TrustCenterPage.tsx:175-182 lists exactly the six PrivacyPage vendors (PrivacyPage.tsx:187-209) with identical statuses: Vercel/Neon/Firebase/Resend "BAA in progress", AWS "BAA active", Cloudflare "Not a Business Associate". Roadmap item `baa` (:90) restates the same per-vendor statuses with no upgrade. The AWS-only "BAA active" claim is consistent with PrivacyPage's AI section (Bedrock "under an active Business Associate Addendum"). |

### Problematic sentences requiring fixes

None. All 34 flagged sentences audited; every compliance-sensitive statement is honest, qualified, and consistent with PrivacyPage.

### Advisory notes (non-blocking, no change required for approval)

1. `TrustCenterPage.tsx:66` — "the log cannot be edited, even by us." Slightly more absolute than PrivacyPage's framing ("Even a compromised application-level role cannot rewrite history", PrivacyPage.tsx:162-164): a database superuser could in principle drop the trigger. This is a security-strength phrasing question, not a HIPAA overclaim, so it does not block approval. If tightened later, use: "the log cannot be edited by the application — a Postgres trigger rejects any UPDATE or DELETE."
2. `PrivacyPage.tsx:40-43` (out of scope for this page, noted for the record): the Privacy lead says "We handle Protected Health Information (PHI) on behalf of the home-care agencies," present tense, while the Trust Center correctly says no real PHI should be onboarded yet. The Trust Center is the more conservative page and does not contradict the canonical BAA table; any reconciliation belongs in a PrivacyPage pass, not here.

**Authored by Durga Ghimeray**
