# Security policy

RayHealth EVV processes data on behalf of home-care agencies, including identifiers that — once real-agency onboarding begins — qualify as Protected Health Information (PHI) under HIPAA. We take security disclosures seriously and respond to every reported issue.

## Reporting a vulnerability

**Do not file a public GitHub issue or open a public pull request for security problems.** Public disclosure of an unpatched vulnerability puts every connected agency, caregiver, and family member at risk.

Preferred channel — **GitHub private advisory:**

https://github.com/durga710/rayhealth-evv-platform/security/advisories/new

Use this for anything that could be exploited: authentication bypass, broken access control, injection (SQL, command, prompt), cross-site scripting, deserialization, server-side request forgery, audit-trail tampering, PHI exposure, credential leakage in logs or responses, dependency CVEs that affect us, supply-chain compromise, or unsafe defaults.

Fallback if you cannot use a private advisory — **email:**

`durga@rayhealthevv.com` — encrypt with the PGP key published at https://rayhealthevv.com/.well-known/pgp.asc when available. If no PGP key is published yet, send a plain-text email with the subject `[SECURITY]` and we will follow up with a secure channel.

## What to include

- A clear, reproducible description (or proof-of-concept) of the issue
- The affected version or commit SHA — `git rev-parse HEAD` from your working tree
- The expected impact (data exposure, integrity, availability, compliance)
- Any suggested mitigation, if you have one
- Your preferred name + contact for credit (or "anonymous")

**Do not include real PHI** in the report. If you've stumbled across an exposed dataset, describe the location and shape, do not download or attach it.

## Our response timeline

| Step | Target |
|---|---|
| Acknowledge receipt | Within 1 business day |
| Triage + severity assessment | Within 3 business days |
| Status update | Weekly until resolved |
| Critical / Severity-1 fix in production | Within 7 days of confirmation |
| High / Severity-2 fix | Within 30 days |
| Medium / Low | Best-effort, scheduled into normal release cadence |

We will keep you informed at each step and coordinate on a public disclosure timeline. Default: 90 days from acknowledgment, or sooner if a fix is shipped and patched users have had reasonable time to update.

## Scope

### In scope

- The hosted application at https://rayhealthevv.com and any subdomains
- The API surface (every route under `/api`, including unauthenticated routes like `/api/invites/accept/:token`)
- The mobile Capacitor app shipped to the App Store / Play Store
- Source code in this repository
- Build, CI, and deploy pipelines defined in `.github/workflows/`
- Database migrations and the audit-trail integrity model

### Out of scope

- Social engineering of RayHealth staff
- Physical attacks against any host or device
- DoS / DDoS testing (we do not authorize load testing against production)
- Reports from automated scanners without manual validation
- Self-XSS or attacks requiring an attacker-controlled browser extension
- Reports about software outside our control (Vercel, Neon, Resend, Google AI, AWS Bedrock) — report those directly to the provider

## HIPAA-aligned operational posture

We track the security controls expected of a HIPAA Business Associate, even ahead of formal BAA execution with every subprocessor. Notable practices:

- **Audit immutability** — `audit_events` is append-only at the database level via the `audit_events_block_mutation_trg` trigger. Retention sweep bypasses this trigger inside a single transaction with `SET LOCAL session_replication_role = 'replica'` and is itself audited in `audit_retention_runs`.
- **Encryption in transit** — TLS enforced end-to-end; `sslmode=require` on Neon connections; HTTPS on the application surface.
- **Encryption at rest** — provided by Neon (Postgres) and Vercel (filesystem); CMEK migration tracked in `docs/compliance/hipaa/RISK_ANALYSIS_2026.md`.
- **Authentication** — bcrypt cost-12 password hashes, HttpOnly cookie sessions with CSRF for web, JWT bearer with iOS Keychain / Android Keystore for mobile, no auth in browser `localStorage` (`scripts/security-surface-scan.ts` enforces this as a regression gate).
- **Rate limiting** — login endpoints capped at 10/15 min, public invite-acceptance capped at 20/15 min.
- **Least privilege** — capability-based RBAC, every authenticated route gates on a specific capability.
- **Input validation** — Zod schemas validate every untrusted boundary; database access is parameterized.
- **Audit retention** — configurable per-agency retention with archival before purge.
- **CI security gates** — typecheck, lint, security-surface-scan, dependency-review, CodeQL, gitleaks all run on every PR and block merge on failure.

## Coordinated disclosure credit

If you reported a valid issue and want public credit, we will:

1. Add you to the acknowledgments in the security advisory itself.
2. Add you (with permission) to a "Reporters" section in this file once the issue is patched and disclosed.

We do not currently operate a paid bounty program, but we recognize and thank every legitimate reporter.

## Reporters

Empty until we have something to acknowledge. Welcome to be first.
