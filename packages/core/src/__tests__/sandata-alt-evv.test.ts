import { describe, expect, it } from 'vitest';
import type { Client } from '../domain/client.js';
import type { Caregiver } from '../domain/caregiver.js';
import type { EvvVisit } from '../domain/evv.js';
import {
  mapClient,
  mapEmployee,
  mapVisit,
  toCCYYMMDD,
  validateClient,
  validateEmployee,
  validateVisit,
} from '../integrations/sandata/index.js';

// ── Synthetic fixtures (no real client/caregiver data) ───────────────────────

const fullClient: Client = {
  id: '11111111-1111-1111-1111-111111111111',
  firstName: 'Ada',
  lastName: 'Tester',
  dateOfBirth: '1980-04-01',
  medicaidNumber: '1234567890',
  addressLine1: '100 Main St',
  city: 'Philadelphia',
  state: 'PA',
  postalCode: '19103',
  latitude: 39.9526,
  longitude: -75.1652,
};

const fullCaregiver: Caregiver = {
  id: '22222222-2222-2222-2222-222222222222',
  agencyId: '33333333-3333-3333-3333-333333333333',
  firstName: 'Grace',
  lastName: 'Helper',
  email: 'grace@example.test',
  npi: '1003456789',
  hireDate: '2024-06-15',
  status: 'active',
};

const fullVisit: EvvVisit = {
  id: '44444444-4444-4444-4444-444444444444',
  assignmentId: '55555555-5555-5555-5555-555555555555',
  caregiverId: fullCaregiver.id!,
  clientId: fullClient.id,
  serviceCode: 'T1019',
  clockInTime: '2026-06-29T13:00:00.000Z',
  clockOutTime: '2026-06-29T15:00:00.000Z',
  clockInLocation: { lat: 39.9526, lng: -75.1652, accuracy: 8 },
  clockOutLocation: { lat: 39.9527, lng: -75.1651, accuracy: 9 },
  status: 'verified',
};

describe('toCCYYMMDD', () => {
  it('strips dashes from an ISO date', () => {
    expect(toCCYYMMDD('2024-06-15')).toBe('20240615');
  });
  it('takes the date portion of a datetime', () => {
    expect(toCCYYMMDD('2026-06-29T13:00:00.000Z')).toBe('20260629');
  });
  it('returns undefined for empty input', () => {
    expect(toCCYYMMDD(undefined)).toBeUndefined();
    expect(toCCYYMMDD('')).toBeUndefined();
  });
});

describe('mapClient', () => {
  it('maps to Sandata CLIENT wire fields with a nested address', () => {
    const out = mapClient(fullClient, 1);
    expect(out.ClientCustomID).toBe(fullClient.id);
    expect(out.ClientMedicaidID).toBe('1234567890');
    expect(out.ClientFirstName).toBe('Ada');
    expect(out.SequenceID).toBe(1);
    expect(out.ClientAddress?.[0]).toMatchObject({
      ClientAddressLine1: '100 Main St',
      ClientCity: 'Philadelphia',
      ClientState: 'PA',
      ClientZip: '19103',
      ClientLatitude: 39.9526,
      ClientLongitude: -75.1652,
    });
  });

  it('omits the address array when no street is on file', () => {
    const out = mapClient({ ...fullClient, addressLine1: undefined }, 2);
    expect(out.ClientAddress).toBeUndefined();
  });
});

describe('mapEmployee', () => {
  it('maps to EMPLOYEE wire fields and renders hire date CCYYMMDD', () => {
    const out = mapEmployee(fullCaregiver, 1);
    expect(out.EmployeeCustomID).toBe(fullCaregiver.id);
    expect(out.EmployeeFirstName).toBe('Grace');
    expect(out.EmployeeLastName).toBe('Helper');
    expect(out.EmployeeDateOfHire).toBe('20240615');
    expect(out.SequenceID).toBe(1);
  });
});

describe('mapVisit', () => {
  it('derives Time In / Time Out calls and uses serviceCode as ProcedureCode', () => {
    const out = mapVisit(fullVisit, 1);
    expect(out.VisitOtherID).toBe(fullVisit.id);
    expect(out.ClientCustomID).toBe(fullClient.id);
    expect(out.EmployeeCustomID).toBe(fullCaregiver.id);
    expect(out.ProcedureCode).toBe('T1019');
    expect(out.AdjInDateTime).toBe('2026-06-29T13:00:00.000Z');
    expect(out.AdjOutDateTime).toBe('2026-06-29T15:00:00.000Z');
    expect(out.Calls).toHaveLength(2);
    expect(out.Calls?.[0]).toMatchObject({ CallAssignment: 'Time In', CallLatitude: 39.9526 });
    expect(out.Calls?.[1]).toMatchObject({ CallAssignment: 'Time Out' });
  });

  it('emits only a Time In call for an in-progress visit', () => {
    const out = mapVisit({ ...fullVisit, clockOutTime: undefined, clockOutLocation: undefined }, 1);
    expect(out.Calls).toHaveLength(1);
    expect(out.AdjOutDateTime).toBeUndefined();
  });

  it('applies modifier overrides in order', () => {
    const out = mapVisit(fullVisit, 1, { modifiers: ['U1', 'U2'] });
    expect(out.Modifier1).toBe('U1');
    expect(out.Modifier2).toBe('U2');
    expect(out.Modifier3).toBeUndefined();
  });
});

describe('validateClient', () => {
  it('accepts a complete client', () => {
    expect(validateClient(fullClient).ok).toBe(true);
  });

  it('hard-blocks a missing Medicaid id and address', () => {
    const res = validateClient({ ...fullClient, medicaidNumber: undefined, addressLine1: undefined });
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.field)).toEqual(
      expect.arrayContaining(['ClientMedicaidID', 'ClientAddressLine1']),
    );
  });

  it('soft-warns missing GPS but stays ok when GPS is not required', () => {
    const res = validateClient({ ...fullClient, latitude: undefined, longitude: undefined });
    expect(res.ok).toBe(true);
    expect(res.issues.some((i) => i.severity === 'SOFT_WARN' && i.field === 'ClientLatitude')).toBe(true);
  });

  it('hard-blocks missing GPS when the program requires it', () => {
    const res = validateClient({ ...fullClient, latitude: undefined, longitude: undefined }, { gpsRequired: true });
    expect(res.ok).toBe(false);
  });
});

describe('validateEmployee', () => {
  it('accepts a complete caregiver', () => {
    expect(validateEmployee(fullCaregiver).ok).toBe(true);
  });
  it('hard-blocks a blank last name', () => {
    expect(validateEmployee({ ...fullCaregiver, lastName: '  ' }).ok).toBe(false);
  });
});

describe('validateVisit', () => {
  it('accepts a complete, GPS-stamped, completed visit', () => {
    expect(validateVisit(fullVisit).ok).toBe(true);
  });

  it('hard-blocks an incomplete visit (no clock-out)', () => {
    const res = validateVisit({ ...fullVisit, clockOutTime: undefined });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.field === 'AdjOutDateTime')).toBe(true);
  });

  it('hard-blocks clock-out before clock-in', () => {
    const res = validateVisit({ ...fullVisit, clockOutTime: '2026-06-29T12:00:00.000Z' });
    expect(res.ok).toBe(false);
  });

  it('soft-warns missing GPS but stays ok when GPS is not required', () => {
    const { clockInLocation: _omitIn, ...noGps } = fullVisit;
    const res = validateVisit(noGps as EvvVisit);
    expect(res.ok).toBe(true);
    expect(res.issues.some((i) => i.severity === 'SOFT_WARN')).toBe(true);
  });
});
