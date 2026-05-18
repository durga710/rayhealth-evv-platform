/**
 * PUBLIC invite acceptance routes.
 *
 * Mounted in `app.ts` BEFORE the global authContext middleware so that
 * caregivers landing on an invite link can call these endpoints without
 * an existing session — they don't have one yet.
 *
 *   GET  /invites/accept/:token   — returns invite info for the acceptance page
 *   POST /invites/accept/:token   — { accessCode, password, firstName?, lastName?,
 *                                     phone? } → creates caregiver + user records,
 *                                     marks invite accepted, returns a bearer token
 *
 * Per the brand memory: invitation-only signup, emailed invite + access code,
 * access code delivered as a final security measure, private acceptance flow.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuditEventRepository, CaregiverRepository, UserRepository, } from '@rayhealth/core';
const VALID_ROLES = ['admin', 'coordinator', 'caregiver', 'family'];
function isAppRole(value) {
    return VALID_ROLES.includes(value);
}
const router = Router();
const PASSWORD_MIN_LENGTH = 12;
function isExpired(expiresAt) {
    const ms = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime();
    return Number.isFinite(ms) && ms < Date.now();
}
function toIsoString(value) {
    return typeof value === 'string' ? value : value.toISOString();
}
function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET env var is not set');
    return secret;
}
/**
 * Normalize an access code: uppercase, strip dashes/spaces. The codes are
 * issued in the form `XXXX-XXXX` but caregivers may type them in lower case
 * or without the dash.
 */
