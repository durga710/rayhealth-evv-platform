# Agent 05 — Command Center

**Authored by Durga Ghimeray**

---

## 1. Scope

Agent 03 already migrated `CommandCenterPage.tsx` off inline styles onto the shared design-system primitives (`PageShell`, `PageHeader`, `SectionCard`, `MetricCard`, `AttentionCard`, `CommandPanel`, `StatusPill`) — see `docs/agent-reports/03-design-system.md`. This pass built **on top of** that refactor per the brief: same primitives, same file (`packages/web/src/features/admin/CommandCenterPage.tsx`), reorganized into the seven zones from `02-product-strategy.md` §4 ("Admin Command Center Priorities") in their ranked order, with every displayed number traced back to a real field the API returns. No backend change was made — the existing `/api/command-center/summary` response already carried enough real fields to build all seven zones honestly.

## 2. Real API response shape built against

Read first, source of truth: `packages/app/src/routes/command-center-routes.ts` (`GET /api/command-center/summary`) and `packages/core/src/services/command-center-service.ts` (`buildCommandCenterAttention`, `buildBriefingPrompt`).

```ts
{
  asOf: string;               // 'YYYY-MM-DD'
  generatedAt: string;        // ISO timestamp
  today: { scheduledToday, completed, inProgress, lateStart, upcoming };
  exceptions: { openExceptions };
  authorizations: { activeAuthorizations, expiringIn14d, recentlyExpired };
  credentials: { activeCredentials, expiringIn30d, recentlyExpired };
  claims: { verifiedVisitsLast7d, flaggedVisitsLast7d };
  payroll: { verifiedHoursLast7d, inProgressVisits };
  training: { complianceRate, overdue, expired };
  coverage: { totalGaps };
  attention: Array<{ id, severity: 'critical'|'warning'|'info', title, detail, count, to }>;
}
```

`attention` is pre-sorted server-side (critical → warning → info, then by count) by the pure `buildCommandCenterAttention` function in `command-center-service.ts` — the UI never re-derives severity or ordering, only aggregates counts from the already-sorted list (`severityCounts`) and reads the first element as the top priority. This keeps the client a pure renderer of server-computed facts, per Agent 00 §8.3 ("every number is computed, never hardcoded").

`POST /api/command-center/briefing` is unchanged — still count-only (built from `buildBriefingPrompt`, which never receives client/caregiver names), gated on `isAIConfigured()`, degrading to `{ available: false, reason }`.

## 3. Zones built (in priority order) and what backs them

1. **Summary Hero** (`PageHeader`) — greeting + first name (`useAuth`); a derived agency-status `StatusPill` (`Action needed` / `Monitor` / `All clear`) computed purely from the real severity counts in `data.attention` (critical > 0 → danger, else warning > 0 → warning, else success — no invented threshold, just the same three buckets the attention engine already uses); a one-line "Top priority: {top attention item's own title}." headline (or "Nothing needs your attention right now." when the queue is empty); the existing AI-briefing CTA sits directly below the hero as the very next element (`CommandPanel`, unchanged behavior); and a "Updated {time}" readout in the header actions row next to Refresh, sourced from `data.generatedAt`. **No readiness score is shown** — the API does not compute one (see §5, backend follow-up).

2. **Priority / Attention Queue** (`SectionCard` "Needs attention") — unchanged `AttentionCard` list, now with a `SectionCard` `action` slot showing per-severity `StatusPill` count badges (`N critical` / `N warning` / `N info`, only rendered when their count is > 0) and a "Resolve next →" link that deep-links to the *first* (highest-priority) attention item's own `to` route. Empty state now uses the shared `EmptyState` primitive instead of a hand-rolled `info-banner` div, with a "View today's board" CTA.

3. **Today's Visit Operations** (`SectionCard` "Today's visit operations") — the existing 5-tile metric grid (scheduled/completed/in-progress/late/upcoming), now preceded by a completion progress bar (`completed / scheduledToday`, guarded against division by zero) and a "Open Today Board →" link in the section header, satisfying the "progress bar + link to Today Board" requirement.

