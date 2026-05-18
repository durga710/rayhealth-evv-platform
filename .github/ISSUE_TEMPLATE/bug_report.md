---
name: Bug report
about: Something is broken in production or staging
title: 'bug: '
labels: bug
assignees: durga710
---

## What's broken

<!-- One sentence. "Caregiver invite acceptance returns 500 when the access code has a lowercase letter." -->

## Where

- Surface: web admin / caregiver mobile / API / DB migration / Vercel deploy / other: ___
- URL or endpoint:
- Agency ID (if applicable, NOT a real PHI agency):
- Caregiver / user UUID (synthetic / fixture only — NEVER paste a real PHI identifier):

## Steps to reproduce

1.
2.
3.

## Expected vs actual

- Expected:
- Actual:

## Logs / stack trace

```
<!-- Paste here. Redact any DB connection strings, JWT contents, or anything that could contain PHI. -->
```

## Severity

- [ ] P0 — production down for all users
- [ ] P1 — production degraded, or a path is completely broken
- [ ] P2 — workaround exists, fix this sprint
- [ ] P3 — quality-of-life, fix when convenient

## Security-sensitive?

If this bug could be exploited (auth bypass, data leak, injection, privilege escalation, brute-force vector), **do not file it as a public issue.** Email durga@rayhealthevv.com or follow the disclosure process in `SECURITY.md`.
