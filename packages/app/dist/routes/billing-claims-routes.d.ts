/**
 * Billing — claims + payroll routes.
 *
 * Mounted at /api/billing alongside the Stripe billing-routes (distinct
 * subpaths: /claims/*, /payroll/*). Turns GPS-verified EVV visits into Medicaid
 * claims, generates the X12 837P, scores denial risk, tracks claim status, and
 * exports payroll. Every endpoint is agency-scoped and capability-gated:
 *   - billing.read  → list / view / 837 download / payroll export
 *   - billing.write → generate / validate / change status
 *
 * Honesty: claim generation, 837 file creation, denial scoring and payroll
 * export run here in full. Actually transmitting the 837 to a payer needs a
 * clearinghouse trading-partner account (external credential) — the file this
 * produces is what the agency uploads there, or what an automated connector
 * would send once configured.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=billing-claims-routes.d.ts.map