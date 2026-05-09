# Organization (Agency) Scoping — Implementation Guarantees

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** RayHealth EVV Security Officer
**Cross-references:** `SECURITY_POLICY.md` §5.2; `INCIDENT_RESPONSE.md` §8

This document explains *how* RayHealth EVV prevents one home-care
agency from seeing another agency's data — the single most important
control in any multi-tenant healthcare platform. It is the engineering
reference behind the policy claim that "every PHI query is scoped by
`agency_id`".

If you are responding to a suspected tenant-isolation incident
(`INCIDENT_RESPONSE.md` §1 calls these out as SEV-1), this is the
document that tells you what *should* be true so you can spot
deviations.

---

## 1. The Trust Boundary

Every authenticated request to the RayHealth API carries a server-issued
credential that establishes which agency the user belongs to. There are
exactly two credential types:

| Credential | Issued by | Expires | Carries |
|---|---|---|---|
| Cookie session (web) | `POST /auth/login` | 8 hours | `sessionTokenHash` ↔ `sessions.id` ↔ `userId, agencyId, role, caregiverId?` |
| Bearer JWT (mobile) | `POST /auth/mobile/login` | 8 hours | claims `{sub, agencyId, role, caregiverId?, jti, exp}`; `jti` looked up in `mobile_sessions` for revocation |

The **`agencyId`** value is the trust boundary. The middleware
`packages/app/src/middleware/auth-context.ts` reads it from the
credential, validates it against the active session row, and attaches
`req.auth = { userId, agencyId, role, caregiverId? }` to the request.

**There is no path where the client supplies `agencyId` and the server
trusts it.** Even if a request body or query parameter contains an
`agencyId`, the route handlers must use `req.auth.agencyId` exclusively
for tenant scoping. Audit checks confirm this on every code review.

---

## 2. Where the Binding Happens

For each PHI-touching operation, the call chain is:

```
HTTP request
  → authContext middleware  (resolves req.auth from cookie/JWT)
  → requireCapability(...)  (checks role has the capability)
  → requireCsrf            (cookie sessions only; bearer JWT bypasses)
  → auditLog               (records the access in audit_events)
  → route handler          (passes req.auth.agencyId into the repository)
  → repository method      (binds agencyId into SQL WHERE clause)
  → Postgres
```

The **repository layer** is where tenant isolation is enforced
mechanically. Repositories never expose a method that returns rows from
the entire database — every getter takes `agencyId` as the first
argument and binds it.

### 2.1 Direct-binding example (`clients`)

`packages/core/src/repositories/client-repository.ts`:

```ts
async getClients(agencyId: string): Promise<Client[]> {
  const rows = await this.db('clients').where({ agency_id: agencyId });
  return rows.map(this.mapRowToClient);
}
```

`agencyId` becomes a parameterized SQL bind — never string-concatenated.
Even if `agencyId` were attacker-supplied, the binding is type-safe and
escapes any injection attempts.

### 2.2 Join-binding example (`evv_visits`)

`evv_visits` has no `agency_id` column directly — it links to a
caregiver via `caregiver_id`, and the caregiver's agency is on the
`users` row. So tenant isolation is enforced via JOIN:

```ts
async getVisitsForAgency(agencyId: string): Promise<EvvVisit[]> {
  return this.db('evv_visits as v')
    .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
    .where('u.agency_id', agencyId)
    .select('v.*');
}
```

The same JOIN pattern is used in `getVisitsForCaregiver`,
`updateVisit`, and the `/evv/clock-in` resolution of `client_id` from
the assignment's `visit_template`.

This is the path that surfaced a **CRITICAL HIPAA-reportable bug** in
the predecessor codebase: a `getAllVisits()` method that returned every
agency's data with no `agency_id` filter. That method is no longer in
this repo — the only public read methods are `getVisitsForAgency(id)`
and `getVisitsForCaregiver(id)`, both tenant-scoped by construction.

### 2.3 Caregiver scoping (caregivers see only their own visits)

For `role='caregiver'`, the route handler at
`packages/app/src/routes/evv-routes.ts` narrows further:

```ts
const visits =
  req.auth.role === 'caregiver' && req.auth.caregiverId
    ? await repo.getVisitsForCaregiver(req.auth.caregiverId)
    : await repo.getVisitsForAgency(req.auth.agencyId);
```

`getVisitsForCaregiver` itself joins back to `users.agency_id` so a
forged `caregiverId` claim cannot pull rows from another agency.

### 2.4 Family scoping (relatives see only approved clients)

For `role='family'`, a separate `family_relationships` link table is
checked:

