# Agent 04 — Landing Page

**Authored by Durga Ghimeray**

---

## 1. Scope

Full rebuild of `packages/web/src/features/landing/LandingPage.tsx` per the Agent 02 messaging brief, the Agent 00 honesty rules, and the Agent 03 primitive library. `RayVerifySection.tsx` is reused unchanged (its live/rolling-out framing was already honest). `HeroGraphic.tsx` is dead code — not imported anywhere (confirmed by repo-wide grep) — and was left untouched, out of scope. No `LandingPage.test.tsx` existed to update; `App.test.tsx` asserted on the old hero copy and was updated minimally (see §6).

## 2. Sections built (mapped to the brief's 9 requirements)

1. **Premium hero** — fixed headline/subheadline from the strategy doc, "Book a demo" + "View product tour" (anchors to the new in-page product theater) CTAs, a 4-item trust row (PA-first · six EVV elements · audit trail · caregiver mobile app), and a hero product mockup built entirely from real design-system primitives (`MetricCard`, `StatusPill`, plus hand-rolled `.attention-card` markup using the same tokens/classes as the `AttentionCard` primitive) inside a browser-chrome frame — no stock photo, no screenshot. Captioned "Illustrative preview on a seeded demo agency — not a customer's live data."
2. **Interactive product theater** (`#product-theater`) — four tabs (Command Center · Caregiver Clock-In · Exception Queue · Audit Packet) switched via local `useState`, full ARIA tab/tabpanel semantics. Each panel is built from real primitives: Command Center reuses the attention/metric mockup; Caregiver Clock-In is a geofence map illustration; Exception Queue uses the **`DataTable`** primitive (previously unused anywhere in the app — first real consumer); Audit Packet uses the **`Timeline`** primitive (also previously unused).
3. **Pain-to-outcome** — a five-row before/after table (spreadsheets → one command center; missed clock-outs → same-day exception; denial cleanup → pre-billing flags; audit panic → exportable packet; disconnected systems → one platform), reusing the existing comparison-table CSS pattern.
4. **Role-based sections** — four persona cards (agency owners & administrators, schedulers & coordinators, compliance officers, caregivers), each with a body, a "message that lands" pull-quote, and 3 bullet points, condensed directly from `02-product-strategy.md` §2. A footnote states explicitly these are role-based capability statements, not fabricated customer quotes.
5. **EVV audit defense** — six-element capture, server-verified GPS, append-only edit trail, exception reason codes, exportable evidence packet, paired with two mockup visuals (element checklist + audit log rows), followed immediately by the existing `RayVerifySection` as the deeper trust-engine dive.
6. **Implementation timeline** — Day 1 (agency setup) → Day 2 (import caregivers/clients) → Day 3 (authorizations/task codes) → Day 4 (caregiver training) → Day 5 (pilot visits) → Week 2 (live rollout), rendered with the **`WorkflowStepper`** primitive in vertical orientation (also a first real consumer — Agent 03's report flagged it as built but unwired).
7. **ROI calculator teaser** — a real controlled component (`caregivers`, `visitsPerWeek`, `cleanupHours` state via number inputs) feeding into three `MetricCard` output slots. Outputs intentionally render `—` with honest captions ("Estimated live during your walkthrough", "Illustrative — not a guaranteed outcome") rather than any computed number — see §4 for why.
8. **Trust Center teaser** — six `TrustBadge` items (HIPAA-ready architecture, operational HIPAA readiness in progress, RBAC, tamper-evident audit logging, mobile secure auth, AI/PHI boundaries) plus the exact approved paragraph from the strategy doc, linking to `/trust` (route not yet built — per the brief, this is expected to land via a later Trust Center agent).
9. **CTA footer** — "Book a RayHealth walkthrough" (`/demo`) + "See PA EVV readiness checklist" (`/resources/audit-checklist`, the closest existing real route).

Supporting sections kept: honest fact strip (replaces the old metrics band, see §3), pricing teaser (3 tiers, unchanged claims — already honest), FAQ (kept, one answer softened — see §3), full nav/footer.

Sections **removed** to avoid redundancy with the new required sections and reduce claims-liability surface (all were either superseded or carried the marketing-claims risk Agent 00 flagged): the old capabilities "bento" grid, AI-automation dark band, module deep-dive grid, integrations chip row, old 3-persona "audiences" grid (replaced by the 4-persona role section), old testimonials/outcomes quote bank (folded into role cards), old comparison table (replaced by pain-to-outcome), old 5-step workflow (replaced by the Day 1–Week 2 timeline), old compliance icon list (replaced by the Trust Center teaser), old resources grid, old mission-stats band, and the old `rh-standbar` chip row under the hero (redundant with the new fact strip).

## 3. False claims removed and their honest replacements

| Removed | Location (old) | Replaced with |
|---|---|---|
| `"40%"` — "Fewer claim denials in the first quarter" | `metrics` array, old metrics band | Fact strip: `"PA DHS-aligned"` / "Aligned with PA DHS EVV requirements and the Cures Act" (no invented percentage) |
| `"100%"` — "Aligned with PA DHS and the Cures Act" | `metrics` array | Dropped the "100%" per Agent 00 §9.5; fact strip now says "PA DHS-aligned" without a self-graded percentage |
| Hero eyebrow `"HIPAA-aware"` | old hero eyebrow chip | Removed the ambiguous term entirely from the eyebrow (now "Pennsylvania-built · Cures Act EVV aligned"); HIPAA gets its own section using only approved language |
| Footer `"HIPAA-aware infrastructure"` | old footer bar | `"HIPAA-ready architecture"` (an approved form per Agent 00 §10.1) |
| FAQ: "The app captures the visit offline and retries automatically; a telephony (IVR) fallback covers devices without data" (asserted as a shipped, verified capability) | old FAQ answer on dead zones | Reworded to disclose this is still being validated: *"Caregiver clock-in relies on the mobile app's GPS and connection today. We're validating full offline capture and a telephony fallback before advertising them as guaranteed in every dead zone — if your caregivers regularly work without signal, that's one of the first things we test with you during the pilot week."* This tracks Agent 00 §2.4/§9.3's explicit instruction not to advertise offline/telephony modalities beyond what's verified — it was not in the brief's three named removals, but is squarely inside "remove or soften every unproven claim on the landing page." |
| `"Telephony & offline fallback"` capability tile, `"Telephony & offline EVV: covering every home"` resources article | old module-groups / resources arrays | Both arrays were dropped entirely (see removed-sections list in §2), which also removes this unverified claim's second appearance on the page |
| Compliance section's bare `"HIPAA"` row with no readiness caveat | old compliance icon-list section | Replaced by the Trust Center teaser, which uses only the two approved HIPAA phrasings and states readiness is in progress with a link to the (future) `/trust` status page |
| Old outcomes/testimonial quote bank duplicating persona claims without the disclaimer visible nearby | old `outcomes` array + testimonials section | Folded into the Role-based section, which keeps the "not fabricated customer quotes" disclaimer directly beneath the cards it applies to |

No invented logos, customer counts, or testimonials were added or kept anywhere on the page.

## 4. ROI calculator — structure for future interactivity

`caregivers`, `visitsPerWeek`, and `cleanupHours` are real `useState<number>` values bound to controlled `<input type="number">` fields (ids `roi-caregivers`, `roi-visits`, `roi-hours`). The three `MetricCard` outputs currently render `—` rather than a computed figure — the brief explicitly forbids showing a fabricated result number as if it were real, and no verified formula exists yet (denial-cleanup-hours-saved, etc. are not measured quantities anywhere in the codebase). A future pass just needs to: (1) add a calculation function that takes the three state values, (2) call it in an `onChange`/"Calculate" handler, (3) replace the `"—"` literals with the computed values, keeping the "illustrative" captions until the formula is validated against real agency data. The note under the CTA already echoes the live input values back to the visitor so the component reads as responsive today even before the real math is wired in.

## 5. Primitives used (Agent 03 design system)

`MetricCard`, `StatusPill`, `DataTable`, `Timeline`, `TrustBadge`, `WorkflowStepper` are imported directly from `../../components/index.js` and used as real React components. `DataTable`, `Timeline`, and `WorkflowStepper` had zero consumers anywhere in the app per Agent 03's report ("not yet wired into a consumer") — this page is their first real usage. `AttentionCard` was deliberately **not** imported as a component: its API forces a `react-router` `Link`, which is wrong for a decorative marketing mockup (a hidden/decorative interactive link is an accessibility anti-pattern). Instead, the mockups hand-roll the identical markup/classes (`.attention-card`, `.status-dot`, `data-tone`) that `AttentionCard` itself renders, so the visual and token usage is identical without introducing a stray navigation target. This is called out here in case a future reviewer wonders why `AttentionCard` isn't in the import list.

All colors in the landing page's own scoped `<style>` block are now aliases of `index.css` `:root` tokens (`--accent: var(--color-primary)`, `--ink: var(--color-text)`, etc.) — the file defines zero new brand hex literals. Brand-hued glows/shadows that were previously `rgba(16,116,128,.6)`-style literals (numerically identical to `--color-primary`'s RGB triple) were converted to `color-mix(in srgb, var(--accent) X%, transparent)` so they stay derived from the token rather than a second hardcoded copy of it. The only remaining hex literals in the file are `#000` used twice as `-webkit-mask-image`/`mask-image` stops (a CSS masking convention, not a color choice) — left as-is, consistent with how `index.css`'s own shadow tokens (`--shadow-lg`, etc.) also use literal alpha-tinted rgba rather than `color-mix`.