4. **Compliance Risk Strip** (`SectionCard` "Compliance risk") — open exceptions, authorizations expiring in 14d, **authorizations recently expired** (newly surfaced — the field existed in the API response but had no card before), credentials expiring in 30d (with expired-credentials count in the sub-line), training compliance rate (with overdue count), coverage gaps. Every field here already existed in the summary payload; the only change is surfacing `authorizations.recentlyExpired` as its own tile since it drives a real attention item (`authorizations-expired`) but previously had no visible KPI.

5. **Billing Readiness** (`SectionCard` "Billing readiness", new) — split out of the old combined "Compliance & readiness" grid: a `StatusPill` reading "Clean — ready to bill" (success) or "N visits need review" (warning) derived from `claims.flaggedVisitsLast7d === 0`, framed per Agent 00 §9.5 as "clean before you bill," never a denial-percentage claim; verified visits (7d), flagged visits (7d), verified hours (7d) with open-visits sub-line. Links to `/admin/compliance-engine/claims`.

6. **Quick Action Dock** (`SectionCard` "Quick actions") — expanded from 4 to the 6 actions the brief names: Schedule a visit (`/admin/assignments`), Add a client (`/admin/clients`), Invite a caregiver (`/admin/staff`), Review EVV exceptions (`/admin/compliance-engine/exceptions`), Generate audit packet (`/admin/compliance-engine/audit-defense`), Open billing queue (`/admin/compliance-engine/claims`). All six routes exist today and are reachable from `App.tsx`'s route table. **Note:** "Generate audit packet" intentionally points at the existing Audit Defense screen — there is no dedicated `/admin/audit-packet` route yet (Agent 00 #3 / the Audit Packet agent's future work). This is called out in a code comment above `quickActions` so whoever ships that route knows to update the link.

7. **Empty states** — the "Needs attention" zone's all-clear state now uses the shared `EmptyState` primitive (title "All clear", honest body copy, "View today's board" CTA) instead of a bespoke `info-banner` block, per the brief's explicit ask to use the primitive here.

## 4. What was NOT rendered, and why (backend follow-ups)

