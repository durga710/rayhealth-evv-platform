import { describe, expect, it } from 'vitest';
import { createClearinghouseTransport } from '../integrations/clearinghouse-transport.js';
import type { ClearinghouseClientConfig } from '../integrations/clearinghouse-client.js';

function config(overrides: Partial<ClearinghouseClientConfig> = {}): ClearinghouseClientConfig {
  return {
    enabled: true,
    transport: 'http',
    endpoint: 'https://api.clearinghouse.example.com',
    credentials: { apiKey: 'k' },
    settings: {},
    ...overrides,
  };
}

const sandboxClaims = async () => [];

describe('createClearinghouseTransport gating', () => {
  it('refuses when disabled', () => {
    const result = createClearinghouseTransport(config({ enabled: false }), { sandboxClaims });
    expect(result).toMatchObject({ kind: 'not_configured' });
  });

  it('sandbox needs only enabled plus a claim source', () => {
    const ok = createClearinghouseTransport(
      config({ transport: 'sandbox', endpoint: null, credentials: null }),
      { sandboxClaims },
    );
    expect(ok.kind).toBe('ok');
    if (ok.kind === 'ok') expect(ok.transport.name).toBe('sandbox');

    const missingSource = createClearinghouseTransport(
      config({ transport: 'sandbox', endpoint: null, credentials: null }),
      {},
    );
    expect(missingSource).toMatchObject({ kind: 'not_configured' });
  });

  it('sftp requires a bare public hostname and username/password', () => {
    const ok = createClearinghouseTransport(
      config({
        transport: 'sftp',
        endpoint: 'sftp.clearinghouse.example.com',
        credentials: { username: 'u', password: 'p' },
      }),
    );
    expect(ok.kind).toBe('ok');
    if (ok.kind === 'ok') expect(ok.transport.name).toBe('sftp');

    expect(
      createClearinghouseTransport(
        config({ transport: 'sftp', endpoint: 'https://host.example.com', credentials: { username: 'u', password: 'p' } }),
      ),
    ).toMatchObject({ kind: 'not_configured', reason: expect.stringContaining('bare hostname') });

    expect(
      createClearinghouseTransport(
        config({ transport: 'sftp', endpoint: '192.168.1.10', credentials: { username: 'u', password: 'p' } }),
      ),
    ).toMatchObject({ kind: 'not_configured', reason: expect.stringContaining('private') });

    expect(
      createClearinghouseTransport(
        config({ transport: 'sftp', endpoint: 'sftp.example.com', credentials: { apiKey: 'k' } }),
      ),
    ).toMatchObject({ kind: 'not_configured', reason: expect.stringContaining('username and password') });
  });

  it('http requires a safe https endpoint and credentials', () => {
    expect(createClearinghouseTransport(config()).kind).toBe('ok');

    expect(
      createClearinghouseTransport(config({ endpoint: 'http://api.example.com' })),
    ).toMatchObject({ kind: 'not_configured', reason: expect.stringContaining('public https') });

    expect(
      createClearinghouseTransport(config({ endpoint: 'https://169.254.169.254' })),
    ).toMatchObject({ kind: 'not_configured' });

    expect(
      createClearinghouseTransport(config({ credentials: null })),
    ).toMatchObject({ kind: 'not_configured', reason: expect.stringContaining('credentials') });
  });

  it('rejects unknown transports by name', () => {
    expect(createClearinghouseTransport(config({ transport: 'carrier-pigeon' }))).toMatchObject({
      kind: 'not_configured',
      reason: expect.stringContaining('carrier-pigeon'),
    });
  });
});
