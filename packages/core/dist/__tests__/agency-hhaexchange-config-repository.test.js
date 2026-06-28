import { describe, expect, it } from 'vitest';
import { AgencyHhaexchangeConfigRepository } from '../repositories/agency-hhaexchange-config-repository.js';
function makeFakeDb(initial) {
    let row = initial;
    const builder = {
        where: () => builder,
        first: async () => row,
        insert(_data) { return builder; },
        onConflict: () => builder,
        merge: async (data) => {
            if (row) {
                row = {
                    ...row,
                    agency_tax_id: data.agency_tax_id ?? row.agency_tax_id,
                    hha_provider_id: data.hha_provider_id ?? row.hha_provider_id,
                    timezone: data.timezone ?? row.timezone,
                    caregiver_mappings: data.caregiver_mappings ?? row.caregiver_mappings,
                    service_mappings: data.service_mappings ?? row.service_mappings,
                    enabled: data.enabled ?? row.enabled,
                };
            }
            else {
                row = {
                    agency_id: data.agency_id,
                    agency_tax_id: data.agency_tax_id ?? null,
                    hha_provider_id: data.hha_provider_id ?? null,
                    timezone: data.timezone ?? 'America/New_York',
                    caregiver_mappings: data.caregiver_mappings ?? '[]',
                    service_mappings: data.service_mappings ?? '[]',
                    enabled: data.enabled ?? false,
                };
            }
            return 1;
        },
    };
    const db = ((_table) => builder);
    db.fn = { now: () => 'NOW()' };
    return { db, setRow(next) { row = next; }, getRow() { return row; } };
}
const CAREGIVER_UUID = '00000000-0000-4000-8000-000000000001';
const AGENCY_UUID = '00000000-0000-4000-8000-0000000000aa';
describe('AgencyHhaexchangeConfigRepository', () => {
    it('returns undefined when the agency has no row', async () => {
        const { db } = makeFakeDb(undefined);
        const repo = new AgencyHhaexchangeConfigRepository(db);
        expect(await repo.findByAgency(AGENCY_UUID)).toBeUndefined();
        expect(await repo.findValid(AGENCY_UUID)).toBeUndefined();
    });
    it('findByAgency returns the partial row with nullable identity fields', async () => {
        const { db } = makeFakeDb({
            agency_id: AGENCY_UUID,
            agency_tax_id: null,
            hha_provider_id: null,
            timezone: 'America/New_York',
            caregiver_mappings: '[]',
            service_mappings: '[]',
            enabled: false,
        });
        const repo = new AgencyHhaexchangeConfigRepository(db);
        const partial = await repo.findByAgency(AGENCY_UUID);
        expect(partial).toBeDefined();
        expect(partial?.agencyTaxId).toBeNull();
        expect(partial?.hhaProviderId).toBeNull();
        expect(partial?.caregivers).toEqual([]);
    });
    it('findValid returns undefined when identity fields are missing', async () => {
        const { db } = makeFakeDb({
            agency_id: AGENCY_UUID,
            agency_tax_id: null,
            hha_provider_id: 'P1',
            timezone: 'America/New_York',
            caregiver_mappings: '[]',
            service_mappings: '[]',
            enabled: true,
        });
        const repo = new AgencyHhaexchangeConfigRepository(db);
        expect(await repo.findValid(AGENCY_UUID)).toBeUndefined();
    });
    it('findValid returns the fully-typed config when identity fields are present', async () => {
        const { db } = makeFakeDb({
            agency_id: AGENCY_UUID,
            agency_tax_id: '123456789',
            hha_provider_id: 'P-100',
            timezone: 'America/New_York',
            caregiver_mappings: JSON.stringify([
                { caregiverId: CAREGIVER_UUID, employeeId: 'E-1' },
            ]),
            service_mappings: JSON.stringify([
                { internalServiceCode: 'PERSONAL_CARE', hhaServiceCode: '1051', label: 'Personal Care' },
            ]),
            enabled: true,
        });
        const repo = new AgencyHhaexchangeConfigRepository(db);
        const config = await repo.findValid(AGENCY_UUID);
        expect(config).toBeDefined();
        expect(config?.agencyTaxId).toBe('123456789');
        expect(config?.hhaProviderId).toBe('P-100');
        expect(config?.caregivers).toHaveLength(1);
        expect(config?.services).toHaveLength(1);
    });
    it('parses caregiver_mappings stored as a JSON string', async () => {
        const { db } = makeFakeDb({
            agency_id: AGENCY_UUID,
            agency_tax_id: null,
            hha_provider_id: null,
            timezone: 'America/New_York',
            caregiver_mappings: JSON.stringify([
                { caregiverId: CAREGIVER_UUID, employeeId: 'E-7' },
            ]),
            service_mappings: '[]',
            enabled: false,
        });
        const repo = new AgencyHhaexchangeConfigRepository(db);
        const partial = await repo.findByAgency(AGENCY_UUID);
        expect(partial?.caregivers).toEqual([
            { caregiverId: CAREGIVER_UUID, employeeId: 'E-7' },
        ]);
    });
    it('silently drops malformed caregiver mappings (invalid UUID) while keeping valid ones', async () => {
        const { db } = makeFakeDb({
            agency_id: AGENCY_UUID,
            agency_tax_id: null,
            hha_provider_id: null,
            timezone: 'America/New_York',
            caregiver_mappings: JSON.stringify([
                { caregiverId: 'not-a-uuid', employeeId: 'E-1' },
                { caregiverId: CAREGIVER_UUID, employeeId: 'E-2' },
            ]),
            service_mappings: '[]',
            enabled: false,
        });
        const repo = new AgencyHhaexchangeConfigRepository(db);
        const partial = await repo.findByAgency(AGENCY_UUID);
        expect(partial?.caregivers).toEqual([
            { caregiverId: CAREGIVER_UUID, employeeId: 'E-2' },
        ]);
    });
    it('falls back to empty arrays when mappings JSON is malformed', async () => {
        const { db } = makeFakeDb({
            agency_id: AGENCY_UUID,
            agency_tax_id: null,
            hha_provider_id: null,
            timezone: 'America/New_York',
            caregiver_mappings: 'not-json-{[',
            service_mappings: { not: 'an array' },
            enabled: false,
        });
        const repo = new AgencyHhaexchangeConfigRepository(db);
        const partial = await repo.findByAgency(AGENCY_UUID);
        expect(partial?.caregivers).toEqual([]);
        expect(partial?.services).toEqual([]);
    });
    it('upsert persists then returns the stored partial', async () => {
        const fake = makeFakeDb(undefined);
        const repo = new AgencyHhaexchangeConfigRepository(fake.db);
        const result = await repo.upsert({
            agencyId: AGENCY_UUID,
            agencyTaxId: '987654321',
            hhaProviderId: 'NJ-PROV-42',
            timezone: 'America/New_York',
            caregivers: [{ caregiverId: CAREGIVER_UUID, employeeId: 'E-9' }],
            services: [
                { internalServiceCode: 'PC', hhaServiceCode: '1051', label: 'Personal Care' },
            ],
            enabled: true,
        });
        expect(result.agencyTaxId).toBe('987654321');
        expect(result.hhaProviderId).toBe('NJ-PROV-42');
        expect(result.caregivers).toHaveLength(1);
        expect(result.enabled).toBe(true);
    });
});
//# sourceMappingURL=agency-hhaexchange-config-repository.test.js.map