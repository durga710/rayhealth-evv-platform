/**
 * Bulk import / migration routes — the onboarding path for an agency moving
 * off HHAeXchange / Sandata / a spreadsheet.
 *
 *   GET  /import/:entity/template.csv  — download the column template
 *   POST /import/:entity/preview       — dry-run: parse + validate, no writes
 *   POST /import/:entity/commit        — atomic upsert of a clean file
 *
 * The CSV is sent as a raw text/csv body (not JSON) so it bypasses the global
 * 100kb JSON limit; a route-scoped express.text parser with a higher cap reads
 * it. Commit is ALL-OR-NOTHING: if any row fails validation (or, for
 * authorizations, its client link can't be resolved) the whole import is
 * refused with 422 and nothing is written — no partial loads. Rows are keyed
 * on external_id so re-running the same file updates instead of duplicating.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=import-routes.d.ts.map