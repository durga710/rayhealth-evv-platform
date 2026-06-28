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
    periodStart: string;
    periodEnd: string;
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
/**
 * Build payroll totals + CSV for a period.
 */
export declare function buildPayrollExport(visits: readonly PayrollVisit[], options: PayrollExportOptions): PayrollExportResult;
//# sourceMappingURL=payroll-export-service.d.ts.map