## 6. Test update

`packages/web/src/App.test.tsx` asserted the old hero text (`/operating system/i`, `/home-care/i`). Updated to assert the new fixed-positioning headline: `/calm command center/i` and `/pennsylvania homecare/i`. No other test files reference the landing page (confirmed by repo-wide grep for `LandingPage`, `rh-hero`, `rh-cell`, `rh-audcard`, `40%` before starting).

## 7. Follow-ups found but explicitly out of scope (per the brief)

Found while scanning for similar false claims elsewhere; **not fixed here**, flagged for the truth-pass/Trust Center agent:

- `packages/web/src/features/marketing/site/HipaaCompliancePage.tsx:255` — hero heading `"HIPAA-compliant by design."` (forbidden per Agent 00 §9.1/§10.1; approved forms are "HIPAA-ready architecture" / "Designed with HIPAA-grade controls").
- `packages/web/src/features/marketing/site/HipaaCompliancePage.tsx:16–18` — a code comment that explicitly *endorses* "HIPAA-compliant"/"HIPAA-aligned" as allowed phrasing, which contradicts Agent 00's directive and should be corrected alongside the heading.
- `packages/web/src/features/marketing/site/HipaaCompliancePage.tsx:365` — "RayHealthEVV™ signs a BAA with every customer agency before..." — present-tense factual claim with zero customers; Agent 00 recommends committment phrasing instead ("We execute a BAA with every agency before any PHI is processed").
- `packages/web/src/features/marketing/site/HipaaCompliancePage.test.tsx:16,19` — asserts on the current (non-compliant) headline text; must be updated in the same pass that fixes the headline, or it will fail.
- `packages/web/src/features/marketing/site/PricingPage.tsx:66` — `"BAA included; engineered to HIPAA Security Rule controls"` — "BAA included" should be reconciled with `PrivacyPage.tsx`'s "in progress" BAA status table (the canonical source per Agent 00 §9.1).