- **Readiness score** (Summary Hero) — the API returns no single "go-live readiness %" or "operational readiness score." `GoLiveReadinessPage.tsx` computes its own client-side view from `/api/agencies/current/billing`, `/api/agencies/current/fee-schedule`, `/api/agencies/me/sandata-config`, `/api/clients`, `/api/staff` — a different, heavier call shape than the Command Center summary. Rather than fabricate a number or bolt five extra fetches onto the daily ops board, the hero omits it. **Follow-up:** if a future agent wants a Go-Live Readiness shortcut card on the Command Center (Agent 00 §7 item #8 / product-strategy §4 item #8), the honest path is a small, cheap, purpose-built endpoint (e.g. `GET /api/command-center/readiness-summary` returning just a completed/total checklist count) rather than reusing the readiness page's five-call composition.
- **Audit-trail heartbeat** (product-strategy §4 item #7) — a real endpoint exists for this (`GET /admin/audit-retention/status`, `packages/app/src/routes/audit-retention-routes.ts`, returns `hot.eventsLast30Days`, `lastSweep`, etc.) but it requires `audit.read` capability and is a separate round-trip from the Command Center summary. It was left out of this pass because the task's numbered zone list (1–7) does not include it, and adding a 7th fetch to the daily ops board is a real product/perf decision, not something to slip in unasked. **Follow-up:** wiring a quiet "N audit events logged in the last 30 days · last sweep {date}" footnote is straightforward if a future agent wants it — the data already exists at `/admin/audit-retention/status`.
- **Go-Live Readiness shortcut card** — same reasoning as the readiness score above; the page and route (`/admin/readiness`) exist and are already in the main nav, so an owner is never more than one click away from it, but there is no cheap "is this agency still pre-launch" signal to gate a shortcut card's visibility without fabricating one.

No fields were invented and no counts were hardcoded — every number rendered still traces to a field in the summary response documented in §2.

## 5. Primitives used

`PageShell`, `PageHeader`, `SectionCard`, `MetricCard`, `AttentionCard`, `CommandPanel`, `StatusPill` (all pre-existing from Agent 03), plus `EmptyState` (pre-existing from before Agent 03, now actually wired into Command Center's all-clear state for the first time). No new primitive components were created. Two small CSS-only additions to `index.css` (all token-driven, zero new hex): `.command-hero__subtitle` / `.attention-header-actions` (flex-row layout helpers) and `.progress-row` / `.progress-track` / `.progress-fill` / `.progress-row__label` (the new completion progress bar — `.progress-fill`'s width is the one legitimate per-render inline style, since it's a computed percentage from live data, not a hardcoded value; its color still comes from `--color-primary` / `--color-success` via `data-tone`).

## 6. Backend changes

None. The route file (`command-center-routes.ts`) and service (`command-center-service.ts`) are untouched — every zone was built from fields the summary endpoint already returned. `authorizations.recentlyExpired` was already in the payload; it just had no UI consumer before this pass.

## 7. Accessibility notes

- `SectionCard`'s `action` slot (used for severity badges + "Resolve next", and for the "Open Today Board" / "Open claims" links) renders inline with the existing `<h2>` heading via the pre-existing `.section-card__header` flex row — no new landmark issues.
- The new progress bar is presentational only; its meaning ("N of M visits completed") is carried in adjacent text (`.progress-row__label`), not color alone, so it doesn't rely on color perception.
- `StatusPill` badges (severity counts, agency status, billing-clean/needs-review) all render as text + tone, never tone-only — screen readers get the label ("2 critical", "Action needed", "Clean — ready to bill") directly.
- All new interactive elements (the "Resolve next", "Open Today Board", "Open claims" links, and the `EmptyState` CTA) are real `<a>`/`<Link>` elements picked up by the existing `:focus-visible` treatment already defined for `.attention-card`, `.metric-card-link`, and `.action-card__link` in `index.css` — no new focus-trap or missing-focus-ring regressions.
- The existing global `@media (prefers-reduced-motion: reduce)` block in `index.css` (added by Agent 03) already zeroes all `transition-duration`/`animation-duration` site-wide, so the new progress-bar fill's `transition: width 0.3s ease` is automatically neutralized under reduced motion without any extra rule.

## 8. Verification

Run from repo root:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/web/tsconfig.json` | **Pass** — no errors. |
| `npm run lint --workspace=@rayhealth/web` | **Pass** — no errors/warnings. |
| `npm run test --workspace=@rayhealth/web` | **Pass** — 13 test files, 30 tests, all green. |

`packages/app` and `packages/core` were not touched (no route or service changes), so their test suites were not re-run per the brief's conditional instruction.

`CommandCenterPage.test.tsx` was extended (not replaced) with new assertions covering the additions: the derived "Action needed" / "Top priority: …" hero copy, the "1 critical" severity badge and "Resolve next" deep-link, the "4 of 10 visits completed (40%)" progress readout, the "Clean — ready to bill" billing-readiness pill, and all six Quick Action Dock labels. The original two tests (attention deep-link + coverage-gap KPI, and the on-demand AI briefing flow) were left exactly as they were and still pass unmodified.

## 9. Files changed

- `packages/web/src/features/admin/CommandCenterPage.tsx` — restructured into the seven zones described above.
- `packages/web/src/features/admin/CommandCenterPage.test.tsx` — extended with assertions for the new zones (existing assertions untouched).
- `packages/web/src/index.css` — added `.command-hero__subtitle`, `.attention-header-actions`, `.billing-readiness-row`, `.progress-row`, `.progress-track`, `.progress-fill` (+ `[data-tone='success']`), `.progress-row__label`. No existing rules were modified.
