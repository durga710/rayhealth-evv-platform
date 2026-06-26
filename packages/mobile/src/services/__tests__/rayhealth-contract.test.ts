import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPullChangesQuery,
  getRayHealthApiBaseUrl,
  mapRayHealthVisit,
  mapRolesToMobileRole,
} from '../rayhealth-contract.ts';

test('getRayHealthApiBaseUrl defaults to RayHealth production api', () => {
  assert.equal(getRayHealthApiBaseUrl(), 'https://rayhealthevv.com/api');
});

test('getRayHealthApiBaseUrl trims trailing slashes', () => {
  assert.equal(getRayHealthApiBaseUrl('https://rayhealthevv.com/api///'), 'https://rayhealthevv.com/api');
});

test('buildPullChangesQuery builds the shared sync query string', () => {
  const query = buildPullChangesQuery({
    lastPulledAt: 1710000000000,
    entities: ['VISIT', 'TASK'],
    organizationId: 'org-123',
    caregiverId: 'caregiver-456',
  });

  assert.equal(
    query,
    'lastPulledAt=1710000000000&entities=VISIT%2CTASK&organizationId=org-123&caregiverId=caregiver-456',
  );
});

test('mapRolesToMobileRole prefers caregiver when present', () => {
  assert.equal(mapRolesToMobileRole(['COORDINATOR', 'CAREGIVER']), 'caregiver');
  assert.equal(mapRolesToMobileRole(['ORG_ADMIN']), 'admin');
  assert.equal(mapRolesToMobileRole(['BRANCH_ADMIN']), 'supervisor');
});

test('mapRayHealthVisit normalizes live mobile visit payloads', () => {
  const visit = mapRayHealthVisit({
    id: 'visit-1',
    caregiverId: 'caregiver-1',
    clientName: 'John Smith',
    clientAddress: {
      line1: '123 Main St',
      city: 'Columbus',
      state: 'OH',
      postalCode: '43215',
      latitude: 39.9612,
      longitude: -82.9988,
    },
    scheduledStartTime: '2026-05-06T08:00:00',
    scheduledEndTime: '2026-05-06T10:00:00',
    status: 'IN_PROGRESS',
  });

  assert.deepEqual(visit, {
    id: 'visit-1',
    caregiverId: 'caregiver-1',
    patientName: 'John Smith',
    patientAddress: '123 Main St, Columbus, OH 43215',
    scheduledStartTime: '2026-05-06T08:00:00',
    scheduledEndTime: '2026-05-06T10:00:00',
    status: 'active',
    location: {
      latitude: 39.9612,
      longitude: -82.9988,
    },
  });
});
