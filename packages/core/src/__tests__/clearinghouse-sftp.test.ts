import { describe, expect, it, vi } from 'vitest';
import { createSftpClearinghouseTransport, type SftpLike } from '../integrations/clearinghouse-sftp.js';

function makeFake(overrides: Partial<SftpLike> = {}) {
  const calls: Record<string, unknown[][]> = { connect: [], put: [], list: [], get: [], end: [] };
  const fake: SftpLike = {
    connect: vi.fn(async (...args: unknown[]) => void calls.connect.push(args)),
    put: vi.fn(async (...args: unknown[]) => void calls.put.push(args)),
    list: vi.fn(async () => []),
    get: vi.fn(async () => Buffer.from('')),
    end: vi.fn(async () => void calls.end.push([])),
    ...overrides,
  };
  return { fake, calls };
}

const INPUT = {
  host: 'sftp.clearinghouse.example.com',
  username: 'agency-user',
  password: 'secret',
  settings: { port: 2222, uploadDir: '/inbound/', remittanceDir: '/outbound' },
};

describe('sftp transport submit', () => {
  it('connects with the configured host/port/user and uploads to the upload dir', async () => {
    const { fake } = makeFake();
    const t = createSftpClearinghouseTransport(INPUT, async () => fake);
    const result = await t.submit('ISA*...~ST*837*0001~', { controlNumber: 'CTRL00000001' });

    expect(fake.connect).toHaveBeenCalledWith(
      expect.objectContaining({ host: INPUT.host, port: 2222, username: 'agency-user', password: 'secret' }),
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.reference).toMatch(/^\/inbound\/claim-CTRL00000001-\d{8}T\d{6}\.837$/);
    }
    const putArgs = (fake.put as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(Buffer.isBuffer(putArgs[0])).toBe(true);
    expect(fake.end).toHaveBeenCalledTimes(1);
  });

  it('maps authentication failures as non-retryable without reflecting details', async () => {
    const { fake } = makeFake({
      connect: vi.fn(async () => {
        throw new Error('All configured authentication methods failed at host banner xyz');
      }),
    });
    const t = createSftpClearinghouseTransport(INPUT, async () => fake);
    const result = await t.submit('ST*837~', { controlNumber: 'C1' });
    expect(result).toEqual({ kind: 'error', message: 'SFTP authentication failed', retryable: false });
  });

  it('maps network failures as retryable and still closes the connection', async () => {
    const { fake } = makeFake({
      put: vi.fn(async () => {
        throw new Error('read ECONNRESET');
      }),
    });
    const t = createSftpClearinghouseTransport(INPUT, async () => fake);
    const result = await t.submit('ST*837~', { controlNumber: 'C1' });
    expect(result).toMatchObject({ kind: 'error', retryable: true });
    expect(fake.end).toHaveBeenCalledTimes(1);
  });
});

describe('sftp transport fetchRemittances', () => {
  it('lists the remittance dir, filters to remittance files, caps at maxFiles, downloads in name order', async () => {
    const { fake } = makeFake({
      list: vi.fn(async () => [
        { name: 'b-era.835', type: '-' },
        { name: 'notes.pdf', type: '-' },
        { name: 'archive', type: 'd' },
        { name: 'a-era.835', type: '-' },
        { name: 'c-era.txt', type: '-' },
      ]),
      get: vi.fn(async (p: string) => Buffer.from(`CONTENT:${p}`)),
    });
    const t = createSftpClearinghouseTransport(INPUT, async () => fake);
    const result = await t.fetchRemittances({ maxFiles: 2 });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.files.map((f) => f.name)).toEqual(['a-era.835', 'b-era.835']);
      expect(result.files[0].content).toBe('CONTENT:/outbound/a-era.835');
      expect(result.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(fake.end).toHaveBeenCalledTimes(1);
  });
});

describe('sftp transport testConnection', () => {
  it('reports success after connecting and listing', async () => {
    const { fake } = makeFake();
    const t = createSftpClearinghouseTransport(INPUT, async () => fake);
    const result = await t.testConnection();
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.detail).toContain('sftp.clearinghouse.example.com:2222');
  });

  it('defaults port to 22 and directories to /inbound and /outbound', async () => {
    const { fake } = makeFake();
    const t = createSftpClearinghouseTransport(
      { ...INPUT, settings: {} },
      async () => fake,
    );
    await t.testConnection();
    expect(fake.connect).toHaveBeenCalledWith(expect.objectContaining({ port: 22 }));
    expect(fake.list).toHaveBeenCalledWith('/outbound');
  });
});
