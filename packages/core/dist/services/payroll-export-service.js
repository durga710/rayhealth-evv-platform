import { minutesBetween } from './claim-generation-service.js';
const CSV_HEADER = [
    'Caregiver ID',
    'Caregiver Name',
    'Period Start',
    'Period End',
    'Visits',
    'Total Minutes',
    'Total Hours',
];
function csvField(value) {
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/**
 * Build payroll totals + CSV for a period.
 */
export function buildPayrollExport(visits, options) {
    const verifiedOnly = options.verifiedOnly ?? true;
    const decimals = options.decimals ?? 2;
    const byCaregiver = new Map();
    let excludedVisits = 0;
    for (const v of visits) {
        const usable = Boolean(v.clockOutTime) && (!verifiedOnly || v.status === 'verified');
        if (!usable) {
            excludedVisits += 1;
            continue;
        }
        const minutes = minutesBetween(v.clockInTime, v.clockOutTime);
        const name = `${v.caregiverLastName}, ${v.caregiverFirstName}`.trim();
        const entry = byCaregiver.get(v.caregiverId);
        if (entry) {
            entry.visitCount += 1;
            entry.totalMinutes += minutes;
        }
        else {
            byCaregiver.set(v.caregiverId, { name, visitCount: 1, totalMinutes: minutes });
        }
    }
    const rows = [...byCaregiver.entries()]
        .map(([caregiverId, e]) => ({
        caregiverId,
        caregiverName: e.name,
        visitCount: e.visitCount,
        totalMinutes: e.totalMinutes,
        totalHours: Number((e.totalMinutes / 60).toFixed(decimals)),
    }))
        // Stable, human-friendly ordering by caregiver name then id.
        .sort((a, b) => a.caregiverName === b.caregiverName
        ? a.caregiverId.localeCompare(b.caregiverId)
        : a.caregiverName.localeCompare(b.caregiverName));
    const lines = [CSV_HEADER.map(csvField).join(',')];
    for (const r of rows) {
        lines.push([
            r.caregiverId,
            r.caregiverName,
            options.periodStart,
            options.periodEnd,
            r.visitCount,
            r.totalMinutes,
            r.totalHours.toFixed(decimals),
        ]
            .map(csvField)
            .join(','));
    }
    const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
    const totalVisits = rows.reduce((s, r) => s + r.visitCount, 0);
    return {
        rows,
        csv: lines.join('\r\n') + '\r\n',
        totalHours: Number((totalMinutes / 60).toFixed(decimals)),
        totalVisits,
        excludedVisits,
    };
}
//# sourceMappingURL=payroll-export-service.js.map