import { describe, expect, it } from 'vitest';
import {
  checkScheduleConflicts,
  type ConflictAuthorization,
} from '../services/schedule-conflict-service.js';

const auth: ConflictAuthorization = {
  serviceCode: 'T1019',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  unitsAuthorized: 100,
  unitsRemaining: 40,
};

describe('checkScheduleConflicts', () => {
  it('passes cleanly for a covered, non-duplicate, in-units assignment', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-06-15' },
      existingAssignments: [],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('hard-blocks a duplicate (same template + date)', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-06-15' },
      existingAssignments: [{ visitTemplateId: 'tpl-1', visitDate: '2026-06-15' }],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toHaveLength(1);
    expect(r.hardConflicts[0]).toContain('already assigned');
  });

  it('warns when no authorization covers the date', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-07-15' },
      existingAssignments: [],
      authorizations: [auth],
    });
    expect(r.hardConflicts).toEqual([]);
    expect(r.warnings.some((w) => w.includes('No active authorization'))).toBe(true);
  });

  it('warns when covering authorization units are exhausted', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1', visitDate: '2026-06-15' },
      existingAssignments: [],
      authorizations: [{ ...auth, unitsRemaining: 0 }],
    });
    expect(r.warnings.some((w) => w.includes('exhausted'))).toBe(true);
  });

  it('skips date-based checks when no visit date is set', () => {
    const r = checkScheduleConflicts({
      proposed: { visitTemplateId: 'tpl-1' },
      existingAssignments: [{ visitTemplateId: 'tpl-1', visitDate: '2026-06-15' }],
      authorizations: [],
    });
    expect(r.hardConflicts).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
