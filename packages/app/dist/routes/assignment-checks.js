import { CaregiverRepository, ClaimRepository, ClientRepository, ScheduleRepository, checkScheduleConflicts, evaluateCredentialEligibility, } from '@rayhealth/core';
export async function evaluateAssignmentChecks(db, agencyId, input) {
    const scheduleRepo = new ScheduleRepository(db);
    const caregiverRepo = new CaregiverRepository(db);
    // Cross-tenant guard: the caregiver must belong to this agency.
    const caregiver = await caregiverRepo.findById(input.caregiverId, agencyId);
    if (!caregiver) {
        return { caregiver: null, templateClient: null, hardConflicts: [], warnings: [] };
    }
    // Credential advisory (warning, not a block — a renewal may be in flight).
    const credentials = await caregiverRepo.getCredentials(input.caregiverId, agencyId);
    const credCheck = evaluateCredentialEligibility({
        operatingTrack: 'personal-assistance',
        credentials: credentials.map((c) => ({ credentialType: c.credentialType, status: c.status })),
    });
    // Resolve the template's client (also validates the template is in-agency).
    const templateClient = await scheduleRepo.getTemplateClient(input.visitTemplateId, agencyId);
    if (!templateClient) {
        return { caregiver: { id: input.caregiverId }, templateClient: null, hardConflicts: [], warnings: [] };
    }
    // Conflict inputs: the caregiver's other assignments (duplicate detection,
    // excluding the one being edited) + the client's authorizations with units
    // remaining after billed claims (coverage + exhaustion advisories).
    const [existingAssignments, allAuthorizations, billedUnits] = await Promise.all([
        scheduleRepo.getCaregiverScheduleForConflict(input.caregiverId, agencyId, input.excludeAssignmentId),
        new ClientRepository(db).getAuthorizations(agencyId),
        new ClaimRepository(db).getBilledLineUnits(agencyId),
    ]);
    const authorizations = allAuthorizations
        .filter((a) => a.clientId === templateClient.clientId)
        .map((a) => {
        const used = billedUnits
            .filter((b) => b.clientId === templateClient.clientId &&
            b.serviceCode === a.serviceCode &&
            b.serviceDate >= a.startDate &&
            b.serviceDate <= a.endDate)
            .reduce((sum, b) => sum + b.units, 0);
        return {
            serviceCode: a.serviceCode,
            startDate: a.startDate,
            endDate: a.endDate,
            unitsAuthorized: a.unitsAuthorized,
            unitsRemaining: a.unitsAuthorized - used,
        };
    });
    const conflicts = checkScheduleConflicts({
        proposed: { visitTemplateId: input.visitTemplateId, visitDate: input.visitDate },
        existingAssignments,
        authorizations,
    });
    const warnings = [
        ...conflicts.warnings,
        ...(credCheck.eligible
            ? []
            : [`Caregiver has non-active credentials: ${credCheck.reasons.join(', ')}`]),
    ];
    return {
        caregiver: { id: input.caregiverId },
        templateClient: { clientId: templateClient.clientId },
        hardConflicts: conflicts.hardConflicts,
        warnings,
    };
}
//# sourceMappingURL=assignment-checks.js.map