## 8. Accessibility notes

- Product theater tabs use `role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls` and a single `role="tabpanel"` whose `id`/`aria-labelledby` track the active tab.
- New interactive elements (`.rh-theater-tab`, `.rh-faqq`, footer links, nav links) get an explicit `:focus-visible { box-shadow: var(--shadow-focus) }` ring using the same token the rest of the design system uses — several of these previously had only the browser default (or nothing) in the old file.
- The hero mockup, product-theater illustrations, and EVV visuals that are purely decorative repeats of adjacent real text are marked `aria-hidden`; the product-theater tab *panels* themselves are **not** `aria-hidden` (they contain the `DataTable`/`Timeline`/`MetricCard` content directly, which is meaningful to screen-reader users, not decorative).
- `prefers-reduced-motion: reduce` is respected: the local `.rh-rv` scroll-reveal transitions collapse to instant, matching `index.css`'s existing global reduced-motion block that already blankets skeletons, hover-lifts, and the sidebar drawer.
- Number inputs in the ROI calculator have proper `<label htmlFor>` associations.
- No new color pairing was introduced without an existing WCAG-AA-checked counterpart (all badge/text-on-surface pairs reuse the existing `.badge-*`/`.metric-card`/`.trust-badge` token pairs documented as AA in `index.css`).

## 9. Verification

Run from repo root:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/web/tsconfig.json` | **Pass** — no errors. |
| `npm run lint --workspace=@rayhealth/web` | **Pass** — no errors/warnings (the project's ESLint config currently defines no rules beyond the TS parser, so this is a low bar, but it passes cleanly). |
| `npm run test --workspace=@rayhealth/web` | **Pass** — 13 test files, 30 tests, all green, after updating `App.test.tsx`'s hero-copy assertion (see §6). `App.test.tsx` mounts the full `<App>` tree through `BrowserRouter`/`AuthProvider` for an unauthenticated session, which exercises the entire new `LandingPage` render path (product theater, ROI calculator, `WorkflowStepper`, `TrustBadge`, `DataTable`, `Timeline`) without runtime errors. |

## 10. Files changed

- `packages/web/src/features/landing/LandingPage.tsx` — full rebuild (this task).
- `packages/web/src/App.test.tsx` — updated hero-copy assertion to match the new fixed headline.

Files read but not modified (reused as-is, or confirmed out of scope): `packages/web/src/features/landing/RayVerifySection.tsx`, `packages/web/src/features/landing/HeroGraphic.tsx` (unused dead code, not imported anywhere), `packages/web/src/index.css`, `packages/web/src/components/index.ts` and the individual primitive files, `packages/web/src/App.tsx`.
