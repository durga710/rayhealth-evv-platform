import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const CLIENTS_CSV =
  'external_id,first_name,last_name,date_of_birth\n' +
  'C-1,Ada,Lovelace,1990-12-10\n' +
  'C-2,Grace,Hopper,1985-01-02\n';

describe('import routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('serves a template CSV for a known entity', async () => {
    const res = await request(createApp())
      .get('/import/clients/template.csv')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('first_name');
    expect(res.text).toContain('external_id');
  });

  it('404s for an unknown entity', async () => {
    const res = await request(createApp())
      .get('/import/widgets/template.csv')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(404);
  });

  it('previews a clients CSV without writing', async () => {
    const res = await request(createApp())
      .post('/import/clients/preview')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send(CLIENTS_CSV);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ entity: 'clients', total: 2, okCount: 2, errorCount: 0 });
  });

  it('reports validation errors in preview', async () => {
    const res = await request(createApp())
      .post('/import/clients/preview')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send('first_name,last_name,date_of_birth\n,Smith,bad-date\n');
    expect(res.status).toBe(200);
    expect(res.body.errorCount).toBe(1);
    expect(res.body.rows[0].errors.length).toBeGreaterThan(0);
  });

  it('commits a clean clients CSV via upsert', async () => {
    const upsertClientForImport = vi
      .fn()
      .mockResolvedValueOnce({ id: 'a', action: 'created' })
      .mockResolvedValueOnce({ id: 'b', action: 'updated' });
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      upsertClientForImport,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    // createApp's db is a stub; the route only uses db.transaction here.
    const app = createApp();
    app.set('db', {
      transaction: async (cb: (trx: unknown) => Promise<void>) => cb({}),
    });

    const res = await request(app)
      .post('/import/clients/commit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send(CLIENTS_CSV);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ entity: 'clients', created: 1, updated: 1, total: 2 });
    expect(upsertClientForImport).toHaveBeenCalledTimes(2);
  });

  it('refuses a commit with validation errors (422, nothing written)', async () => {
    const upsertClientForImport = vi.fn();
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ upsertClientForImport } as any));

    const res = await request(createApp())
      .post('/import/clients/commit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send('first_name,last_name,date_of_birth\nAda,Lovelace,nope\n');

    expect(res.status).toBe(422);
    expect(upsertClientForImport).not.toHaveBeenCalled();
  });

  it('forbids coordinators from importing caregivers (no staff.write)', async () => {
    const res = await request(createApp())
      .post('/import/caregivers/preview')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .set('content-type', 'text/csv')
      .send('first_name,last_name,email\nA,B,a@b.com\n');
    expect(res.status).toBe(403);
  });
});
