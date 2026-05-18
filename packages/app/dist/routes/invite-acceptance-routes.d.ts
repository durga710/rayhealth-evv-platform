/**
 * PUBLIC invite acceptance routes.
 *
 * Mounted in `app.ts` BEFORE the global authContext middleware so that
 * caregivers landing on an invite link can call these endpoints without
 * an existing session — they don't have one yet.
 *
 *   GET  /invites/accept/:token   — returns invite info for the acceptance page
 *   POST /invites/accept/:token   — { accessCode, password, firstName?, lastName?,
 *                                     phone? } → creates caregiver + user records,
 *                                     marks invite accepted, returns a bearer token
 *
 * Per the brand memory: invitation-only signup, emailed invite + access code,
 * access code delivered as a final security measure, private acceptance flow.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=invite-acceptance-routes.d.ts.map