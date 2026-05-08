import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
describe('capability guards', () => {
    it('blocks caregiver access to admin-only routes', async () => {
        const response = await request(createApp())
            .get('/agencies/current')
            .set('x-agency-id', 'agency-1')
            .set('x-user-role', 'caregiver');
        expect(response.status).toBe(403);
    });
});
//# sourceMappingURL=capability-guard.test.js.map