function normalizeAccessCode(input) {
    return input.replace(/[\s-]/g, '').toUpperCase();
}
async function fetchInvite(db, token) {
    const row = (await db('staff_invites').where({ token }).first());
    return row;
}
async function fetchAgencyName(db, agencyId) {
    try {
        const row = (await db('agencies').where({ id: agencyId }).first('name'));
        return row?.name ?? 'your agency';
    }
    catch {
        return 'your agency';
    }
}
// ----- GET /invites/accept/:token -----
router.get('/:token', async (req, res) => {
    try {
        const token = req.params.token;
        if (typeof token !== 'string' || token.length === 0) {
            res.status(400).json({ success: false, error: 'token required' });
            return;
        }
        const db = req.app.get('db');
        const row = await fetchInvite(db, token);
        if (!row) {
            res.status(404).json({ success: false, error: 'invite not found' });
            return;
        }
        let effectiveStatus;
        if (row.status === 'revoked') {
            effectiveStatus = 'revoked';
        }
        else if (row.status === 'accepted' || row.accepted_at) {
            effectiveStatus = 'accepted';
        }
        else if (isExpired(row.expires_at)) {
            effectiveStatus = 'expired';
        }
        else if (row.status === 'pending') {
            effectiveStatus = 'pending';
        }
        else {
            // Defensive fallback for unknown statuses — treat as not actionable.
            effectiveStatus = 'expired';
        }
        const agencyName = await fetchAgencyName(db, row.agency_id);
        const info = {
            email: row.email,
            role: row.role,
            firstName: row.first_name,
            lastName: row.last_name,
            agencyName,
            expiresAt: toIsoString(row.expires_at),
            status: effectiveStatus,
        };
        res.json({ success: true, data: info });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// ----- POST /invites/accept/:token -----
router.post('/:token', async (req, res) => {
    try {
        const token = req.params.token;
        if (typeof token !== 'string' || token.length === 0) {
            res.status(400).json({ success: false, error: 'token required' });
            return;
        }
        const body = req.body;
        const accessCodeRaw = (body.accessCode ?? '').trim();
        const password = body.password ?? '';
        if (!accessCodeRaw) {
            res.status(400).json({ success: false, error: 'accessCode required' });
            return;
        }
        if (!password) {
            res.status(400).json({ success: false, error: 'password required' });
            return;
        }
        if (password.length < PASSWORD_MIN_LENGTH) {
            res.status(400).json({
                success: false,
                error: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
            });
            return;
        }
        const db = req.app.get('db');
        const invite = await fetchInvite(db, token);
        if (!invite) {
            res.status(404).json({ success: false, error: 'invite not found' });
            return;
        }
        if (invite.status === 'revoked') {
            res.status(410).json({ success: false, error: 'invite has been revoked' });
            return;
        }
        if (invite.status === 'accepted' || invite.accepted_at) {
            res.status(409).json({ success: false, error: 'invite already accepted' });
            return;
        }
        if (isExpired(invite.expires_at)) {
            res.status(410).json({ success: false, error: 'invite has expired' });
            return;
        }
        if (invite.status !== 'pending') {
            res.status(409).json({ success: false, error: `invite is ${invite.status}` });
            return;
        }
        // Defensive check: the invite role column is `string` but the User entity
        // requires a typed AppRole. If somehow an unknown role lives in the DB,
        // refuse to mint a user rather than silently widen the type.
        if (!isAppRole(invite.role)) {
            res.status(500).json({ success: false, error: 'invite has an invalid role' });
            return;
        }
        const role = invite.role;
        const normalizedSubmitted = normalizeAccessCode(accessCodeRaw);
        const normalizedExpected = normalizeAccessCode(invite.access_code);
        if (normalizedSubmitted !== normalizedExpected) {
            // Log a failed audit event so brute-force attempts are visible.
            try {
                await new AuditEventRepository(db).create({
                    agencyId: invite.agency_id,
                    actorId: invite.invited_by,
                    actorType: 'user',
                    eventType: 'invite.access_code_failed',
                    entityType: 'staff_invite',
                    entityId: invite.id,
                    outcome: 'failure',
                    payload: { reason: 'access_code_mismatch' },
                });
            }
            catch {
                /* audit failure must not block response */
            }
            res.status(401).json({ success: false, error: 'invalid access code' });
            return;
        }
        // Reject if a user with this email already exists — covers the case where
        // the caregiver was somehow created previously (or the email is recycled).
        const existingUser = await new UserRepository(db).findByEmail(invite.email);
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'an account already exists for this email — please sign in',
            });
            return;
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const firstName = (body.firstName ?? invite.first_name ?? '').trim();
        const lastName = (body.lastName ?? invite.last_name ?? '').trim();
        const phone = body.phone?.trim() || undefined;
        if (!firstName || !lastName) {
            res.status(400).json({ success: false, error: 'firstName and lastName required' });
            return;
        }
        const result = await db.transaction(async (trx) => {
            const caregiverRepo = new CaregiverRepository(trx);
            const userRepo = new UserRepository(trx);
            let caregiverId;
            if (role === 'caregiver') {
                const caregiver = await caregiverRepo.create({
                    agencyId: invite.agency_id,
                    firstName,
                    lastName,
                    email: invite.email,
                    phone,
                    status: 'active',
                });
                caregiverId = caregiver.id;
            }
            const user = await userRepo.create({
                agencyId: invite.agency_id,
                email: invite.email,
                passwordHash,
                role,
                caregiverId,
            });
            await trx('staff_invites')
                .where({ id: invite.id, status: 'pending' })
                .update({ status: 'accepted', accepted_at: new Date() });
            return { user, caregiverId };
        });
        // Issue a bearer token so the caregiver can immediately proceed into the
        // mobile/web app without a second login round-trip. 8h is the standard
        // lifetime used by `/auth/mobile/login`.
        const bearerToken = jwt.sign({
            sub: result.user.id,
            agencyId: result.user.agencyId,
            role: result.user.role,
            caregiverId: result.caregiverId,
        }, jwtSecret(), { expiresIn: '8h', algorithm: 'HS256' });
        try {
            await new AuditEventRepository(db).create({
                agencyId: invite.agency_id,
                actorId: result.user.id,
                actorType: 'user',
                eventType: 'invite.accepted',
                entityType: 'staff_invite',
                entityId: invite.id,
                outcome: 'success',
                payload: {
                    role,
                    caregiverId: result.caregiverId ?? null,
                    createdUserId: result.user.id,
                },
            });
        }
        catch {
            /* audit failure must not block response */
        }
        res.status(201).json({
            success: true,
            data: {
                token: bearerToken,
                role: result.user.role,
                agencyId: result.user.agencyId,
                userId: result.user.id,
                caregiverId: result.caregiverId ?? null,
            },
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
export default router;
//# sourceMappingURL=invite-acceptance-routes.js.map