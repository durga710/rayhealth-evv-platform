import { describe, expect, it } from 'vitest';
import { buildPayrollExport, } from '../services/payroll-export-service.js';
function v(o = {}) {
    return {
        caregiverId: 'cg-1',
        caregiverFirstName: 'Alex',
        caregiverLastName: 'Smith',
        clockInTime: '2026-06-10T14:00:00Z',
        clockOutTime: '2026-06-10T16:00:00Z',
        status: 'verified',
        serviceCode: 'T1019',
        ...o,
    };
}
const opts = { periodStart: '2026-06-01', periodEnd: '2026-06-15' };
describe('buildPayrollExport', () => {
    it('aggregates verified hours per caregiver', () => {
        const r = buildPayrollExport([
            v({ caregiverId: 'cg-1', clockInTime: '2026-06-10T14:00:00Z', clockOutTime: '2026-06-10T16:00:00Z' }),
            v({ caregiverId: 'cg-1', clockInTime: '2026-06-11T09:00:00Z', clockOutTime: '2026-06-11T10:30:00Z' }),
        ], opts);
        expect(r.rows).toHaveLength(1);
        expect(r.rows[0].visitCount).toBe(2);
        expect(r.rows[0].totalMinutes).toBe(210);
        expect(r.rows[0].totalHours).toBe(3.5);
        expect(r.totalHours).toBe(3.5);
        expect(r.totalVisits).toBe(2);
    });
    it('excludes unverified visits and those without clock-out by default', () => {
        const r = buildPayrollExport([
            v({ status: 'verified' }),
            v({ status: 'flagged' }),
            v({ clockOutTime: null }),
        ], opts);
        expect(r.rows[0].visitCount).toBe(1);
        expect(r.excludedVisits).toBe(2);
    });
    it('can include all clocked-out visits when verifiedOnly is false', () => {
        const r = buildPayrollExport([v({ status: 'verified' }), v({ status: 'flagged' })], { ...opts, verifiedOnly: false });
        expect(r.totalVisits).toBe(2);
        expect(r.excludedVisits).toBe(0);
    });
    it('renders a CSV with a header and one row per caregiver', () => {
        const r = buildPayrollExport([
            v({ caregiverId: 'cg-1', caregiverFirstName: 'Alex', caregiverLastName: 'Smith' }),
            v({ caregiverId: 'cg-2', caregiverFirstName: 'Bea', caregiverLastName: 'Jones' }),
        ], opts);
        const lines = r.csv.trimEnd().split('\r\n');
        expect(lines[0]).toBe('Caregiver ID,Caregiver Name,Period Start,Period End,Visits,Total Minutes,Total Hours');
        expect(lines).toHaveLength(3);
        // Sorted by name: Jones before Smith.
        expect(lines[1]).toContain('Jones, Bea');
        expect(lines[2]).toContain('Smith, Alex');
        expect(lines[2]).toContain('2026-06-01,2026-06-15,1,120,2.00');
    });
    it('quotes CSV fields that contain commas', () => {
        const r = buildPayrollExport([v({ caregiverFirstName: 'Al', caregiverLastName: 'Smith, Jr' })], opts);
        expect(r.csv).toContain('"Smith, Jr, Al"');
    });
    it('returns an empty body (header only) when no visits qualify', () => {
        const r = buildPayrollExport([v({ status: 'flagged' })], opts);
        expect(r.rows).toHaveLength(0);
        expect(r.totalHours).toBe(0);
        expect(r.csv.trimEnd().split('\r\n')).toHaveLength(1);
    });
});
//# sourceMappingURL=payroll-export-service.test.js.map