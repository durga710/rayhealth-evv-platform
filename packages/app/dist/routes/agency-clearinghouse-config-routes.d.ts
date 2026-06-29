/**
 * Agency clearinghouse config routes.
 *
 *   GET  /agencies/me/clearinghouse-config  — read transport/endpoint/settings + hasCredentials
 *   PUT  /agencies/me/clearinghouse-config  — admin-only update (write-only credentials)
 *
 * Sibling to the Sandata / HHAeXchange config routes. Credentials are stored
 * AES-256-GCM encrypted by the repository and never returned to the client.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=agency-clearinghouse-config-routes.d.ts.map