```ts
async getClientsForFamilyMember(userId: string, agencyId: string): Promise<Client[]> {
  return this.db('clients as c')
    .innerJoin('family_relationships as fr', 'fr.client_id', 'c.id')
    .where('fr.user_id', userId)
    .andWhere('fr.status', 'approved')
    .andWhere('c.agency_id', agencyId)
    .select('c.*');
}
```

Two ANDed conditions: (a) the user has an approved family link to the
client, AND (b) the client belongs to the user's agency. Both must hold.

---

## 3. The Capability Layer

`requireCapability(...)` is a defense-in-depth check on top of agency
scoping. Even with a valid `agencyId`, a `role='caregiver'` cannot hit
admin routes; a `role='family'` cannot hit `client.write`. The role →
capability map lives in `packages/core/src/config/pennsylvania.ts`:

| Role | Capabilities |
|---|---|
| `admin` | all (`agency.*`, `staff.*`, `client.*`, `schedule.*`, `auth.*`) |
| `coordinator` | `agency.read`, `staff.read`, `client.{read,write}`, `schedule.{read,write}` |
| `caregiver` | `schedule.{read,write}` (write was added 2026-05-08 to enable EVV clock-in/out — see commit `5f7ad7e`) |
| `family` | `client.read`, `schedule.read` |

A failing `requireCapability` check returns 403 *and* writes
`event_type='permission.denied'` to `audit_events`, so attempts at
unauthorized cross-tenant probing are visible in the audit trail.

---

## 4. Audit Coverage

Every PHI-touching request is captured in `audit_events`. The audit row
includes both `req.auth.agencyId` (the actor's agency) and the
operation's effective entity ID (which is always within that agency
because the repository layer enforces it).

You can detect a tenant-isolation breach by querying:

```sql
SELECT *
FROM audit_events
WHERE event_type LIKE 'phi.%'
  AND agency_id IS DISTINCT FROM (
    -- look up entity's true agency from the appropriate table
    -- and confirm it matches
    SELECT agency_id FROM clients   WHERE id = audit_events.entity_id::uuid
    UNION ALL
    SELECT agency_id FROM caregivers WHERE id = audit_events.entity_id::uuid
  );
```

A non-empty result is a SEV-1 incident — escalate per
`INCIDENT_RESPONSE.md` §3.

---

## 5. Threat Models Considered

| Threat | Mitigation |
|---|---|
| Forged `agencyId` in request body | Body fields are never read for scoping; only `req.auth.agencyId` |
| Forged JWT with arbitrary `agencyId` claim | JWT signature verified with `JWT_SECRET`; `jti` looked up in `mobile_sessions` (revocable); 8h expiry caps blast radius |
| Path traversal / IDOR (e.g. `/clients/<other-agency-uuid>`) | Repository methods take `agencyId` argument and add it to WHERE; `findById` patterns return null for cross-tenant ids — never confirm existence to the caller |
| SQL injection | Knex parameterized binds; no string-concatenated SQL in repository code |
| Compromised admin account scrolling other agencies | Scoping is per-agency; an admin in agency A cannot see agency B regardless of role |
| Compromised Postgres role | At-rest encryption (Neon), application-layer encryption on Medicaid IDs and NPIs (`cell-cipher.ts`), audit-log tamper detection (`audit_events_block_mutation_trg`) |

---

## 6. Code Review Checklist

When reviewing a PR that touches a PHI table or route handler:

- [ ] Does every repository read method take `agencyId` (or
      `caregiverId`/`userId` resolvable to an agency) as an argument?
- [ ] Is `agencyId` bound into the WHERE clause via Knex `.where(...)`,
      not concatenated into a raw query string?
- [ ] Does the route handler use `req.auth.agencyId`, never
      `req.body.agencyId` or `req.query.agencyId`?
- [ ] If the table has no direct `agency_id` column (e.g. `evv_visits`,
      `caregiver_credentials`), is the JOIN to `users` /
      `caregivers.agency_id` present?
- [ ] Does the route call `requireCapability(...)` with the right
      capability for the operation?
- [ ] Will the audit middleware capture this access (path is in
      `PHI_GET_PATHS` or `PHI_EXPORT_PATHS` if it's read; mutation
      will fall through `auditLog` automatically)?
- [ ] Are there tests confirming a different `agencyId` returns no
      rows / 404?

A failed checklist item is a P0 finding — block the merge.

---

## 7. Review Log

| Date | Reviewer | Change |
|---|---|---|
| 2026-05-08 | Founder + assistant | Initial document authored as part of the HIPAA documentation set. Captures the post-`getAllVisits` repository design, the JWT/cookie credential split, the role → capability table (including the 2026-05-08 fix that gave caregivers `schedule.write`), and the audit query pattern for detecting tenant-isolation breaches. |
