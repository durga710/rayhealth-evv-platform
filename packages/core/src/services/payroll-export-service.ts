import { minutesBetween } from './claim-generation-service.js';

/**
 * Payroll export service (pure).
 *
 * Aggregates GPS-verified EVV visit time into payroll-ready totals per
 * caregiver for a pay period, and renders a clean CSV an agency can import into
 * the payroll provider it already uses. Same integrity principle as billing:
 * paid hours come from verified clock events, not free-typed timesheets.
 *
 * Pure + deterministic: no DB/IO; the caller fetches visits and hands them in.
 */

export interface PayrollVisit {
  caregiverId: string;
  caregiverFirstName: string;
  caregiverLastName: string;
  /** ISO-8601 clock-in. */
  clockInTime: string;
  /** ISO-8601 clock-out, or null if incomplete. */
  clockOutTime: string | null;
  status: 'pending' | 'verified' | 'flagged';
  serviceCode?: string | null;
}

export interface PayrollExportOptions {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  /** Only include EVV-verified, clocked-out visits (default true). */
  verifiedOnly?: boolean;
  /** Decimal places for the hours column (default 2). */
  decimals?: number;
}

export interface PayrollCaregiverSummary {
  caregiverId: string;
  caregiverName: string;
  visitCount: number;
  totalMinutes: number;
  totalHours: number;
}

export interface PayrollExportResult {
  rows: PayrollCaregiverSummary[];
  csv: string;
  totalHours: number;
  totalVisits: number;
  /** Visits excluded because they were unverified or had no clock-out. */
  excludedVisits: number;
}

const CSV_HEADER = [
  'Caregiver ID',
  'Caregiver Name',
  'Period Start',
  'Period End',
  'Visits',
  'Total Minutes',
  'Total Hours',
] as const;

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build payroll totals + CSV for a period.
 */
export function buildPayrollExport(
  visits: readonly PayrollVisit[],
  options: PayrollExportOptions,
): PayrollExportResult {
  const verifiedOnly = options.verifiedOnly ?? true;
  const decimals = options.decimals ?? 2;

  const byCaregiver = new Map<
    string,
    { name: string; visitCount: number; totalMinutes: number }
  >();
  let excludedVisits = 0;

  for (const v of visits) {
    const usable = Boolean(v.clockOutTime) && (!verifiedOnly || v.status === 'verified');
    if (!usable) {
      excludedVisits += 1;
      continue;
    }
    const minutes = minutesBetween(v.clockInTime, v.clockOutTime as string);
    const name = `${v.caregiverLastName}, ${v.caregiverFirstName}`.trim();
    const entry = byCaregiver.get(v.caregiverId);
    if (entry) {
      entry.visitCount += 1;
      entry.totalMinutes += minutes;
    } else {
      byCaregiver.set(v.caregiverId, { name, visitCount: 1, totalMinutes: minutes });
    }
  }

  const rows: PayrollCaregiverSummary[] = [...byCaregiver.entries()]
    .map(([caregiverId, e]) => ({
      caregiverId,
      caregiverName: e.name,
      visitCount: e.visitCount,
      totalMinutes: e.totalMinutes,
      totalHours: Number((e.totalMinutes / 60).toFixed(decimals)),
    }))
    // Stable, human-friendly ordering by caregiver name then id.
    .sort((a, b) =>
      a.caregiverName === b.caregiverName
        ? a.caregiverId.localeCompare(b.caregiverId)
        : a.caregiverName.localeCompare(b.caregiverName),
    );

  const lines = [CSV_HEADER.map(csvField).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.caregiverId,
        r.caregiverName,
        options.periodStart,
        options.periodEnd,
        r.visitCount,
        r.totalMinutes,
        r.totalHours.toFixed(decimals),
      ]
        .map(csvField)
        .join(','),
    );
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
