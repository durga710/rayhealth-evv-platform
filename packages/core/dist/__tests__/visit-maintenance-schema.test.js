import { describe, expect, it } from 'vitest';
import { visitMaintenanceSchema } from '../domain/visit-maintenance.js';
const baseVisit = {
    visitId: '00000000-0000-4000-8000-000000000001',
    requesterId: '00000000-0000-4000-8000-000000000002',
    reason: 'Visit ended before client signed.',
    reasonCategoryCode: 'MTLB',
    correctionCode: 'TIME_CHANGE',
    originatorRole: 'coordinator',
    status: 'pending',
};
describe('visitMaintenanceSchema', () => {
    it('accepts a well-formed coordinator-filed VMUR', () => {
        const parsed = visitMaintenanceSchema.safeParse(baseVisit);
        expect(parsed.success).toBe(true);
    });
    it('rejects an unknown reason category code', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            reasonCategoryCode: 'INVALID',
        });
        expect(parsed.success).toBe(false);
    });
    it('rejects an unknown correction code', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            correctionCode: 'BOGUS_CODE',
        });
        expect(parsed.success).toBe(false);
    });
    it("requires incompleteSignatureReason when caregiver signature is missing", () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            caregiverSignaturePresent: false,
            clientSignaturePresent: true,
            // no incompleteSignatureReason
        });
        expect(parsed.success).toBe(false);
    });
    it('accepts missing signature when justification is provided', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            caregiverSignaturePresent: false,
            clientSignaturePresent: true,
            incompleteSignatureReason: 'Caregiver phone died before signature capture.',
        });
        expect(parsed.success).toBe(true);
    });
    it('accepts missing client signature when justification is provided (per PA DHS guidance)', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            caregiverSignaturePresent: true,
            clientSignaturePresent: false,
            incompleteSignatureReason: 'Client refused to sign per ACLN reason category.',
            reasonCategoryCode: 'ACLN',
        });
        expect(parsed.success).toBe(true);
    });
    it('allows reason as plain text when reasonCategoryCode is OTHR (carries the explanation)', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            reasonCategoryCode: 'OTHR',
            reason: 'Aggregator was rejecting due to mapping issue we are now retrying.',
        });
        expect(parsed.success).toBe(true);
    });
    it('rejects empty reason when reasonCategoryCode is OTHR', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            reasonCategoryCode: 'OTHR',
            reason: '',
        });
        expect(parsed.success).toBe(false);
    });
    it('accepts caregiver originator role', () => {
        const parsed = visitMaintenanceSchema.safeParse({
            ...baseVisit,
            originatorRole: 'caregiver',
        });
        expect(parsed.success).toBe(true);
    });
    it('exposes the canonical reason code list as a stable enum', () => {
        // Sanity check on the expected codes — if Sandata adds a new one we
        // want a failing test as a reminder to verify.
        const valid = [
            'MTLB', 'DCDB', 'MFLB', 'MFLA', 'ACLN', 'ATGL',
            'AGRS', 'WKAP', 'CNCL', 'HOLI', 'WKLI', 'OTHR',
        ];
        for (const code of valid) {
            const parsed = visitMaintenanceSchema.safeParse({
                ...baseVisit,
                reasonCategoryCode: code,
            });
            expect(parsed.success).toBe(true);
        }
    });
});
//# sourceMappingURL=visit-maintenance-schema.test.js.map