/** Tight limit for the unauthenticated health surface — 60 req per 15-min
 *  per IP. Legitimate probes are <1/min; this stops an attacker from using
 *  the DB health probe as a free DB-load amplifier. Disabled under tests
 *  so supertest doesn't trip the limiter across cases. */
export declare const healthLimiter: import("express-rate-limit").RateLimitRequestHandler;
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=health-routes.d.ts.map