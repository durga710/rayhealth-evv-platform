import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import * as executor from '../../services/copilot-action-executor.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

function makeDb() {
  const first = vi.fn().mockResolvedValue({
    features: { aiCopilot: { enabled: true, plan: 'starter' } },
  });
  const where = vi.fn(() => ({ first }));
  const db = vi.fn((table: string) => {
    expect(table).toBe('agencies');
    return { where };
  }) as unknown as ((table: string) => { where: typeof where }) & {
    __first: typeof first;
  };
  db.__first = first;
  return db;
}

const action = {
  type: 'enroll_caregiver',
  caregiverId: '11111111-1111-4111-8111-111111111111',
  courseId: '22222222-2222-4222-8222-222222222222',
  dueAt: null,
} as const;

describe('copilot routes', () => {
  it('does not execute a confirmed action when the audit preflight fails', async () => {
    const db = makeDb();
    const auditCreate = vi.fn().mockRejectedValue(new Error('audit down'));
    const executeCopilotAction = vi
      .spyOn(executor, 'executeCopilotAction')
      .mockResolvedValue({ action, outcome: {}, summary: 'done' } as any);
    vi.spyOn(core, 'createDb').mockReturnValue(db as any);
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: auditCreate }) as any,
    );

    const { createApp } = await import('../../app.js');
    const response = await request(createApp())
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send(action);

    expect(response.status).toBe(500);
    expect(executeCopilotAction).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'copilot.action.confirmed',
        payload: expect.objectContaining({ status: 'confirmed_by_user' }),
      }),
    );
  }, 20_000);
});
