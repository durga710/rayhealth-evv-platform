import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('clearinghouse config routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the default config when none is stored', async () => {
    vi.spyOn(core, 'AgencyClearinghouseConfigRepository').mockImplementation(() => ({
      findByAgency: vi.fn().mockResolvedValue(undefined),
    } as any));

    const res = await request(createApp())
      .get('/agencies/me/clearinghouse-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ transport: 'sftp', enabled: false, hasCredentials: false });
  });

  it('refuses to enable without an endpoint (422)', async () => {
    vi.spyOn(core, 'AgencyClearinghouseConfigRepository').mockImplementation(() => ({
      findByAgency: vi.fn().mockResolvedValue(undefined),
    } as any));

    const res = await request(createApp())
      .put('/agencies/me/clearinghouse-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ enabled: true });

    expect(res.status).toBe(422);
  });

  it('saves transport, endpoint, and write-only credentials', async () => {
    const upsert = vi.fn().mockResolvedValue({
      agencyId: 'agency-1',
      transport: 'http',
      endpoint: 'https://ch.example',
      settings: { submitterId: 'S1', receiverId: 'R1' },
      enabled: true,
      hasCredentials: true,
    });
    vi.spyOn(core, 'AgencyClearinghouseConfigRepository').mockImplementation(() => ({
      findByAgency: vi.fn().mockResolvedValue(undefined),
      upsert,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: vi.fn().mockResolvedValue({}) } as any));

    const res = await request(createApp())
      .put('/agencies/me/clearinghouse-config')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ transport: 'http', endpoint: 'https://ch.example', enabled: true, credentials: { apiKey: 'secret' } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ transport: 'http', hasCredentials: true });
    // Credentials must be passed through to the repo (which encrypts), not echoed back.
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ credentials: { apiKey: 'secret' } }));
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('forbids coordinators (no agency.write) from updating', async () => {
    const res = await request(createApp())
      .put('/agencies/me/clearinghouse-config')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ enabled: false });

    expect(res.status).toBe(403);
  });
});
