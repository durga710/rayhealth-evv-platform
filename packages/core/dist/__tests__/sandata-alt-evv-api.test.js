import { afterEach, describe, expect, it, vi } from 'vitest';
import { SandataApiClient, SandataEntityType } from '../integrations/sandata/index.js';
const config = {
    baseUrl: 'https://uat-api.sandata.test/altevv/v1/',
    username: 'svc-user',
    password: 'svc-pass',
    entityGuid: 'guid-123',
    maxBatchSize: 5000,
    statusPollDelayMs: 300000,
    environment: 'UAT',
};
function mockFetch(status, body) {
    return vi.fn().mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        text: async () => (body === undefined ? '' : JSON.stringify(body)),
    });
}
afterEach(() => {
    vi.unstubAllGlobals();
});
describe('SandataApiClient.post', () => {
    it('sends Basic auth + EntityGuid, strips the trailing slash, and returns the uuid', async () => {
        const fetchSpy = mockFetch(200, { uuid: 'batch-uuid-1', status: 'RECEIVED' });
        vi.stubGlobal('fetch', fetchSpy);
        const client = new SandataApiClient(config);
        const out = await client.post(SandataEntityType.CLIENT, [{ ClientCustomID: 'c1', ClientFirstName: 'A', ClientLastName: 'B', SequenceID: 1 }]);
        expect(out.kind).toBe('accepted');
        if (out.kind === 'accepted')
            expect(out.uuid).toBe('batch-uuid-1');
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe('https://uat-api.sandata.test/altevv/v1/clients');
        expect(init.method).toBe('POST');
        expect(init.headers.authorization).toBe(`Basic ${Buffer.from('svc-user:svc-pass').toString('base64')}`);
        expect(init.headers.EntityGuid).toBe('guid-123');
    });
    it('classifies 401 as a non-retryable error', async () => {
        vi.stubGlobal('fetch', mockFetch(401, { message: 'unauthorized' }));
        const out = await new SandataApiClient(config).post(SandataEntityType.VISIT, []);
        expect(out).toMatchObject({ kind: 'error', status: 401, retryable: false });
    });
    it('classifies 503 as a retryable error', async () => {
        vi.stubGlobal('fetch', mockFetch(503, { message: 'unavailable' }));
        const out = await new SandataApiClient(config).post(SandataEntityType.EMPLOYEE, []);
        expect(out).toMatchObject({ kind: 'error', status: 503, retryable: true });
    });
    it('treats a 200 with no uuid as a non-retryable error', async () => {
        vi.stubGlobal('fetch', mockFetch(200, { status: 'RECEIVED' }));
        const out = await new SandataApiClient(config).post(SandataEntityType.CLIENT, []);
        expect(out).toMatchObject({ kind: 'error', retryable: false });
    });
});
describe('SandataApiClient.getStatus', () => {
    it('hits the status path and returns ready results', async () => {
        const fetchSpy = mockFetch(200, {
            uuid: 'batch-uuid-1',
            status: 'COMPLETED',
            records: [{ externalID: 'c1', status: 'ACCEPTED' }],
        });
        vi.stubGlobal('fetch', fetchSpy);
        const out = await new SandataApiClient(config).getStatus(SandataEntityType.CLIENT, 'batch-uuid-1');
        expect(out.kind).toBe('ready');
        if (out.kind === 'ready')
            expect(out.response.records?.[0]?.externalID).toBe('c1');
        expect(fetchSpy.mock.calls[0][0]).toBe('https://uat-api.sandata.test/altevv/v1/clients/status/batch-uuid-1');
    });
    it('returns not_ready on a 404', async () => {
        vi.stubGlobal('fetch', mockFetch(404, undefined));
        const out = await new SandataApiClient(config).getStatus(SandataEntityType.VISIT, 'u');
        expect(out.kind).toBe('not_ready');
    });
    it('returns not_ready while IN_PROGRESS', async () => {
        vi.stubGlobal('fetch', mockFetch(200, { uuid: 'u', status: 'IN_PROGRESS' }));
        const out = await new SandataApiClient(config).getStatus(SandataEntityType.VISIT, 'u');
        expect(out.kind).toBe('not_ready');
    });
    it('returns not_ready when the message says the result is not ready', async () => {
        vi.stubGlobal('fetch', mockFetch(200, { uuid: 'u', status: 'COMPLETED', message: 'The result for the input UUID is not ready yet.' }));
        const out = await new SandataApiClient(config).getStatus(SandataEntityType.VISIT, 'u');
        expect(out.kind).toBe('not_ready');
    });
});
//# sourceMappingURL=sandata-alt-evv-api.test.js.map