/**
 * Learning domain — caregiver training catalog, enrollments, completions.
 *
 * Designed around PA personal-care training requirements (PA Code §52.18 et seq.):
 *   - One-time orientation before first visit
 *   - Annual recurring training (12 hours/year minimum)
 *   - Recertifications with explicit expiry (CPR, first-aid)
 *
 * Compliance posture:
 *   - course_completions is an append-only event log — never updated
 *   - course_enrollments tracks current state (due dates, expiry)
 *   - The pair lets us reconstruct who knew what when, for audit purposes
 */
export {};
//# sourceMappingURL=learning.js.map