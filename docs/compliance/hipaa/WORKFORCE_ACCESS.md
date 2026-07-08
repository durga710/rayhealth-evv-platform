# RayHealth EVV Workforce Access Roster and Procedure

**Authored by Durga Ghimeray**

**Effective:** 2026-07-08
**Owner:** RayHealth EVV Privacy / Security Officer
**Status:** Template control. Real workforce names, training evidence, access
approvals, and termination evidence must be maintained in the private
compliance vault before any real PHI access is granted.

## Purpose

This document defines how RayHealth EVV authorizes, reviews, and removes
workforce access to systems that create, receive, maintain, or transmit ePHI.
It supports workforce security, information access management, security
awareness/training, and documentation-retention expectations under the HIPAA
Security Rule.

Official reference:

- HHS OCR, Summary of the HIPAA Security Rule:
  <https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html>

## Access Principles

- Use unique named accounts only. Shared accounts are prohibited.
- Grant the minimum role needed for the person's job function.
- Production PHI access requires documented approval from the Privacy /
  Security Officer before access is enabled.
- Console access to GitHub, Vercel, Neon, AWS, Firebase / Google Cloud,
  Cloudflare, and email/notification vendors requires MFA.
- Real workforce records belong in the private compliance vault. Do not commit
  personal HR data, private phone numbers, home addresses, identity documents,
  BAA PDFs, console screenshots, or signed training attestations to git.
- Access must be reviewed at least quarterly and immediately after role change,
  termination, suspected compromise, or material system change.

## Application Roles

Source of truth: `packages/core/src/config/pennsylvania.ts`.

| Role | Intended user | Capabilities summary | PHI exposure |
|---|---|---|---|
| `admin` | Privacy/Security Officer or agency administrator | Full agency, staff, client, schedule, EVV, authorization, audit, learning, and billing read/write | Broad PHI |
| `coordinator` | Operations coordinator | Agency/staff/client/schedule/EVV/learning/billing-read workflows, with limited write permissions for operational coordination | Broad operational PHI |
| `caregiver` | Field caregiver | Own schedule, EVV clock-in/out, EVV reads, learning | Assigned-client PHI |
| `family` | Authorized family portal user | Client and schedule reads for linked relationship | Limited linked-client PHI |

## Pre-PHI Access Gate

Before any workforce member receives access to production PHI:

- [ ] Customer and vendor BAAs required for the workflow are executed.
- [ ] Risk register is officer-reviewed and signed.
- [ ] Security/privacy training is complete and dated.
- [ ] Role and systems access are approved by the Privacy / Security Officer.
- [ ] MFA is enabled for all vendor consoles and administrator accounts.
- [ ] User has a unique account and no shared credentials.
- [ ] Access is recorded in the private roster with approval evidence.

## Private Roster Template

Copy this table into the private compliance vault and complete it for each
person with production access. Do not fill real personal details in this public
repo copy.

| Workforce member | Job function | App role | Systems granted | PHI need | Approved by | Approval date | Training date | MFA verified | Last review | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `[Name]` | `[Founder / coordinator / caregiver / contractor]` | `[admin/coordinator/caregiver/family]` | `[App, GitHub, Vercel, Neon, AWS, Firebase, Cloudflare, email]` | `[Minimum necessary reason]` | `[Officer]` | `YYYY-MM-DD` | `YYYY-MM-DD` | `Yes/No/N/A` | `YYYY-MM-DD` | `Active/Removed` |

## Console Access Inventory

| System | Production PHI relevance | Required control | Current status |
|---|---|---|---|
| GitHub | Source code, CI, workflow secrets | Unique account, MFA, least privilege, no PHI evidence committed | Required before PHI |
| Vercel | Web/API hosting, encrypted env vars, logs | Unique account, MFA, BAA before PHI, env-var review | BAA pending |
| Neon | Production Postgres | Unique account, MFA, active BAA/HIPAA mode, audit logging evidence | Active BAA/HIPAA mode |
| AWS | Bedrock, S3 documents, email infrastructure if used | Unique account/IAM role, MFA, least privilege, key rotation | AWS BAA active |
| Firebase / Google Cloud | Mobile push/auth dependencies | Unique account, MFA, BAA before PHI | BAA pending |
| Cloudflare | DNS/edge transit | Unique account, MFA, no stored PHI features unless reviewed | Transit only |
| Email/notification vendor | Transactional messages may reference PHI if misused | BAA before PHI payloads, no PHI in templates by default | Pending / verify chosen vendor |

## Onboarding Checklist

- [ ] Confirm the person has a legitimate job function requiring access.
- [ ] Select the lowest application role that supports that function.
- [ ] Confirm BAAs and pre-PHI gates for the relevant workflow are complete.
- [ ] Create a unique user account; do not share bootstrap/admin credentials.
- [ ] Enable MFA for every console account.
- [ ] Record approval, role, systems, and PHI need in the private roster.
- [ ] Complete security/privacy training and retain attestation privately.
- [ ] Schedule first access review date.

## Quarterly Access Review

At least quarterly, the Privacy / Security Officer must:

- Export or inspect active app users and roles.
- Inspect GitHub, Vercel, Neon, AWS, Firebase / Google Cloud, Cloudflare, and
  email/notification vendor account lists.
- Confirm each active user still has a legitimate job need.
- Downgrade or remove access that is no longer required.
- Review audit events for unusual privileged access.
- Record review date, reviewer, changes made, and evidence location in the
  private compliance vault.

## Offboarding Checklist

Complete immediately when a workforce member leaves, changes role, or no longer
requires PHI access:

- [ ] Disable or remove application account access.
- [ ] Revoke console access in GitHub, Vercel, Neon, AWS, Firebase / Google
  Cloud, Cloudflare, and email/notification vendors.
- [ ] Revoke mobile sessions or refresh tokens where applicable.
- [ ] Rotate shared emergency secrets if the person had access.
- [ ] Confirm no active API keys, tokens, or personal devices retain access.
- [ ] Record removal date, removed systems, reviewer, and evidence location.

## Exceptions

Any temporary elevated access must be recorded with:

- Person and role
- Business justification
- Systems and permissions granted
- Approval date and approver
- Expiration date
- Removal evidence

Temporary elevated access should expire within 24 hours unless the Privacy /
Security Officer records a longer justification.

## Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-07-08 | Founder + assistant | Initial workforce access roster/procedure template created. |
