# Agent 17 - Workforce Access Template

**Authored by Durga Ghimeray**

## Scope

Closed the policy gap where `SECURITY_POLICY.md` referenced
`WORKFORCE_ACCESS.md` before the file existed. The new file is a
template/procedure only; it does not
pretend that real workforce approvals, training attestations, or access-review
evidence already exist.

## Changes Completed

- Added `docs/compliance/hipaa/WORKFORCE_ACCESS.md` with access principles,
  application-role mapping, pre-PHI access gates, private roster template,
  console inventory, onboarding, quarterly review, offboarding, and temporary
  elevated-access exception procedures.
- Updated `SECURITY_POLICY.md` to link the active workforce access artifact and
  clarify that personnel evidence belongs in the private compliance vault.
- Updated `RISK_REGISTER.md` so the credential-compromise row reflects that the
  template exists while private roster completion remains open.

## Verification

- Stale-placeholder sweep found no remaining future-workforce-access wording in
  the HIPAA docs.
- `git diff --check` passed, with Windows LF-to-CRLF warnings only.

## Remaining

- The Privacy / Security Officer must complete the private workforce roster,
  training evidence, MFA verification, and quarterly access-review records
  before any real PHI access is granted.
