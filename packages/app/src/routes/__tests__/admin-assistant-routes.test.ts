import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateText } from 'ai';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(() => 'step-limit'),
  tool: vi.fn((definition) => definition),
}));

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function makeDb() {
  const insert = vi.fn().mockResolvedValue({});
  const raw = vi.fn().mockResolvedValue({
    rows: [{ exception_type: 'missing-location', count: 2 }],
  });
  const db = vi.fn((table: string) => {
    expect(table).toBe('support_conversations');
    return { insert };
  }) as unknown as ((table: string) => { insert: typeof insert }) & { raw: typeof raw };
  db.raw = raw;
  return { db, insert, raw };
}

describe('admin assistant routes', () => {
  it('stores only redacted hash envelopes and records an audit event', async () => {
    const { db, insert } = makeDb();
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'createDb').mockReturnValue(db as any);
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: auditCreate }) as any,
    );
    vi.mocked(generateText).mockResolvedValue({
      text: 'There are two open missing-location exceptions.',
    } as any);

    const { createApp } = await import('../../app.js');
    const response = await request(createApp())
      .post('/admin-assistant/chat')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({
        sessionId: 'ops-session',
        messages: [{ role: 'user', content: 'Does Maria Gomez have an open exception?' }],
      });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('two open');

    const rows = insert.mock.calls[0][0] as Array<{ content: string; ip_address: string | null }>;
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain('Maria Gomez');
    expect(JSON.stringify(rows)).not.toContain('two open missing-location');
    expect(rows.every((row) => row.ip_address === null)).toBe(true);
    for (const row of rows) {
      const envelope = JSON.parse(row.content) as {
        redacted: boolean;
        surface: string;
        sha256: string;
        length: number;
      };
      expect(envelope).toMatchObject({ redacted: true, surface: 'admin-assistant' });
      expect(envelope.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(envelope.length).toBeGreaterThan(0);
    }

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'copilot.query',
        entityType: 'admin_assistant',
        payload: expect.objectContaining({
          surface: 'admin-assistant',
          promptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          responseHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  }, 20_000);

  it('counts only unresolved EVV exceptions', async () => {
    const { db, raw } = makeDb();
    vi.spyOn(core, 'createDb').mockReturnValue(db as any);
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: vi.fn().mockResolvedValue({}) }) as any,
    );
    vi.mocked(generateText).mockImplementation(async (options: any) => {
      await options.tools.list_open_exceptions.execute({});
      return { text: 'Open exceptions are grouped by type.' } as any;
    });

    const { createApp } = await import('../../app.js');
    const response = await request(createApp())
      .post('/admin-assistant/chat')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({
        messages: [{ role: 'user', content: 'How many open exceptions are there?' }],
      });

    expect(response.status).toBe(200);
    expect(raw.mock.calls[0][0]).toMatch(/e\.approved_at is null/i);
  }, 20_000);
});
