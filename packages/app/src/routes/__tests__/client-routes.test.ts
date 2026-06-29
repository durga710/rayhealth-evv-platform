import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('client routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a client and persists the EVV geofence anchor', async () => {
    const createClient = vi.fn().mockImplementation((_agencyId: string, client: any) =>
      Promise.resolve({ id: 'client-1', ...client }),
    );
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ createClient } as any));

    const response = await request(createApp())
      .post('/clients')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1955-04-12',
        addressLine1: '123 Market St',
        city: 'Harrisburg',
        state: 'PA',
        postalCode: '17101',
        latitude: 40.2732,
        longitude: -76.8867,
      });

    expect(response.status).toBe(201);
    // The coordinates must reach the repository so the geofence can verify.
    const passed = createClient.mock.calls[0][1];
    expect(passed.latitude).toBe(40.2732);
    expect(passed.longitude).toBe(-76.8867);
    expect(passed.state).toBe('PA');
  });

  it('rejects an invalid client with 400 instead of a 500', async () => {
    const createClient = vi.fn();
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ createClient } as any));

    const response = await request(createApp())
      .post('/clients')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      // latitude out of range + missing required dateOfBirth.
      .send({ firstName: 'Jane', lastName: 'Doe', latitude: 999 });

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('updates a client (partial) and returns the result', async () => {
    const updateClient = vi.fn().mockResolvedValue({ id: 'client-1', firstName: 'Janet', lastName: 'Doe' });
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ updateClient } as any));

    const response = await request(createApp())
      .put('/clients/client-1')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ firstName: 'Janet' });

    expect(response.status).toBe(200);
    expect(updateClient).toHaveBeenCalledWith('client-1', 'agency-1', { firstName: 'Janet' });
  });

  it('404s updating a client in another agency', async () => {
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      updateClient: vi.fn().mockResolvedValue(null),
    } as any));

    const response = await request(createApp())
      .put('/clients/other-agency-client')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ firstName: 'Janet' });

    expect(response.status).toBe(404);
  });

  it('deletes a client with no dependents (204)', async () => {
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      deleteClient: vi.fn().mockResolvedValue('deleted'),
    } as any));

    const response = await request(createApp())
      .delete('/clients/client-1')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(204);
  });

  it('refuses to delete a client that still has dependents (409)', async () => {
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      deleteClient: vi.fn().mockResolvedValue('has_dependencies'),
    } as any));

    const response = await request(createApp())
      .delete('/clients/client-1')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('HAS_DEPENDENCIES');
  });
});
