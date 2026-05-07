import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

describe('invite routes', () => {
  it('creates a pending staff invite for a caregiver role', async () => {
    const response = await request(createApp())
      .post('/invites')
      .set('x-agency-id', 'agency-1')
      .set('x-user-role', 'admin')
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
  });
});
