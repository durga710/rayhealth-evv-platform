import { describe, expect, it } from 'vitest';
import type { Knex } from 'knex';
import { AgencySandataConfigRepository } from '../repositories/agency-sandata-config-repository.js';

interface FakeRow {
  agency_id: string;
  provider_id: string | null;
  timezone: string;
  caregiver_mappings: unknown;
  service_mappings: unknown;
  enabled: boolean;
}

function makeFakeDb(initial?: FakeRow) {
  let row = initial;
  const builder = {
    where: () => builder,
    first: async () => row,
    insert(_data: Record<string, unknown>) { return builder; },
    onConflict: () => builder,
    merge: async (data: Record<string, unknown>) => {
      if (row) {
        row = {
          ...row,
          provider_id: (data.provider_id as string | null) ?? row.provider_id,
          timezone: (data.timezone as string) ?? row.timezone,
          caregiver_mappings: data.caregiver_mappings ?? row.caregiver_mappings,
          service_mappings: data.service_mappings ?? row.service_mappings,
          enabled: (data.enabled as boolean) ?? row.enabled,
        };
      } else {
        row = {
          agency_id: data.agency_id as string,
          provider_id: (data.provider_id as string | null) ?? null,
          timezone: (data.timezone as string) ?? 'America/New_York',
          caregiver_mappings: data.caregiver_mappings ?? '[]',
          service_mappings: data.service_mappings ?? '[]',
          enabled: (data.enabled as boolean) ?? false,
        };
      }
      return 1;
    },
  };
  const db = ((_table: string) => builder) as unknown as Knex;
  (db as unknown as { fn: { now: () => string } }).fn = { now: () => 'NOW()' };
  return { db, getRow() { return row; } };
}

const CAREGIVER_UUID = '00000000-0000-4000-8000-000000000001';
const AGENCY_UUID = '00000000-0000-4000-8000-0000000000aa';

describe('AgencySandataConfigRepository', () => {
  it('returns undefined when no row exists', async () => {
    const { db } = makeFakeDb(undefined);
    const repo = new AgencySandataConfigRepository(db);
    expect(await repo.findByAgency(AGENCY_UUID)).toBeUndefined();
    expect(await repo.findValid(AGENCY_UUID)).toBeUndefined();
  });

  it('findByAgency returns partial row with nullable providerId', async () => {
    const { db } = makeFakeDb({
      agency_id: AGENCY_UUID,
      provider_id: null,
      timezone: 'America/New_York',
      caregiver_mappings: '[]',
      service_mappings: '[]',
      enabled: false,
    });
    const repo = new AgencySandataConfigRepository(db);
    const partial = await repo.findByAgency(AGENCY_UUID);
    expect(partial?.providerId).toBeNull();
    expect(partial?.enabled).toBe(false);
  });

  it('findValid returns undefined when providerId is missing', async () => {
    const { db } = makeFakeDb({
      agency_id: AGENCY_UUID,
      provider_id: null,
      timezone: 'America/New_York',
      caregiver_mappings: '[]',
      service_mappings: '[]',
      enabled: true,
    });
    const repo = new AgencySandataConfigRepository(db);
    expect(await repo.findValid(AGENCY_UUID)).toBeUndefined();
  });

  it('findValid returns SandataConfig when providerId is set', async () => {
    const { db } = makeFakeDb({
      agency_id: AGENCY_UUID,
      provider_id: '123456789',
      timezone: 'America/New_York',
      caregiver_mappings: JSON.stringify([
        { caregiverId: CAREGIVER_UUID, externalWorkerId: 'EW-1' },
      ]),
      service_mappings: JSON.stringify([
        { internalServiceCode: 'PERSONAL_CARE', hcpcsCode: 'T1019', hcpcsModifier: 'U4', label: 'PC' },
      ]),
      enabled: true,
    });
    const repo = new AgencySandataConfigRepository(db);
    const config = await repo.findValid(AGENCY_UUID);
    expect(config).toBeDefined();
    expect(config?.providerId).toBe('123456789');
    expect(config?.caregivers).toHaveLength(1);
    expect(config?.services).toHaveLength(1);
  });

  it('drops malformed mappings while keeping valid ones', async () => {
    const { db } = makeFakeDb({
      agency_id: AGENCY_UUID,
      provider_id: '123456789',
      timezone: 'America/New_York',
      caregiver_mappings: JSON.stringify([
        { caregiverId: 'not-a-uuid', externalWorkerId: 'EW-1' },
        { caregiverId: CAREGIVER_UUID, externalWorkerId: 'EW-2' },
      ]),
      service_mappings: JSON.stringify([
        // Invalid HCPCS (missing modifier)
        { internalServiceCode: 'X', hcpcsCode: 'BAD', hcpcsModifier: 'XX', label: 'x' },
        { internalServiceCode: 'Y', hcpcsCode: 'T1019', hcpcsModifier: 'U4', label: 'Personal Care' },
      ]),
      enabled: true,
    });
    const repo = new AgencySandataConfigRepository(db);
    const partial = await repo.findByAgency(AGENCY_UUID);
    expect(partial?.caregivers).toEqual([
      { caregiverId: CAREGIVER_UUID, externalWorkerId: 'EW-2' },
    ]);
    expect(partial?.services).toHaveLength(1);
    expect(partial?.services[0].internalServiceCode).toBe('Y');
  });

  it('upsert persists and returns the stored partial', async () => {
    const fake = makeFakeDb(undefined);
    const repo = new AgencySandataConfigRepository(fake.db);
    const result = await repo.upsert({
      agencyId: AGENCY_UUID,
      providerId: '987654321',
      timezone: 'America/New_York',
      caregivers: [{ caregiverId: CAREGIVER_UUID, externalWorkerId: 'EW-3' }],
      services: [
        { internalServiceCode: 'RESPITE', hcpcsCode: 'T1019', hcpcsModifier: 'U5', label: 'Respite' },
      ],
      enabled: true,
    });
    expect(result.providerId).toBe('987654321');
    expect(result.caregivers).toHaveLength(1);
    expect(result.services).toHaveLength(1);
    expect(result.enabled).toBe(true);
  });

  it('falls back to empty arrays when JSON is malformed', async () => {
    const { db } = makeFakeDb({
      agency_id: AGENCY_UUID,
      provider_id: '123456789',
      timezone: 'America/New_York',
      caregiver_mappings: 'not-json-{[',
      service_mappings: { not: 'an array' },
      enabled: false,
    });
    const repo = new AgencySandataConfigRepository(db);
    const partial = await repo.findByAgency(AGENCY_UUID);
    expect(partial?.caregivers).toEqual([]);
    expect(partial?.services).toEqual([]);
  });
});
