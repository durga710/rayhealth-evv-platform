import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('template routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renames a template via PUT', async () => {
    const updateTemplate = vi.fn().mockResolvedValue({ id: 't1', clientId: 'c1', name: 'Morning ADL', tasks: [] });
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({ updateTemplate } as any));

    const res = await request(createApp())
      .put('/templates/t1')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ name: 'Morning ADL' });

    expect(res.status).toBe(200);
    expect(updateTemplate).toHaveBeenCalledWith('t1', 'agency-1', { name: 'Morning ADL' });
  });

  it('rejects a PUT with an empty name (400)', async () => {
    const updateTemplate = vi.fn();
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({ updateTemplate } as any));

    const res = await request(createApp())
      .put('/templates/t1')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  it('refuses to delete a template still used by assignments (409)', async () => {
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      deleteTemplate: vi.fn().mockResolvedValue('has_dependencies'),
    } as any));

    const res = await request(createApp())
      .delete('/templates/t1')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAS_DEPENDENCIES');
  });

  it('deletes an unused template (204)', async () => {
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      deleteTemplate: vi.fn().mockResolvedValue('deleted'),
    } as any));

    const res = await request(createApp())
      .delete('/templates/t1')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(res.status).toBe(204);
  });
});
