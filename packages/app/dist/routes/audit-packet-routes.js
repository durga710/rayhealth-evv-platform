import { createHash } from 'crypto';
import { Router } from 'express';
import { AuditEventRepository, CaregiverRepository, ClientRepository, EvvExceptionRepository, EvvRepository, ScheduleRepository, VisitMaintenanceRepository, checkGeofence, haversineMeters, curesActEvvDataPoints, paServiceCodeDescriptions, evvVisitIdSchema } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
const router = Router();
/** Recursively sorts object keys so the same content always serializes identically. */
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
        const record = value;
        const sorted = {};
        for (const key of Object.keys(record).sort()) {
            sorted[key] = canonicalize(record[key]);
        }
        return sorted;
    }
    return value;
}
function sha256OfCanonicalJson(value) {
    return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}
/**
 * Derives geofence facts for one clock event from the raw captured location
 * plus the client's registered geofence anchor. Never returns the raw
 * lat/lng — only a captured flag, the GPS accuracy scalar, the in/out
 * verdict, and (when computable) the distance/allowed radius, mirroring the
 * 422 GEOFENCE_OUT_OF_BOUNDS envelope already exposed by evv-routes.ts.
 */
function deriveGeofence(location, anchor) {
    if (!location) {
        return { captured: false, accuracyM: null, result: 'not_captured', distanceM: null, allowedM: null };
    }
    const accuracyM = typeof location.accuracy === 'number' ? location.accuracy : null;
    if (!anchor || anchor.latitude === null || anchor.longitude === null) {
        return { captured: true, accuracyM, result: 'not_configured', distanceM: null, allowedM: null };
    }
    const allowedM = anchor.geofenceRadiusM ?? 150;
    const violation = checkGeofence(location, anchor);
    if (violation) {
        return {
            captured: true,
            accuracyM,
            result: 'out_of_bounds',
            distanceM: violation.distanceM,
            allowedM: violation.allowedM
        };
    }
    // checkGeofence only returns a distance on violation; recompute it here so
    // the packet can show "how close" even when the caregiver was in-bounds.
    const distanceM = Math.round(haversineMeters({ lat: location.lat, lng: location.lng }, { lat: anchor.latitude, lng: anchor.longitude }));
    return { captured: true, accuracyM, result: 'within', distanceM, allowedM };
}
function fullName(first, last) {
    return [first, last].filter((p) => p && p.trim().length > 0).join(' ').trim();
}
router.get('/:visitId', requireCapability('audit.read'), async (req, res) => {
    const parsedId = evvVisitIdSchema.safeParse(req.params.visitId);
    if (!parsedId.success) {
        res.status(400).json({ message: 'Valid visit id is required' });
        return;
    }
    const visitId = parsedId.data;
    const agencyId = req.auth.agencyId;
    const db = req.app.get('db');
    try {
        const evvRepo = new EvvRepository(db);
        // The only fetch path for the visit — already tenant-scoped and 404-safe
        // (returns null for both "does not exist" and "belongs to another
        // agency", so this route never leaks cross-tenant existence).
        const visit = await evvRepo.getVisitByIdForAgency(visitId, agencyId);
        if (!visit) {
            res.status(404).json({ message: 'Visit not found' });
            return;
        }
        const caregiverRepo = new CaregiverRepository(db);
        const clientRepo = new ClientRepository(db);
        const scheduleRepo = new ScheduleRepository(db);
        const exceptionRepo = new EvvExceptionRepository(db);
        const maintenanceRepo = new VisitMaintenanceRepository(db);
        const auditRepo = new AuditEventRepository(db);
        const [caregiver, client, clientGeofenceAnchor, schedule, exceptions, corrections, visitEvents, clockOutEvents, clockInEvents] = await Promise.all([
            caregiverRepo.findById(visit.caregiverId, agencyId),
            visit.clientId ? clientRepo.getClientNameForAgency(visit.clientId, agencyId) : Promise.resolve(undefined),
            visit.clientId ? clientRepo.getClientGeofence(visit.clientId, agencyId) : Promise.resolve(undefined),
            scheduleRepo.getAssignmentScheduleForAgency(visit.assignmentId, agencyId),
            exceptionRepo.findExceptionsByVisitForAgency(visitId, agencyId),
            maintenanceRepo.findByVisitIdForAgency(visitId, agencyId),
            // Sub-collection reads MUST use the agency-scoped variant — never
            // the unscoped AuditEventRepository.findByEntity.
            auditRepo.findByEntityForAgency(agencyId, 'evv.visit', visitId),
            auditRepo.findByEntityForAgency(agencyId, 'evv.clock-out', visitId),
            auditRepo.findByEntityForAgency(agencyId, 'evv.clock-in', visit.assignmentId)
        ]);
        // ---- visit ------------------------------------------------------------
        const serviceCode = visit.serviceCode;
        const visitPayload = {
            id: visit.id,
            status: visit.status,
            serviceCode: serviceCode ?? null,
            serviceDescription: serviceCode ? paServiceCodeDescriptions[serviceCode] ?? null : null,
            scheduledStartTime: schedule?.scheduledStartTime ?? null,
            scheduledEndTime: schedule?.scheduledEndTime ?? null,
            clockInTime: visit.clockInTime,
            clockOutTime: visit.clockOutTime ?? null
        };
        // ---- parties — minimum necessary ---------------------------------------
        const caregiverPayload = {
            id: visit.caregiverId,
            name: caregiver ? fullName(caregiver.firstName, caregiver.lastName) : ''
        };
        const clientPayload = client
            ? { id: client.id, name: fullName(client.firstName, client.lastName) }
            : { id: null, name: null };
        // ---- Cures-Act element presence checklist ------------------------------
        const curesActElements = curesActEvvDataPoints.reduce((acc, point) => {
            acc[point] = evaluateCuresActPoint(point, visit);
            return acc;
        }, {});
        // ---- geofence — derived, never raw -------------------------------------
        const geofence = {
            clockIn: deriveGeofence(visit.clockInLocation, clientGeofenceAnchor),
            clockOut: deriveGeofence(visit.clockOutLocation, clientGeofenceAnchor)
        };
        // ---- exceptions ---------------------------------------------------------
        const exceptionsPayload = exceptions.map((e) => ({
            id: e.id,
            exceptionType: e.exceptionType,
            reason: e.reason,
            status: e.approvedAt ? 'resolved' : 'open',
            resolvedBy: e.approvedBy ?? null,
            resolvedAt: e.approvedAt ?? null
        }));
        // ---- corrections (VMUR) -------------------------------------------------
        const correctionsPayload = corrections.map((c) => ({
            id: c.id,
            status: c.status,
            requesterId: c.requesterId,
            requesterName: c.requesterName,
            reason: c.reason,
            reasonCategoryCode: c.reasonCategoryCode ?? null,
            correctionCode: c.correctionCode ?? null,
            approverId: c.approverId ?? null,
            approverName: c.approverName,
            approvedAt: c.approvedAt ?? null,
            originalStartTime: c.originalStartTime ?? null,
            originalEndTime: c.originalEndTime ?? null,
            adjustedStartTime: c.adjustedStartTime ?? null,
            adjustedEndTime: c.adjustedEndTime ?? null
        }));
        // ---- audit-event chain — references and hashes, never raw payloads -----
        const auditEventsPayload = [...visitEvents, ...clockOutEvents, ...clockInEvents]
            .sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime())
            .map((e) => ({
            id: e.id,
            eventType: e.eventType,
            entityType: e.entityType,
            outcome: e.outcome,
            actorId: e.actorId,
            actorType: e.actorType,
            occurredAt: e.occurredAt,
            payloadSha256: sha256OfCanonicalJson(e.payload ?? {})
        }));
        // ---- aggregator submission status ---------------------------------------
        const aggregatorPayload = {
            sandataStatus: visit.sandataStatus ?? null,
            sandataConfirmationId: visit.sandataConfirmationId ?? null,
            hhaexchangeStatus: visit.hhaexchangeStatus ?? null,
            hhaexchangeConfirmationId: visit.hhaexchangeConfirmationId ?? null
        };
        // ---- packet integrity ----------------------------------------------------
        const packetMeta = {
            generatedAt: new Date().toISOString(),
            generatedBy: req.auth.userId,
            agencyId
        };
        const bodyWithoutHash = {
            packet: packetMeta,
            visit: visitPayload,
            caregiver: caregiverPayload,
            client: clientPayload,
            curesActElements,
            geofence,
            exceptions: exceptionsPayload,
            corrections: correctionsPayload,
            auditEvents: auditEventsPayload,
            aggregator: aggregatorPayload
        };
        const integritySha256 = sha256OfCanonicalJson(bodyWithoutHash);
        // Mandatory, fail-closed disclosure log. Unlike the best-effort geofence-
        // denial logging elsewhere, this write is a precondition of responding —
        // if it throws, the catch block below returns 500 with no packet body.
        await auditRepo.create({
            agencyId,
            actorId: req.auth.userId,
            actorType: 'user',
            eventType: 'phi.export',
            entityType: 'evv.visit.audit-packet',
            entityId: visitId,
            outcome: 'success',
            payload: {
                scope: 'visit',
                integritySha256,
                counts: {
                    exceptions: exceptionsPayload.length,
                    corrections: correctionsPayload.length,
                    auditEvents: auditEventsPayload.length
                }
            },
            occurredAt: packetMeta.generatedAt
        });
        res.json({
            ...bodyWithoutHash,
            packet: { ...packetMeta, integritySha256 }
        });
    }
    catch (error) {
        safeError('Failed to generate audit packet', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
function evaluateCuresActPoint(point, visit) {
    switch (point) {
        case 'service-type':
            return Boolean(visit.serviceCode);
        case 'beneficiary':
            return Boolean(visit.clientId);
        case 'date':
        case 'start-time':
            return Boolean(visit.clockInTime);
        case 'location':
            return Boolean(visit.clockInLocation);
        case 'provider':
            return Boolean(visit.caregiverId);
        case 'end-time':
            return Boolean(visit.clockOutTime);
        default:
            return false;
    }
}
export default router;
//# sourceMappingURL=audit-packet-routes.js.map