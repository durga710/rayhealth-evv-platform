import { describe, expect, it } from 'vitest';
import {
  buildSandbox835,
  createSandboxClearinghouseTransport,
  isSandboxDenied,
} from '../integrations/clearinghouse-sandbox.js';
import { parse835 } from '../services/edi-835.js';

const CLAIMS = [
  { controlNumber: 'ABC111111111', totalChargeCents: 12_500 },
  { controlNumber: 'DEF222222223', totalChargeCents: 8_000 }, // ends in 3: denied
  { controlNumber: 'GHI333333331', totalChargeCents: 4_400 },
];

describe('buildSandbox835', () => {
  it('produces a file the real parse835 accepts', () => {
    const file = buildSandbox835(CLAIMS)!;
    const era = parse835(file.content);
    expect(era.claims).toHaveLength(3);
    expect(era.traceNumber).toMatch(/^SBX[0-9A-F]{8}$/);
  });

  it('pays non-denied claims in full and totals BPR correctly', () => {
    const era = parse835(buildSandbox835(CLAIMS)!.content);
    const paid = era.claims.find((c) => c.controlNumber === 'ABC111111111')!;
    expect(paid.derivedStatus).toBe('paid');
    expect(paid.paidCents).toBe(12_500);
    expect(paid.payerClaimControlNumber).toBe('SBX-ABC111111111');
    expect(era.totalPaidCents).toBe(12_500 + 4_400);
  });

  it('denies claims whose control number ends in 3, with a full-charge CO/97 adjustment', () => {
    const era = parse835(buildSandbox835(CLAIMS)!.content);
    const denied = era.claims.find((c) => c.controlNumber === 'DEF222222223')!;
    expect(denied.derivedStatus).toBe('denied');
    expect(denied.paidCents).toBe(0);
    expect(denied.adjustments).toEqual([{ group: 'CO', reasonCode: '97', amountCents: 8_000 }]);
  });

  it('is deterministic: same claim set yields identical content regardless of order', () => {
    const a = buildSandbox835(CLAIMS)!;
    const b = buildSandbox835([...CLAIMS].reverse())!;
    expect(a.content).toBe(b.content);
    expect(a.fileName).toBe(b.fileName);
  });

  it('returns null for an empty or unusable claim set', () => {
    expect(buildSandbox835([])).toBeNull();
    expect(buildSandbox835([{ controlNumber: '  ', totalChargeCents: 100 }])).toBeNull();
  });

  it('exposes the denial rule for tests and demos', () => {
    expect(isSandboxDenied('X3')).toBe(true);
    expect(isSandboxDenied('X1')).toBe(false);
  });
});

describe('createSandboxClearinghouseTransport', () => {
  const source = async () => CLAIMS;

  it('accepts an 837 and returns a sandbox reference', async () => {
    const t = createSandboxClearinghouseTransport(source);
    const result = await t.submit('ISA*...~ST*837*0001~SE*2*0001~', { controlNumber: 'ABC111111111' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.reference).toMatch(/^SBX-ABC111111111-\d+$/);
  });

  it('rejects input that is not an 837', async () => {
    const t = createSandboxClearinghouseTransport(source);
    const result = await t.submit('hello world', { controlNumber: 'X' });
    expect(result).toMatchObject({ kind: 'error', retryable: false });
  });

  it('fetches one deterministic remittance file with a stable sha256', async () => {
    const t = createSandboxClearinghouseTransport(source);
    const first = await t.fetchRemittances({ maxFiles: 5 });
    const second = await t.fetchRemittances({ maxFiles: 5 });
    expect(first.kind).toBe('ok');
    if (first.kind === 'ok' && second.kind === 'ok') {
      expect(first.files).toHaveLength(1);
      expect(first.files[0].sha256).toBe(second.files[0].sha256);
      expect(first.files[0].name).toMatch(/^sandbox-era-[0-9a-f]{8}\.835$/);
    }
  });

  it('returns no files when there are no submitted claims', async () => {
    const t = createSandboxClearinghouseTransport(async () => []);
    const result = await t.fetchRemittances({ maxFiles: 5 });
    expect(result).toEqual({ kind: 'ok', files: [] });
  });

  it('test connection always succeeds and is clearly labeled', async () => {
    const t = createSandboxClearinghouseTransport(source);
    const result = await t.testConnection();
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.detail).toContain('Sandbox');
  });
});
