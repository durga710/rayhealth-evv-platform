import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

function mockRepos(seed: {
  request?: core.VisitMaintenance;
  approve?: core.VisitMaintenance | null;
  reject?: core.VisitMaintenance | null;
  queue?: core.VisitMaintenance[];
  history?: core.VisitMaintenance[];
}): {
  requestUnlock: ReturnType<typeof vi.fn>;
  approveUnlock: ReturnType<typeof vi.fn>;
  rejectUnlock: ReturnType<typeof vi.fn>;
  listPendingForAgency: ReturnType<typeof vi.fn>;
  listForVisit: ReturnType<typeof vi.fn>;
  listForAgency: ReturnType<typeof vi.fn>;
  auditCreate: ReturnType<typeof vi.fn>;
} {
  const requestUnlock = vi.fn().mockImplementation((m: core.VisitMaintenance) =>
    Promise.resolve(seed.request ?? { ...m, id: 'vm-1' }),
  );
  const approveUnlock = vi.fn().mockResolvedValue(seed.approve ?? null);
  const rejectUnlock = vi.fn().mockResolvedValue(seed.reject ?? null);
  const listPendingForAgency = vi.fn().mockResolvedValue(seed.queue ?? []);
  const listForVisit = vi.fn().mockResolvedValue([]);
  const listForAgency = vi.fn().mockResolvedValue(seed.history ?? []);
  // Hoisted so the same fn instance is returned by every `new AuditEventRepository()`
  // call, letting tests assert on the cumulative call list.
  const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });

  vi.spyOn(core, 'VisitMaintenanceRepository').mockImplementation(function MockRepo() {
    return {
      requestUnlock,
      approveUnlock,
      rejectUnlock,
      findById: vi.fn(),
      listPendingForAgency,
      listForVisit,
      listForAgency,
    } as unknown as core.VisitMaintenanceRepository;
  } as unknown as typeof core.VisitMaintenanceRepository);

  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function MockAudit() {
    return { create: auditCreate } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);

  return { requestUnlock, approveUnlock, rejectUnlock, listPendingForAgency, listForVisit, listForAgency, auditCreate };
}

const VISIT_ID = '00000000-0000-4000-8000-000000000001';
const AGENCY_ID = '00000000-0000-4000-8000-00000000aaaa';
const USER_ID = '00000000-0000-4000-8000-00000000bbbb';

// Override the default helper IDs which are not UUIDs — the new VMUR schema
// validates requesterId/agencyId as UUIDs, so tests must use real ones.
function token(role: Parameters<typeof makeToken>[0]): string {
  return makeToken(role, AGENCY_ID, USER_ID);
}

describe('POST /maintenance/request-unlock', () => {
  it('creates a VMUR with coordinator originator and 201 response', async () => {
    const { requestUnlock } = mockRepos({});
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/request-unlock')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({
        visitId: VISIT_ID,
        reason: 'Late clock-out due to client refusal of EVV app.',
        reasonCategoryCode: 'ACLN',
        correctionCode: 'TIME_CHANGE',
        adjustedEndTime: '2026-05-10T17:30:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(requestUnlock).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCategoryCode: 'ACLN',
        correctionCode: 'TIME_CHANGE',
        originatorRole: 'coordinator',
      }),
    );
  });

  it('rejects unknown reason codes with 400', async () => {
    mockRepos({});
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/request-unlock')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({
        visitId: VISIT_ID,
        reason: 'Made-up code',
        reasonCategoryCode: 'XXXX',
      });

    expect(response.status).toBe(400);
  });

  it('rejects missing-signature submissions without justification', async () => {
    mockRepos({});
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/request-unlock')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({
        visitId: VISIT_ID,
        reason: 'Signature missing.',
        reasonCategoryCode: 'ACLN',
        clientSignaturePresent: false,
        // no incompleteSignatureReason
      });

    expect(response.status).toBe(400);
  });

  it('accepts missing-signature submissions with justification', async () => {
    mockRepos({});
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/request-unlock')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({
        visitId: VISIT_ID,
        reason: 'Client refused to sign per ACLN.',
        reasonCategoryCode: 'ACLN',
        clientSignaturePresent: false,
        caregiverSignaturePresent: true,
        incompleteSignatureReason: 'ACLN — client refused to sign electronically.',
      });

    expect(response.status).toBe(201);
  });
});

