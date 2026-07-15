import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClearinghouseTransport } from '../integrations/clearinghouse-http.js';

const INPUT = {
  endpoint: 'https://api.clearinghouse.example.com',
  credentials: { apiKey: 'key-123' },
  settings: {},
};

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('http transport submit', () => {
  it('POSTs the raw 837 with EDI content type and bearer auth, extracting the reference', async () => {
    const mock = stubFetch(200, { reference: 'CH-REF-42' });
    const t = createHttpClearinghouseTransport(INPUT);
    const result = await t.submit('ISA*...~ST*837~', { controlNumber: 'C1' });

    expect(result).toEqual({ kind: 'ok', reference: 'CH-REF-42' });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('https://api.clearinghouse.example.com/claims');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('ISA*...~ST*837~');
    expect(init.headers['content-type']).toBe('application/edi-x12');
    expect(init.headers.authorization).toBe('Bearer key-123');
  });

  it('synthesizes a reference when the response has none', async () => {
    stubFetch(202, {});
    const t = createHttpClearinghouseTransport(INPUT);
    const result = await t.submit('ST*837~', { controlNumber: 'C1' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.reference).toMatch(/^HTTP-202-\d+$/);
  });

  it('classifies 401 as non-retryable and 503 as retryable, never reflecting the body', async () => {
    stubFetch(401, { secret: 'internal-token-abc' });
    const t = createHttpClearinghouseTransport(INPUT);
    const unauthorized = await t.submit('ST*837~', { controlNumber: 'C1' });
    expect(unauthorized).toMatchObject({ kind: 'error', retryable: false });
    if (unauthorized.kind === 'error') expect(unauthorized.message).not.toContain('internal-token-abc');

    stubFetch(503, { detail: 'stack trace here' });
    const unavailable = await t.submit('ST*837~', { controlNumber: 'C1' });
    expect(unavailable).toMatchObject({ kind: 'error', retryable: true });
    if (unavailable.kind === 'error') expect(unavailable.message).not.toContain('stack trace');
  });

  it('refuses a private endpoint before any fetch happens', async () => {
    const mock = stubFetch(200, {});
    const t = createHttpClearinghouseTransport({ ...INPUT, endpoint: 'https://192.168.1.10' });
    const result = await t.submit('ST*837~', { controlNumber: 'C1' });
    expect(result).toMatchObject({ kind: 'error' });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('http transport fetchRemittances', () => {
  it('GETs the remittance path and hashes each file, capping at maxFiles', async () => {
    stubFetch(200, {
      files: [
        { name: 'a.835', content: 'BPR*I*1.00~CLP*X*1*1.00*1.00*0~' },
        { name: 'b.835', content: 'BPR*I*2.00~CLP*Y*1*2.00*2.00*0~' },
        { name: 'c.835', content: 'BPR*I*3.00~CLP*Z*1*3.00*3.00*0~' },
      ],
    });
    const t = createHttpClearinghouseTransport(INPUT);
    const result = await t.fetchRemittances({ maxFiles: 2 });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.files).toHaveLength(2);
      expect(result.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('uses basic auth when only username/password are configured', async () => {
    const mock = stubFetch(200, { files: [] });
    const t = createHttpClearinghouseTransport({
      ...INPUT,
      credentials: { username: 'u', password: 'p' },
    });
    await t.fetchRemittances({ maxFiles: 5 });
    const [, init] = mock.mock.calls[0];
    expect(init.headers.authorization).toMatch(/^Basic /);
  });
});

describe('http transport testConnection', () => {
  it('treats any status below 500 as reachable', async () => {
    stubFetch(404, undefined);
    const t = createHttpClearinghouseTransport(INPUT);
    const result = await t.testConnection();
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.detail).toContain('404');
  });

  it('reports a retryable error on 5xx', async () => {
    stubFetch(500, undefined);
    const t = createHttpClearinghouseTransport(INPUT);
    expect(await t.testConnection()).toMatchObject({ kind: 'error', retryable: true });
  });
});
