export const SESSION_COOKIE_NAME = 'rayhealth_session';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
export function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // strict, not lax — the admin UI never receives top-level navigations
        // from third-party origins as part of a real flow. Strict prevents
        // even GET-based CSRF on the rare auth-sensitive read endpoints.
        sameSite: 'strict',
        path: '/',
        maxAge: EIGHT_HOURS_MS
    };
}
export function clearSessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // strict, not lax — the admin UI never receives top-level navigations
        // from third-party origins as part of a real flow. Strict prevents
        // even GET-based CSRF on the rare auth-sensitive read endpoints.
        sameSite: 'strict',
        path: '/'
    };
}
export function readCookie(req, name) {
    const header = req.header('cookie');
    if (!header)
        return undefined;
    const prefix = `${name}=`;
    return header
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(prefix))
        ?.slice(prefix.length);
}
//# sourceMappingURL=cookies.js.map