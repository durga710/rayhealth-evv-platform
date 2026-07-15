/**
 * Analytics privacy gate.
 *
 * Vercel Analytics reports the SPA route path on every client-side
 * navigation. Authenticated routes carry entity identifiers in the URL
 * (e.g. `/admin/audit-packet/:visitId`, `/admin/staff/:caregiverId`), and
 * Vercel is a subprocessor whose BAA is still in progress (see /privacy and
 * /trust). Those paths must not be disclosed to a non-BAA vendor once real
 * PHI enters the system, so we drop every analytics event on an
 * authenticated prefix and only report public marketing pageviews.
 */

/**
 * Route-path prefixes that sit behind authentication and can carry entity
 * identifiers in the URL.
 */
export const AUTHENTICATED_PATH_PREFIXES = ['/admin', '/superadmin', '/portal', '/caregiver'];

/** True when `path` is, or is nested under, an authenticated prefix. */
export function isAuthenticatedPath(path: string): boolean {
  return AUTHENTICATED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/**
 * Vercel Analytics `beforeSend` hook. Returns `null` (drop the event) for any
 * event whose URL path is under an authenticated prefix; returns the event
 * unchanged for public marketing routes. Fails closed (drops) on a URL it
 * cannot parse.
 */
export function dropAuthenticatedEvents<T extends { url: string }>(event: T): T | null {
  let path: string;
  try {
    path = new URL(event.url).pathname;
  } catch {
    return null;
  }
  return isAuthenticatedPath(path) ? null : event;
}