describe('POST /maintenance/caregiver-correction', () => {
  it('stamps originator=caregiver regardless of caller role', async () => {
    const { requestUnlock } = mockRepos({});
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/caregiver-correction')
      .set('Authorization', `Bearer ${token('caregiver')}`)
      .send({
        visitId: VISIT_ID,
        reason: 'Forgot to clock in until 10 minutes after arrival.',
        reasonCategoryCode: 'MFLB',
        correctionCode: 'TIME_CHANGE',
        adjustedStartTime: '2026-05-10T09:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(requestUnlock).toHaveBeenCalledWith(
      expect.objectContaining({
        originatorRole: 'caregiver',
        status: 'pending',
      }),
    );
  });
});

describe('POST /maintenance/approve-unlock/:id', () => {
  it('approves and records the approver', async () => {
    const { approveUnlock } = mockRepos({
      approve: {
        visitId: VISIT_ID,
        requesterId: 'user-1',
        reason: 'ok',
        reasonCategoryCode: 'MTLB',
        status: 'approved',
        approverId: 'user-1',
      },
    });

    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/approve-unlock/vm-1')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({ adjustedStartTime: '2026-05-10T09:00:00.000Z' });

    expect(response.status).toBe(200);
    expect(approveUnlock).toHaveBeenCalledWith('vm-1', expect.objectContaining({
      adjustedStartTime: '2026-05-10T09:00:00.000Z',
      approverId: USER_ID,
    }));
  });

  it('returns 404 when the VMUR is missing', async () => {
    mockRepos({ approve: null });
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/approve-unlock/missing-id')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({});

    expect(response.status).toBe(404);
  });
});

describe('POST /maintenance/reject-unlock/:id', () => {
  it('rejects with a reason, records it, and emits exception.rejected audit', async () => {
    const { rejectUnlock, auditCreate } = mockRepos({
      reject: {
        visitId: VISIT_ID,
        requesterId: 'user-1',
        reason: 'original\nREJECTED: insufficient documentation',
        status: 'rejected',
      },
    });
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/reject-unlock/vm-1')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({ reason: 'insufficient documentation' });

    expect(response.status).toBe(200);
    expect(rejectUnlock).toHaveBeenCalledWith('vm-1', expect.objectContaining({
      reason: 'insufficient documentation',
    }));
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'exception.rejected',
        outcome: 'success',
        payload: expect.objectContaining({ reason: 'insufficient documentation' }),
      }),
    );
  });

  it('rejects empty rejection reason with 400', async () => {
    mockRepos({});
    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .post('/maintenance/reject-unlock/vm-1')
      .set('Authorization', `Bearer ${token('coordinator')}`)
      .send({});

    expect(response.status).toBe(400);
  });
});

describe('GET /maintenance/queue', () => {
  it('returns the pending VMUR queue for the agency', async () => {
    mockRepos({
      queue: [
        {
          visitId: VISIT_ID,
          requesterId: 'user-1',
          reason: 'late clock-in',
          reasonCategoryCode: 'MFLB',
          originatorRole: 'caregiver',
          status: 'pending',
        },
      ],
    });

    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .get('/maintenance/queue')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].reasonCategoryCode).toBe('MFLB');
  });
});

describe('GET /maintenance/history', () => {
  it('returns the full history for the agency', async () => {
    const { listForAgency } = mockRepos({
      history: [
        { visitId: VISIT_ID, requesterId: 'u', reason: 'r', status: 'approved' },
        { visitId: VISIT_ID, requesterId: 'u', reason: 'r', status: 'rejected' },
      ],
    });

    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .get('/maintenance/history')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(listForAgency).toHaveBeenCalledWith(AGENCY_ID, expect.objectContaining({}));
  });

  it('passes whitelisted filters through to the repository', async () => {
    const { listForAgency } = mockRepos({ history: [] });

    const app = createApp();
    app.set('db', {} as never);

    await request(app)
      .get('/maintenance/history?status=approved&originator=caregiver&reasonCode=MFLB&limit=50')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(listForAgency).toHaveBeenCalledWith(
      AGENCY_ID,
      expect.objectContaining({
        status: 'approved',
        originatorRole: 'caregiver',
        reasonCategoryCode: 'MFLB',
        limit: 50,
      }),
    );
  });

  it('drops unknown filter values rather than passing them through', async () => {
    const { listForAgency } = mockRepos({ history: [] });

    const app = createApp();
    app.set('db', {} as never);

    await request(app)
      .get('/maintenance/history?status=eaten&originator=hacker&reasonCode=DROP+TABLE+visits')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(listForAgency).toHaveBeenCalledWith(
      AGENCY_ID,
      {
        status: undefined,
        originatorRole: undefined,
        reasonCategoryCode: undefined,
        limit: undefined,
      },
    );
  });

  it('clamps limit at 500', async () => {
    const { listForAgency } = mockRepos({ history: [] });

    const app = createApp();
    app.set('db', {} as never);

    await request(app)
      .get('/maintenance/history?limit=9999')
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(listForAgency).toHaveBeenCalledWith(
      AGENCY_ID,
      expect.objectContaining({ limit: 500 }),
    );
  });
});

describe('GET /maintenance/visit/:visitId', () => {
  it('returns all corrections for the specified visit', async () => {
    const { listForVisit } = mockRepos({});
    listForVisit.mockResolvedValue([
      { visitId: VISIT_ID, requesterId: USER_ID, reason: 'clock-in off by 5 min', reasonCategoryCode: 'MFLB', status: 'approved' },
    ]);

    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .get(`/maintenance/visit/${VISIT_ID}`)
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].reasonCategoryCode).toBe('MFLB');
    expect(listForVisit).toHaveBeenCalledWith(VISIT_ID);
  });

  it('returns empty array when visit has no corrections', async () => {
    const { listForVisit } = mockRepos({});
    listForVisit.mockResolvedValue([]);

    const app = createApp();
    app.set('db', {} as never);

    const response = await request(app)
      .get(`/maintenance/visit/${VISIT_ID}`)
      .set('Authorization', `Bearer ${token('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
