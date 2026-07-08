# Agent 16 - HIPAA Risk Register

**Authored by Durga Ghimeray**

## Scope

Closed the documentation gap where `SECURITY_POLICY.md` referenced a
`RISK_REGISTER.md` that did not exist. The new artifact is intentionally marked
as a draft risk-analysis control requiring officer review/signoff before real
PHI onboarding.

## Changes Completed

- Added `docs/compliance/hipaa/RISK_REGISTER.md` with scope, scoring,
  official HHS OCR references, current risk rows, and pre-PHI approval gates.
- Updated `SECURITY_POLICY.md` to point to the active register instead of a
  future document.
- Replaced the stale 2026-05-09 inline risk table with current open risk themes
  so the policy does not drift from the register.

## Verification

- Stale-reference sweep found no remaining placeholder language for
  `RISK_REGISTER.md`.
- `git diff --check` passed, with Windows LF-to-CRLF warnings only.

## Remaining

- The register still requires Privacy / Security Officer review, private
  evidence attachments, residual-risk approval, and signature before it becomes
  the formal retained HIPAA risk analysis.
